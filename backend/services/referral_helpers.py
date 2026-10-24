"""
Referral Agent helpers — credits agent wallets on shop approval and order payout settlement.

Concept:
- A `referral agent` is a user with role "agent" who refers shops onto the platform.
- When a shop they referred is approved, the agent gets a configurable APPROVAL bonus
  (default $4) credited to their wallet, deducted from admin profit (admin_ledger).
- When an order from a referred shop is marked PAID/settled, the agent earns a configurable
  share (default 30%) of the order's admin commission. That share is credited to the
  agent wallet and reduces admin commission profit by the same amount.

All amounts are stored in `agent_wallet_transactions` and recorded in `admin_ledger`
under type "agent_commission" / "agent_approval_bonus" so the Finance Center can show
the cost clearly.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, Optional, Any
import uuid

from config import db, logger


DEFAULT_AGENT_COMMISSION_SHARE = 30.0  # % of admin commission given to referring agent
DEFAULT_AGENT_APPROVAL_BONUS = 4.0  # $ given on referred shop approval


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_agent_settings(agent_id: str) -> Dict[str, Any]:
    """Fetch the referral agent's configured commission share % and approval bonus $.

    Falls back to platform defaults if not set on the agent doc.
    """
    agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0})
    if not agent:
        return {
            "commission_share_percent": DEFAULT_AGENT_COMMISSION_SHARE,
            "approval_bonus_amount": DEFAULT_AGENT_APPROVAL_BONUS,
            "agent": None,
        }
    return {
        "commission_share_percent": float(
            agent.get("commission_share_percent")
            if agent.get("commission_share_percent") is not None
            else DEFAULT_AGENT_COMMISSION_SHARE
        ),
        "approval_bonus_amount": float(
            agent.get("approval_bonus_amount")
            if agent.get("approval_bonus_amount") is not None
            else DEFAULT_AGENT_APPROVAL_BONUS
        ),
        "agent": agent,
    }


async def credit_agent_wallet(
    agent_id: str,
    amount: float,
    txn_type: str,
    note: str,
    *,
    shop_id: Optional[str] = None,
    shop_name: Optional[str] = None,
    order_id: Optional[str] = None,
    referral_id: Optional[str] = None,
    record_admin_ledger: bool = True,
) -> Dict[str, Any]:
    """Credit the agent wallet, record an agent_wallet_transactions row,
    and (optionally) write an admin_ledger debit so admin profit reflects the cost.
    Returns the wallet transaction document.
    """
    if amount <= 0:
        return {}

    amount = round(float(amount), 2)
    now = _now_iso()

    agent = await db.users.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        logger.warning(f"credit_agent_wallet: agent {agent_id} not found")
        return {}

    new_balance = round((agent.get("wallet_balance", 0) or 0) + amount, 2)
    await db.users.update_one({"id": agent_id}, {"$set": {"wallet_balance": new_balance}})

    txn_id = str(uuid.uuid4())
    txn = {
        "id": txn_id,
        "agent_id": agent_id,
        "agent_name": agent.get("name"),
        "type": txn_type,  # e.g. agent_commission, agent_approval_bonus, agent_cashout, agent_cashout_request
        "amount": amount,
        "balance_after": new_balance,
        "status": "completed",
        "note": note,
        "shop_id": shop_id,
        "shop_name": shop_name,
        "order_id": order_id,
        "referral_id": referral_id,
        "created_at": now,
    }
    await db.agent_wallet_transactions.insert_one(txn)

    if record_admin_ledger:
        # Admin profit decreases by this amount (debit)
        ledger_subtype = "agent_approval_bonus" if "approval" in txn_type else "agent_commission"
        await db.admin_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "type": "agent_payouts",
            "subtype": ledger_subtype,
            "amount": amount,
            "direction": "debit",
            "agent_id": agent_id,
            "agent_name": agent.get("name"),
            "shop_id": shop_id,
            "shop_name": shop_name,
            "order_id": order_id,
            "ref_id": txn_id,
            "note": note,
            "created_at": now,
        })

    return txn


async def debit_agent_wallet(
    agent_id: str,
    amount: float,
    txn_type: str,
    note: str,
    *,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Debit (subtract) from the agent wallet. Used for cash-out approval."""
    if amount <= 0:
        return {}
    amount = round(float(amount), 2)
    now = _now_iso()
    agent = await db.users.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        return {}
    current = agent.get("wallet_balance", 0) or 0
    if amount > current + 0.005:
        raise ValueError("Insufficient agent wallet balance")
    new_balance = round(current - amount, 2)
    await db.users.update_one({"id": agent_id}, {"$set": {"wallet_balance": new_balance}})
    txn_id = str(uuid.uuid4())
    txn = {
        "id": txn_id,
        "agent_id": agent_id,
        "agent_name": agent.get("name"),
        "type": txn_type,
        "amount": -amount,
        "balance_after": new_balance,
        "status": "completed",
        "note": note,
        "request_id": request_id,
        "created_at": now,
    }
    await db.agent_wallet_transactions.insert_one(txn)
    return txn


