"""
Referral Agent Routes — covers BOTH admin management of referral agents AND
agent-self endpoints (dashboard, wallet, referred shops, transactions, cash-out, fill shop).
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, List, Optional
from datetime import datetime, timezone
import uuid, bcrypt

from config import db, logger
from auth import require_auth, require_admin, require_admin_strict, require_agent
from models import ReferralAgentCreate, ReferralAgentUpdate, AgentFillShopRequest, AgentCashoutRequest
from services.referral_helpers import (
    DEFAULT_AGENT_COMMISSION_SHARE,
    DEFAULT_AGENT_APPROVAL_BONUS,
    get_or_create_referral_code,
    get_agent_by_referral_code,
    credit_agent_wallet,
    debit_agent_wallet,
    get_agent_settings,
)

try:
    from services.helpers import create_notification
except ImportError:
    async def create_notification(*args, **kwargs):  # type: ignore
        pass

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip_password(doc: Dict) -> Dict:
    if not doc:
        return doc
    d = {k: v for k, v in doc.items() if k != "password"}
    return d


# ==============================================================================
# ADMIN: REFERRAL AGENT MANAGEMENT  (route prefix /api/admin/agents)
# ==============================================================================
@router.get("/admin/agents")
async def list_referral_agents(admin: Dict = Depends(require_admin_strict)):
    """Admin: List all referral agents (NEW system — separate from Employees)"""
    agents = await db.users.find({"role": "agent"}, {"_id": 0, "password": 0}).to_list(2000)
    # enrich with wallet balance + counts
    enriched = []
    for a in agents:
        agent_id = a["id"]
        referred_count = await db.shops.count_documents({"referred_by_agent_id": agent_id})
        referred_approved = await db.shops.count_documents({"referred_by_agent_id": agent_id, "status": "approved"})
        total_earned_doc = await db.agent_wallet_transactions.aggregate([
            {"$match": {"agent_id": agent_id, "amount": {"$gt": 0}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_earned = total_earned_doc[0]["total"] if total_earned_doc else 0
        a["wallet_balance"] = a.get("wallet_balance", 0) or 0
        a["referred_shops_count"] = referred_count
        a["referred_shops_approved"] = referred_approved
        a["total_earned"] = round(total_earned, 2)
        if a.get("commission_share_percent") is None:
            a["commission_share_percent"] = DEFAULT_AGENT_COMMISSION_SHARE
        if a.get("approval_bonus_amount") is None:
            a["approval_bonus_amount"] = DEFAULT_AGENT_APPROVAL_BONUS
        if not a.get("referral_code"):
            a["referral_code"] = await get_or_create_referral_code(agent_id)
        enriched.append(a)
    return enriched


@router.post("/admin/agents")
async def create_referral_agent(data: ReferralAgentCreate, admin: Dict = Depends(require_admin_strict)):
    """Admin: Create a new referral agent. Email must end with @agent.com per business rule."""
    email = data.email.strip().lower()
    if not email.endswith("@agent.com"):
        raise HTTPException(status_code=400, detail="Agent email must end with @agent.com")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    full_name = f"{data.first_name} {data.last_name}".strip()
    hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

    agent_id = str(uuid.uuid4())
    agent_doc = {
        "id": agent_id,
        "email": email,
        "password": hashed,
        "name": full_name,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "role": "agent",
        "phone": data.phone,
        "address": data.address,
        "state": data.state,
        "wallet_balance": 0.0,
        "commission_share_percent": (
            float(data.commission_share_percent)
            if data.commission_share_percent is not None
            else DEFAULT_AGENT_COMMISSION_SHARE
        ),
        "approval_bonus_amount": (
            float(data.approval_bonus_amount)
            if data.approval_bonus_amount is not None
            else DEFAULT_AGENT_APPROVAL_BONUS
        ),
        "created_at": _now_iso(),
    }
    await db.users.insert_one(agent_doc)
    # Generate referral code
    code = await get_or_create_referral_code(agent_id)
    out = await db.users.find_one({"id": agent_id}, {"_id": 0, "password": 0})
    out["referral_code"] = code
    return out


@router.put("/admin/agents/{agent_id}")
async def update_referral_agent(agent_id: str, data: ReferralAgentUpdate, admin: Dict = Depends(require_admin_strict)):
    agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    update_fields: Dict = {}
    if data.first_name is not None:
        update_fields["first_name"] = data.first_name
    if data.last_name is not None:
        update_fields["last_name"] = data.last_name
    if data.first_name is not None or data.last_name is not None:
        fn = data.first_name if data.first_name is not None else agent.get("first_name", "")
        ln = data.last_name if data.last_name is not None else agent.get("last_name", "")
        update_fields["name"] = f"{fn} {ln}".strip()
    if data.email is not None and data.email != agent.get("email"):
        em = data.email.strip().lower()
        if not em.endswith("@agent.com"):
            raise HTTPException(status_code=400, detail="Agent email must end with @agent.com")
        ex = await db.users.find_one({"email": em, "id": {"$ne": agent_id}}, {"_id": 0})
        if ex:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = em
    if data.phone is not None:
        update_fields["phone"] = data.phone
    if data.address is not None:
        update_fields["address"] = data.address
    if data.state is not None:
        update_fields["state"] = data.state
    if data.commission_share_percent is not None:
        cp = float(data.commission_share_percent)
        if cp < 0 or cp > 100:
            raise HTTPException(status_code=400, detail="commission_share_percent must be 0..100")
        update_fields["commission_share_percent"] = cp
    if data.approval_bonus_amount is not None:
        ab = float(data.approval_bonus_amount)
        if ab < 0:
            raise HTTPException(status_code=400, detail="approval_bonus_amount must be ≥ 0")
        update_fields["approval_bonus_amount"] = ab
    if data.password and data.password.strip():
        update_fields["password"] = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"id": agent_id}, {"$set": update_fields})
    updated = await db.users.find_one({"id": agent_id}, {"_id": 0, "password": 0})
    return updated


@router.delete("/admin/agents/{agent_id}")
async def delete_referral_agent(agent_id: str, admin: Dict = Depends(require_admin_strict)):
    agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    # Detach referred shops (keep history but unset agent link)
    await db.shops.update_many(
        {"referred_by_agent_id": agent_id},
        {"$set": {"referred_by_agent_deleted": True}}
    )
    await db.users.delete_one({"id": agent_id})
    return {"message": f"Agent {agent.get('email')} deleted successfully"}


@router.get("/admin/agents/{agent_id}/transactions")
async def admin_agent_transactions(agent_id: str, admin: Dict = Depends(require_admin)):
    agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0, "password": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    txns = await db.agent_wallet_transactions.find(
        {"agent_id": agent_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    return {"agent": agent, "transactions": txns}


@router.get("/admin/agents/{agent_id}/referred-shops")
async def admin_agent_referred_shops(agent_id: str, admin: Dict = Depends(require_admin)):
    agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0, "password": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    shops = await db.shops.find(
        {"referred_by_agent_id": agent_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    return {"agent": agent, "shops": shops}


@router.post("/admin/agents/{agent_id}/assign-shop")
async def admin_assign_shop_to_agent(agent_id: str, request: Request, admin: Dict = Depends(require_admin_strict)):
    """Admin: Assign a shop's referral to this agent. The agent will start receiving their
    commission share on the shop's FUTURE paid orders. Does not retroactively pay the
    approval bonus or past commissions."""
    agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0, "password": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    body = await request.json()
    shop_id = (body.get("shop_id") or "").strip()
    if not shop_id:
        raise HTTPException(status_code=400, detail="shop_id is required")
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    existing = shop.get("referred_by_agent_id")
    if existing and existing != agent_id and not shop.get("referred_by_agent_deleted"):
        raise HTTPException(status_code=400, detail="Shop is already referred by another agent — remove that referral first")
    await db.shops.update_one(
        {"id": shop_id},
        {
            "$set": {
                "referred_by_agent_id": agent_id,
                "referred_by_agent_deleted": False,
                "referral_assigned_by_admin": True,
                "referral_assigned_at": _now_iso(),
            },
            "$unset": {"referral_removed_by_admin": "", "referral_removed_at": ""},
        },
    )
    return {
        "message": f"Shop '{shop.get('name', '')}' assigned to {agent.get('name', 'agent')}",
        "shop_id": shop_id,
        "agent_id": agent_id,
    }


@router.delete("/admin/agents/{agent_id}/referred-shops/{shop_id}")
async def admin_remove_shop_referral(agent_id: str, shop_id: str, admin: Dict = Depends(require_admin_strict)):
    """Admin: Remove a shop's referral link from an agent. The agent stops receiving their
    commission share on the shop's FUTURE orders (commission reverts to default — the admin
    keeps 100%). Commissions already paid to the agent are unaffected."""
    agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0, "password": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if shop.get("referred_by_agent_id") != agent_id:
        raise HTTPException(status_code=400, detail="This shop is not referred by this agent")
    await db.shops.update_one(
        {"id": shop_id},
        {
            "$set": {"referral_removed_by_admin": True, "referral_removed_at": _now_iso()},
            "$unset": {"referred_by_agent_id": "", "referred_by_agent_deleted": ""},
        },
    )
    return {
        "message": f"Referral removed — '{shop.get('name', '')}' no longer credits the agent",
        "shop_id": shop_id,
    }


@router.get("/admin/agents-summary")
async def admin_agents_summary(admin: Dict = Depends(require_admin)):
    """Aggregate totals used by Finance Center: total wallet held + total paid out + pending."""
    agents = await db.users.find(
        {"role": "agent"},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "wallet_balance": 1, "commission_share_percent": 1, "approval_bonus_amount": 1}
    ).to_list(2000)
    total_in_wallets = round(sum(float(a.get("wallet_balance") or 0) for a in agents), 2)

    total_credited_doc = await db.agent_wallet_transactions.aggregate([
        {"$match": {"amount": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    total_credited = round(total_credited_doc[0]["total"], 2) if total_credited_doc else 0.0

    total_paid_out_doc = await db.agent_wallet_transactions.aggregate([
        {"$match": {"type": "agent_cashout"}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
    ]).to_list(1)
    total_paid_out = round(total_paid_out_doc[0]["total"], 2) if total_paid_out_doc else 0.0

    pending_cashouts = await db.agent_cashout_requests.count_documents({"status": "pending"})
    pending_sum_doc = await db.agent_cashout_requests.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    pending_amount = round(pending_sum_doc[0]["total"], 2) if pending_sum_doc else 0.0

    # Per-agent rows for table view
    rows = []
    for a in agents:
        rows.append({
            "id": a["id"],
            "name": a.get("name"),
            "email": a.get("email"),
            "wallet_balance": round(float(a.get("wallet_balance") or 0), 2),
            "commission_share_percent": float(
                a.get("commission_share_percent")
                if a.get("commission_share_percent") is not None
                else DEFAULT_AGENT_COMMISSION_SHARE
            ),
            "approval_bonus_amount": float(
                a.get("approval_bonus_amount")
                if a.get("approval_bonus_amount") is not None
                else DEFAULT_AGENT_APPROVAL_BONUS
            ),
        })

    return {
        "agents": rows,
        "total_in_wallets": total_in_wallets,
        "total_credited_lifetime": total_credited,
        "total_paid_out": total_paid_out,
        "pending_cashout_count": pending_cashouts,
        "pending_cashout_amount": pending_amount,
    }


# ==============================================================================
# ADMIN: AGENT CASH-OUT REQUEST MANAGEMENT
# ==============================================================================
@router.get("/admin/agent-cashout-requests")
async def admin_list_agent_cashouts(admin: Dict = Depends(require_admin), status: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    reqs = await db.agent_cashout_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return reqs


@router.get("/admin/agent-payouts")
async def admin_agent_payouts(admin: Dict = Depends(require_admin)):
    """Admin: agent commission payouts from referred-shop orders. Shows each agent
    share, how much the order's own commission covered, and how much admin funded from
    profit because loyalty points reduced the order's collected commission (admin_owed)."""
    rows = await db.agent_payouts.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    total_paid = round(sum(float(r.get("agent_amount", 0) or 0) for r in rows), 2)
    total_admin_owed = round(sum(float(r.get("admin_owed", 0) or 0) for r in rows), 2)
    total_from_loyalty = round(sum(float(r.get("admin_owed", 0) or 0) for r in rows if r.get("loyalty_redeemed")), 2)
    return {
        "payouts": rows,
        "total_agent_paid": total_paid,
        "total_admin_owed": total_admin_owed,
        "total_funded_from_loyalty": total_from_loyalty,
    }


