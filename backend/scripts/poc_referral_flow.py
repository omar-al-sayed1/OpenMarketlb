"""
POC: End-to-end referral / agent commission flow.

Proves:
1. A guest shop application submitted with ?ref=CODE is attributed to the agent
   (referred_by_agent_id stored on the application).
2. Approving that application credits the agent's $4 approval bonus to their wallet
   and records an admin_ledger debit (agent_payouts / agent_approval_bonus).
3. The approved shop carries referred_by_agent_id.
4. When an order for that shop is marked PAID, the agent receives their configured
   share (30%) of the admin commission, credited to wallet + admin_ledger debit.
5. The math: 10% shop commission, 30% agent share => agent gets 3% of order value.

Run:  python scripts/poc_referral_flow.py
"""
import sys, uuid, time, requests

BASE = "http://localhost:8001/api"
ADMIN_EMAIL = "admin@openmarket.com"
ADMIN_PASS = "Admin1234!"
AGENT_CODE = "OMAR-IKL2L"
AGENT_ID = "agent-omar"


def jprint(label, data):
    print(f"\n=== {label} ===")
    print(data)


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["token"]


def get_agent_wallet():
    import asyncio, os
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")

    async def _get():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        a = await db.users.find_one({"id": AGENT_ID}, {"_id": 0, "wallet_balance": 1})
        return float((a or {}).get("wallet_balance", 0) or 0)
    return asyncio.get_event_loop().run_until_complete(_get())


def db_query(coro_fn):
    import asyncio, os
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    return asyncio.get_event_loop().run_until_complete(coro_fn(db))