async def get_or_create_referral_code(agent_id: str) -> str:
    """Return a unique referral code for the agent. Creates one if missing."""
    agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0})
    if not agent:
        return ""
    code = agent.get("referral_code")
    if code:
        return code
    # Generate a short code from first 3 letters of first name + random suffix
    base = (agent.get("first_name") or agent.get("name") or "AGT")[:4].upper()
    import random, string
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    code = f"{base}-{suffix}"
    # Try a few times in unlikely collision case
    for _ in range(5):
        existing = await db.users.find_one({"referral_code": code}, {"_id": 0, "id": 1})
        if not existing:
            break
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
        code = f"{base}-{suffix}"
    await db.users.update_one({"id": agent_id}, {"$set": {"referral_code": code}})
    return code


async def get_agent_by_referral_code(code: str) -> Optional[Dict[str, Any]]:
    if not code:
        return None
    return await db.users.find_one({"referral_code": code, "role": "agent"}, {"_id": 0, "password": 0})


async def on_referred_shop_approved(
    *,
    shop_id: str,
    shop_name: str,
    referral_agent_id: str,
    referral_id: Optional[str] = None,
) -> None:
    """Called when a shop referred by an agent is approved. Credits the agent's
    approval bonus to their wallet.
    """
    settings = await get_agent_settings(referral_agent_id)
    bonus = float(settings.get("approval_bonus_amount") or DEFAULT_AGENT_APPROVAL_BONUS)
    if bonus <= 0:
        return
    txn = await credit_agent_wallet(
        agent_id=referral_agent_id,
        amount=bonus,
        txn_type="agent_approval_bonus",
        note=f"Approval bonus for referred shop {shop_name}",
        shop_id=shop_id,
        shop_name=shop_name,
        referral_id=referral_id,
    )
    # Update referral row
    if referral_id:
        await db.referrals.update_one(
            {"id": referral_id},
            {"$set": {
                "approval_bonus_paid": True,
                "approval_bonus_amount": bonus,
                "approval_bonus_at": _now_iso(),
                "approval_bonus_txn_id": txn.get("id"),
                "status": "approved",
            }},
        )

    # Notify the agent that their referred shop was approved
    try:
        from services.helpers import create_notification
        await create_notification(
            recipient_type="agent",
            recipient_id=referral_agent_id,
            title="Referred shop approved! 🎉",
            message=f'Your referred shop "{shop_name}" was approved. ${bonus:.2f} approval bonus added to your wallet.',
            notification_type="agent_referral",
            link="/agent/dashboard",
        )
    except Exception as _e:
        logger.error(f"Failed to notify agent {referral_agent_id} of referred shop approval: {_e}")