@router.post("/admin/agent-cashout-requests/{req_id}/approve")
async def admin_approve_agent_cashout(req_id: str, admin: Dict = Depends(require_admin_strict)):
    req = await db.agent_cashout_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    agent_id = req["agent_id"]
    amount = float(req["amount"])
    try:
        await debit_agent_wallet(
            agent_id=agent_id,
            amount=amount,
            txn_type="agent_cashout",
            note=f"Cash-out approved (req {req_id[:8]})",
            request_id=req_id,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Agent wallet has insufficient balance")
    await db.agent_cashout_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "approved", "approved_at": _now_iso(), "approved_by": admin.get("email")}},
    )
    try:
        await create_notification(
            recipient_type="agent",
            recipient_id=agent_id,
            title="Cash-out approved",
            message=f"Your ${amount:.2f} cash-out request has been approved.",
            notification_type="agent_cashout",
            link="/agent/cashout",
        )
    except Exception as _e:
        logger.error(f"Failed to create cash-out approval notification: {_e}")
    return {"message": "Cash-out approved"}


@router.post("/admin/agent-cashout-requests/{req_id}/reject")
async def admin_reject_agent_cashout(req_id: str, request: Request, admin: Dict = Depends(require_admin_strict)):
    req = await db.agent_cashout_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    body = await request.json() if (await request.body()) else {}
    reason = (body.get("reason") if isinstance(body, dict) else None) or ""
    await db.agent_cashout_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "rejected", "rejected_at": _now_iso(), "reject_reason": reason}},
    )
    return {"message": "Cash-out rejected"}