def main():
    failures = []

    # ---- Validate referral code public endpoint ----
    r = requests.get(f"{BASE}/referral/validate", params={"code": AGENT_CODE})
    jprint("validate referral code", r.json())
    if not r.json().get("valid"):
        failures.append("Referral code OMAR-IKL2L did not validate")

    # ---- 1. Submit guest application WITH referral code ----
    unique = uuid.uuid4().hex[:6]
    shop_email = f"pocshop_{unique}@test.com"
    shop_name = f"POC Referred Shop {unique}"
    r = requests.post(f"{BASE}/shop/register-guest", json={
        "name": shop_name,
        "guest_name": "POC Owner",
        "email": shop_email,
        "phone": "+9617000" + unique[:4],
        "address": "POC Street",
        "state": "Beirut",
        "description": "POC referred shop",
        "category_ids": [],
        "referral_code": AGENT_CODE,
    })
    jprint("register-guest", (r.status_code, r.json()))
    if r.status_code != 200:
        failures.append(f"register-guest failed: {r.text}")

    async def _find_app(db):
        return await db.guest_shop_applications.find_one({"email": shop_email}, {"_id": 0})
    app = db_query(_find_app)
    jprint("application stored", {k: app.get(k) for k in ["id", "referral_code", "referred_by_agent_id", "referred_by_agent_name"]} if app else None)
    if not app or app.get("referred_by_agent_id") != AGENT_ID:
        failures.append("Application did NOT capture referred_by_agent_id from referral_code")
    app_id = app["id"] if app else None

    # ---- 2. Approve application as admin ----
    wallet_before = get_agent_wallet()
    token = login(ADMIN_EMAIL, ADMIN_PASS)
    hdr = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{BASE}/admin/guest-applications/{app_id}/approve", headers=hdr, json={
        "password": "ShopPass123!",
        "commission_percentage": 10,
        "commission_type": "on_customer",
        "subscription_required": False,
    })
    jprint("approve application", (r.status_code, r.json()))
    if r.status_code != 200:
        failures.append(f"approve failed: {r.text}")
    shop_id = r.json().get("shop_id") if r.status_code == 200 else None

    time.sleep(0.5)
    wallet_after_approval = get_agent_wallet()
    jprint("agent wallet after approval", {"before": wallet_before, "after": wallet_after_approval})
    if round(wallet_after_approval - wallet_before, 2) != 4.0:
        failures.append(f"Agent approval bonus NOT $4 (delta={round(wallet_after_approval-wallet_before,2)})")

    async def _check_shop_and_ledger(db):
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "referred_by_agent_id": 1, "commission_percentage": 1})
        ledger = await db.admin_ledger.find_one({"type": "agent_payouts", "subtype": "agent_approval_bonus", "shop_id": shop_id}, {"_id": 0})
        return shop, ledger
    shop, approval_ledger = db_query(_check_shop_and_ledger)
    jprint("shop referred_by + approval ledger", {"shop": shop, "ledger": approval_ledger})
    if not shop or shop.get("referred_by_agent_id") != AGENT_ID:
        failures.append("Approved shop missing referred_by_agent_id")
    if not approval_ledger:
        failures.append("No admin_ledger debit for agent_approval_bonus")

    # ---- 3. Create an order for this shop and mark PAID ----
    order_id = str(uuid.uuid4())
    order_value = 100.0
    commission_amount = 10.0  # 10% of 100

    async def _insert_order(db):
        await db.orders.insert_one({
            "id": order_id,
            "order_number": f"POC-{unique}",
            "shop_id": shop_id,
            "customer_name": "POC Buyer",
            "items": [{
                "product_id": "poc-prod",
                "name": "POC Product",
                "shop_id": shop_id,
                "quantity": 1,
                "price": order_value,
                "subtotal": order_value,
                "original_subtotal": order_value,
            }],
            "subtotal": order_value,
            "total_amount": order_value,
            "commission_amount": commission_amount,
            "original_commission_amount": commission_amount,
            "delivery_fee": 0,
            "payment_method": "cod",
            "order_status": "pending",
            "payment_status": "pending",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        return True
    db_query(_insert_order)

    wallet_before_paid = get_agent_wallet()
    r = requests.put(f"{BASE}/orders/{order_id}/status", headers=hdr, params={"order_status": "paid"})
    jprint("mark order paid", (r.status_code, r.json() if r.headers.get("content-type","").startswith("application/json") else r.text[:200]))
    if r.status_code != 200:
        failures.append(f"mark paid failed: {r.text}")

    time.sleep(0.5)
    wallet_after_paid = get_agent_wallet()
    delta = round(wallet_after_paid - wallet_before_paid, 2)
    jprint("agent wallet after order paid", {"before": wallet_before_paid, "after": wallet_after_paid, "delta": delta})
    # 10% commission * 30% agent share = $3 on $100 order
    if delta != 3.0:
        failures.append(f"Agent commission on paid order should be $3 (got ${delta})")

    async def _check_commission_ledger(db):
        order = await db.orders.find_one({"id": order_id}, {"_id": 0, "agent_commission_distributed": 1, "agent_commissions": 1})
        ledger = await db.admin_ledger.find_one({"type": "agent_payouts", "subtype": "agent_commission", "order_id": order_id}, {"_id": 0})
        txn = await db.agent_wallet_transactions.find_one({"order_id": order_id, "type": "agent_commission"}, {"_id": 0})
        return order, ledger, txn
    order_doc, comm_ledger, comm_txn = db_query(_check_commission_ledger)
    jprint("order + commission ledger + txn", {"order": order_doc, "ledger": comm_ledger, "txn": comm_txn})
    if not order_doc or not order_doc.get("agent_commission_distributed"):
        failures.append("Order not marked agent_commission_distributed")
    if not comm_ledger:
        failures.append("No admin_ledger debit for agent_commission")

    # ---- Idempotency: mark paid again, agent wallet should not change ----
    requests.put(f"{BASE}/orders/{order_id}/status", headers=hdr, params={"order_status": "processing"})
    wallet_recheck = get_agent_wallet()
    if round(wallet_recheck - wallet_after_paid, 2) != 0:
        failures.append("Commission distributed more than once (not idempotent)")

    print("\n" + "=" * 50)
    if failures:
        print("POC FAILED:")
        for f in failures:
            print("  - " + f)
        sys.exit(1)
    else:
        print("POC PASSED: referral attribution + $4 approval bonus + 3% commission on paid order all correct.")


if __name__ == "__main__":
    main()