async def on_referred_order_settled(*, order: Dict[str, Any]) -> None:
    """Called when an order from a referred shop is marked PAID for the first time.
    For each shop in the order that was referred by an agent, credit the agent's
    share of the admin commission attributable to that shop's portion of the order.

    Commission split for a referred shop:
       agent_share = (shop_commission_amount) * (agent.commission_share_percent / 100)
       admin keeps the rest. Agent share is deducted from admin profit via admin_ledger.

    The function is idempotent: it sets agent_commission_distributed=True on the
    order after the first call.
    """
    if not order:
        return
    if order.get("agent_commission_distributed"):
        return

    order_id = order.get("id")
    items = order.get("items", []) or []
    order_shop_id = order.get("shop_id")
    # The agent's share is based on the ORIGINAL commission (before any loyalty-point
    # discount). The platform still earns its commission — loyalty points are a
    # platform-funded discount — so the agent must still get their % even when the
    # order was made "free" with points. `actual_commission` is what the order really
    # collected after redemption; any shortfall becomes an admin-owed Agent Payout.
    original_commission = float(order.get("original_commission_amount") or order.get("commission_amount") or 0)
    actual_commission = float(order.get("commission_amount") or 0)
    total_commission = original_commission
    if total_commission <= 0:
        await db.orders.update_one({"id": order_id}, {"$set": {"agent_commission_distributed": True}})
        return

    # Sum subtotals per shop
    shop_subtotals: Dict[str, float] = {}
    total_subtotal = 0.0
    for item in items:
        sid = item.get("shop_id") or order_shop_id
        if not sid:
            continue
        sub = float(item.get("original_subtotal") or item.get("subtotal") or 0)
        shop_subtotals[sid] = shop_subtotals.get(sid, 0) + sub
        total_subtotal += sub

    # Fallback if items had no shop_id and we have an order-level shop_id
    if not shop_subtotals and order_shop_id:
        sub = float(order.get("subtotal") or 0)
        if sub > 0:
            shop_subtotals[order_shop_id] = sub
            total_subtotal = sub

    if total_subtotal <= 0:
        await db.orders.update_one({"id": order_id}, {"$set": {"agent_commission_distributed": True}})
        return

    # For each shop, find the referring agent and pay them their share
    distributions = []
    for sid, sub in shop_subtotals.items():
        shop = await db.shops.find_one({"id": sid}, {"_id": 0, "id": 1, "name": 1, "referred_by_agent_id": 1})
        if not shop:
            continue
        agent_id = shop.get("referred_by_agent_id")
        if not agent_id:
            continue
        # Verify agent exists & is active
        agent = await db.users.find_one({"id": agent_id, "role": "agent"}, {"_id": 0})
        if not agent:
            continue
        # This shop's portion of the ORIGINAL admin commission (+ the portion actually
        # collected after loyalty redemption).
        ratio = (sub / total_subtotal) if total_subtotal else 0
        shop_share_of_commission = round(total_commission * ratio, 2)
        shop_actual_commission = round(actual_commission * ratio, 2)
        if shop_share_of_commission <= 0:
            continue
        # Apply agent commission share %
        settings = await get_agent_settings(agent_id)
        share_pct = float(settings.get("commission_share_percent") or DEFAULT_AGENT_COMMISSION_SHARE)
        agent_amount = round(shop_share_of_commission * (share_pct / 100.0), 2)
        if agent_amount <= 0:
            continue
        txn = await credit_agent_wallet(
            agent_id=agent_id,
            amount=agent_amount,
            txn_type="agent_commission",
            note=f"{share_pct:.0f}% commission share on order #{(order_id or '')[:8]} from {shop.get('name','')}",
            shop_id=sid,
            shop_name=shop.get("name"),
            order_id=order_id,
        )
        # Split: how much of the agent's share the order's actual commission covered vs.
        # what admin had to fund because loyalty points reduced the collected commission.
        covered_by_order = round(min(agent_amount, max(0.0, shop_actual_commission)), 2)
        admin_owed = round(max(0.0, agent_amount - covered_by_order), 2)
        await db.agent_payouts.insert_one({
            "id": str(uuid.uuid4()),
            "order_id": order_id,
            "agent_id": agent_id,
            "agent_name": agent.get("name"),
            "shop_id": sid,
            "shop_name": shop.get("name"),
            "share_percent": share_pct,
            "agent_amount": agent_amount,
            "covered_by_order": covered_by_order,
            "admin_owed": admin_owed,
            "loyalty_redeemed": bool(admin_owed > 0),
            "status": "credited",
            "txn_id": txn.get("id"),
            "created_at": _now_iso(),
        })
        distributions.append({
            "agent_id": agent_id,
            "agent_name": agent.get("name"),
            "shop_id": sid,
            "shop_name": shop.get("name"),
            "agent_share_percent": share_pct,
            "shop_commission": shop_share_of_commission,
            "agent_amount": agent_amount,
            "admin_owed": admin_owed,
            "txn_id": txn.get("id"),
        })

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "agent_commission_distributed": True,
            "agent_commission_distributed_at": _now_iso(),
            "agent_commissions": distributions,
        }},
    )


async def get_order_agent_breakdown(order: Dict[str, Any]) -> Dict[str, Any]:
    """Returns the agent commission breakdown for an order (used by admin order details +
    delivery routes views).
    """
    if not order:
        return {"has_agent": False, "entries": []}

    items = order.get("items", []) or []
    order_shop_id = order.get("shop_id")
    total_commission = float(order.get("commission_amount") or 0)

    shop_subtotals: Dict[str, float] = {}
    total_subtotal = 0.0
    for item in items:
        sid = item.get("shop_id") or order_shop_id
        if not sid:
            continue
        sub = float(item.get("original_subtotal") or item.get("subtotal") or 0)
        shop_subtotals[sid] = shop_subtotals.get(sid, 0) + sub
        total_subtotal += sub
    if not shop_subtotals and order_shop_id:
        sub = float(order.get("subtotal") or 0)
        if sub > 0:
            shop_subtotals[order_shop_id] = sub
            total_subtotal = sub

    entries = []
    for sid, sub in shop_subtotals.items():
        shop = await db.shops.find_one(
            {"id": sid},
            {"_id": 0, "id": 1, "name": 1, "referred_by_agent_id": 1}
        )
        if not shop or not shop.get("referred_by_agent_id"):
            continue
        agent = await db.users.find_one(
            {"id": shop["referred_by_agent_id"], "role": "agent"},
            {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "commission_share_percent": 1},
        )
        if not agent:
            continue
        share_pct = float(
            agent.get("commission_share_percent")
            if agent.get("commission_share_percent") is not None
            else DEFAULT_AGENT_COMMISSION_SHARE
        )
        shop_share = (total_commission * (sub / total_subtotal)) if total_subtotal else 0.0
        agent_amount = round(shop_share * (share_pct / 100.0), 2)
        entries.append({
            "agent_id": agent.get("id"),
            "agent_name": agent.get("name"),
            "shop_id": sid,
            "shop_name": shop.get("name"),
            "agent_share_percent": share_pct,
            "shop_commission": round(shop_share, 2),
            "agent_amount": agent_amount,
            "agent_commission_distributed": bool(order.get("agent_commission_distributed")),
        })
    return {"has_agent": bool(entries), "entries": entries}