# ==============================================================================
# AGENT SELF (referral agent dashboard)
# ==============================================================================
@router.get("/agent/dashboard")
async def agent_dashboard(agent: Dict = Depends(require_agent)):
    agent_id = agent["user_id"]
    me = await db.users.find_one({"id": agent_id}, {"_id": 0, "password": 0})
    if not me:
        raise HTTPException(status_code=404, detail="Agent not found")
    # Ensure referral code exists
    if not me.get("referral_code"):
        me["referral_code"] = await get_or_create_referral_code(agent_id)
    # Counts
    referred_total = await db.shops.count_documents({"referred_by_agent_id": agent_id})
    referred_approved = await db.shops.count_documents({"referred_by_agent_id": agent_id, "status": "approved"})
    referred_pending = await db.guest_shop_applications.count_documents({"referred_by_agent_id": agent_id, "status": "pending"})

    # Lifetime earnings + breakdowns
    earnings_agg = await db.agent_wallet_transactions.aggregate([
        {"$match": {"agent_id": agent_id, "amount": {"$gt": 0}}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]).to_list(10)
    earnings_by_type = {row["_id"]: round(row["total"], 2) for row in earnings_agg}
    total_earned = round(sum(earnings_by_type.values()), 2)

    cashout_agg = await db.agent_wallet_transactions.aggregate([
        {"$match": {"agent_id": agent_id, "type": "agent_cashout"}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
    ]).to_list(1)
    total_cashed_out = round(cashout_agg[0]["total"], 2) if cashout_agg else 0.0

    pending_cashout = await db.agent_cashout_requests.count_documents({"agent_id": agent_id, "status": "pending"})
    pending_cashout_amount_doc = await db.agent_cashout_requests.aggregate([
        {"$match": {"agent_id": agent_id, "status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    pending_cashout_amount = round(pending_cashout_amount_doc[0]["total"], 2) if pending_cashout_amount_doc else 0.0

    # Recent transactions
    recent_txns = await db.agent_wallet_transactions.find(
        {"agent_id": agent_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    settings = await get_agent_settings(agent_id)

    return {
        "agent": me,
        "wallet_balance": round(float(me.get("wallet_balance") or 0), 2),
        "referral_code": me.get("referral_code"),
        "stats": {
            "referred_total": referred_total,
            "referred_approved": referred_approved,
            "referred_pending": referred_pending,
            "total_earned": total_earned,
            "total_approval_bonus": earnings_by_type.get("agent_approval_bonus", 0),
            "total_commission": earnings_by_type.get("agent_commission", 0),
            "total_cashed_out": total_cashed_out,
            "pending_cashout_count": pending_cashout,
            "pending_cashout_amount": pending_cashout_amount,
        },
        "settings": {
            "commission_share_percent": settings["commission_share_percent"],
            "approval_bonus_amount": settings["approval_bonus_amount"],
        },
        "recent_transactions": recent_txns,
    }


@router.get("/agent/wallet")
async def agent_wallet(agent: Dict = Depends(require_agent)):
    agent_id = agent["user_id"]
    me = await db.users.find_one({"id": agent_id}, {"_id": 0, "password": 0})
    if not me:
        raise HTTPException(status_code=404, detail="Agent not found")
    txns = await db.agent_wallet_transactions.find(
        {"agent_id": agent_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    return {
        "balance": round(float(me.get("wallet_balance") or 0), 2),
        "transactions": txns,
        "agent_name": me.get("name"),
    }


@router.get("/agent/referred-shops")
async def agent_referred_shops(agent: Dict = Depends(require_agent)):
    agent_id = agent["user_id"]
    shops = await db.shops.find(
        {"referred_by_agent_id": agent_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "state": 1, "address": 1, "status": 1, "commission_percentage": 1, "created_at": 1, "logo": 1}
    ).sort("created_at", -1).to_list(2000)
    pending_apps = await db.guest_shop_applications.find(
        {"referred_by_agent_id": agent_id, "status": {"$ne": "approved"}},
        {"_id": 0, "id": 1, "shop_name": 1, "email": 1, "phone": 1, "state": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(500)
    return {"shops": shops, "pending_applications": pending_apps}


@router.get("/agent/commissions")
async def agent_commissions(agent: Dict = Depends(require_agent)):
    """All orders that earned this agent a commission, with details."""
    agent_id = agent["user_id"]
    txns = await db.agent_wallet_transactions.find(
        {"agent_id": agent_id, "type": "agent_commission"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5000)
    # Enrich each with order info
    enriched = []
    for t in txns:
        order_id = t.get("order_id")
        order = None
        if order_id:
            order = await db.orders.find_one(
                {"id": order_id},
                {"_id": 0, "id": 1, "total_amount": 1, "commission_amount": 1, "order_status": 1, "payment_status": 1, "created_at": 1, "guest_name": 1}
            )
        enriched.append({**t, "order": order})
    return {"commissions": enriched}


@router.post("/agent/fill-shop")
async def agent_fill_shop_application(data: AgentFillShopRequest, agent: Dict = Depends(require_agent)):
    """Agent submits a shop on behalf of someone. Creates a guest_shop_application
    marked as referred by this agent. Admin must approve as usual.
    """
    agent_id = agent["user_id"]
    # Don't allow if email already belongs to a user with a shop
    existing_user = await db.users.find_one({"email": data.email}, {"_id": 0, "id": 1, "shop_id": 1, "role": 1})
    if existing_user and (existing_user.get("role") == "shop" or existing_user.get("shop_id")):
        raise HTTPException(status_code=400, detail="This email already belongs to an existing shop owner")

    # Don't allow if a pending application already exists for this email
    pending = await db.guest_shop_applications.find_one({"email": data.email, "status": "pending"}, {"_id": 0})
    if pending:
        raise HTTPException(status_code=400, detail="A pending application already exists for this email")

    me = await db.users.find_one({"id": agent_id}, {"_id": 0, "name": 1, "first_name": 1, "last_name": 1, "referral_code": 1})
    code = me.get("referral_code") if me else None
    if not code:
        code = await get_or_create_referral_code(agent_id)

    app_id = str(uuid.uuid4())
    app_doc = {
        "id": app_id,
        "shop_name": data.shop_name.strip(),
        "description": (data.description or "").strip(),
        "email": data.email.strip().lower(),
        "phone": data.phone.strip(),
        "address": (data.address or "").strip(),
        "state": (data.state or "").strip(),
        "guest_name": (data.guest_name or "").strip(),
        "category_ids": data.category_ids or [],
        "logo": data.logo or "",
        "status": "pending",
        "submitted_via": "agent_fill",
        "referred_by_agent_id": agent_id,
        "referred_by_agent_name": me.get("name") if me else None,
        "referral_code": code,
        "is_logged_in_user": False,
        "created_at": _now_iso(),
    }
    await db.guest_shop_applications.insert_one(app_doc)
    return {"message": "Shop application submitted. Awaiting admin approval.", "application_id": app_id}


@router.post("/agent/cashout-request")
async def agent_cashout_request(data: AgentCashoutRequest, agent: Dict = Depends(require_agent)):
    agent_id = agent["user_id"]
    me = await db.users.find_one({"id": agent_id}, {"_id": 0, "name": 1, "email": 1, "wallet_balance": 1, "phone": 1})
    if not me:
        raise HTTPException(status_code=404, detail="Agent not found")
    bal = float(me.get("wallet_balance") or 0)
    amt = float(data.amount or 0)
    if amt <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if amt > bal + 0.005:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: ${bal:.2f}")
    # Check existing pending requests; we keep the wallet untouched until admin approves.
    req_id = str(uuid.uuid4())
    req = {
        "id": req_id,
        "agent_id": agent_id,
        "agent_name": me.get("name"),
        "agent_email": me.get("email"),
        "agent_phone": me.get("phone"),
        "amount": round(amt, 2),
        "method": (data.method or "cash").strip().lower(),
        "method_number": (data.method_number or "").strip(),
        "note": (data.note or "").strip(),
        "status": "pending",
        "created_at": _now_iso(),
    }
    if req["method"] not in ("cash", "whish", "omt"):
        raise HTTPException(status_code=400, detail="Invalid cash out method")
    if req["method"] in ("whish", "omt") and not req["method_number"]:
        raise HTTPException(status_code=400, detail="A phone number is required for Wish Money and OMT")
    if req["method"] == "cash":
        req["method_number"] = ""
    await db.agent_cashout_requests.insert_one(req)
    # Notify admin so the request surfaces in the admin notification bell.
    try:
        await create_notification(
            recipient_type="admin",
            title=f"Cash-out request from {me.get('name') or 'Agent'}",
            message=f"${round(amt, 2):.2f} via {(data.method or 'wallet').strip() or 'wallet'} — pending review",
            notification_type="agent_cashout",
            link="/admin/agent-cashouts",
        )
    except Exception as _e:
        logger.error(f"Failed to create cash-out notification: {_e}")
    return {"message": "Cash-out request submitted. Admin will review.", "request_id": req_id}


@router.get("/agent/cashout-requests")
async def agent_list_my_cashouts(agent: Dict = Depends(require_agent)):
    reqs = await db.agent_cashout_requests.find(
        {"agent_id": agent["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    return reqs


@router.get("/agent/me")
async def agent_me(agent: Dict = Depends(require_agent)):
    """Lightweight identity endpoint used by frontend layout."""
    agent_id = agent["user_id"]
    me = await db.users.find_one({"id": agent_id}, {"_id": 0, "password": 0})
    if not me:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not me.get("referral_code"):
        me["referral_code"] = await get_or_create_referral_code(agent_id)
    return me


# ==============================================================================
# PUBLIC: validate a referral code (used when guest-form prefilled by ?ref=CODE)
# ==============================================================================
@router.get("/referral/validate")
async def validate_referral_code(code: str):
    if not code:
        return {"valid": False}
    agent = await get_agent_by_referral_code(code.strip().upper() if "-" in code else code.strip())
    if not agent:
        # Try as-is
        agent = await get_agent_by_referral_code(code.strip())
    if not agent:
        return {"valid": False}
    return {
        "valid": True,
        "agent_id": agent.get("id"),
        "agent_name": agent.get("name"),
        "first_name": agent.get("first_name"),
        "referral_code": agent.get("referral_code"),
    }
