"""
POC: Validate the 3 risky cores of the Advertising feature in ONE run.
  (A) Real SMTP email send via the configured Gmail app password.
  (B) OpenAI gpt-4o-mini ad-copy suggestion generation (user's key).
  (C) PPC billing logic: charge $/click from a shop wallet, record
      wallet_transactions + admin_ledger (admin profit), enforce min-wallet-to-start.

Run:  cd /app/backend && python -m scripts.test_core_ads_poc
"""
import asyncio
import sys
import os
import uuid
from datetime import datetime, timezone

# Ensure backend root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import db, OPENAI_API_KEY, OPENAI_MODEL, SMTP_USER  # noqa
from services.email_service import send_email_async  # noqa

RESULTS = {}

# Send the POC email to the configured sender mailbox (guaranteed deliverable inbox we control)
TEST_RECIPIENT = SMTP_USER or "openmarketlb@gmail.com"


# ----------------------------------------------------------------------------
# (A) SMTP
# ----------------------------------------------------------------------------
async def test_smtp():
    print("\n=== (A) SMTP EMAIL SEND ===")
    subject = "OpenMarket Ads POC — SMTP test ✅"
    html = """
    <div style="font-family:Arial,sans-serif;padding:24px;background:#f5f3ff">
      <h2 style="color:#6d28d9">OpenMarket Advertising — SMTP works!</h2>
      <p>This is an automated POC email confirming the campaign mailer is functional.</p>
      <a href="https://example.com" style="display:inline-block;padding:10px 18px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none">Shop Now</a>
    </div>
    """
    try:
        result = await send_email_async(TEST_RECIPIENT, subject, html)
        if result:
            print(f"PASS: Email sent to {TEST_RECIPIENT}")
            RESULTS["smtp"] = True
        else:
            print("FAIL: send_email_async returned falsy (check SMTP creds / logs)")
            RESULTS["smtp"] = False
    except Exception as e:
        print(f"FAIL: SMTP exception -> {e}")
        RESULTS["smtp"] = False


# ----------------------------------------------------------------------------
# (B) OpenAI ad copy suggestions
# ----------------------------------------------------------------------------
async def test_openai():
    print("\n=== (B) OPENAI AD COPY SUGGESTIONS ===")
    if not OPENAI_API_KEY:
        print("FAIL: OPENAI_API_KEY not set")
        RESULTS["openai"] = False
        return
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        prompt = (
            "You are a marketing copywriter for an online marketplace shop named 'TechZone LB' "
            "that sells electronics in Lebanon. Generate 2 short promotional email variants for a "
            "'Black Friday' campaign. Return strict JSON: a list named 'variants' where each item has "
            "'subject' (max 60 chars), 'preview' (max 90 chars), 'body_html' (1-2 short paragraphs with a CTA), "
            "and 'cta_text'."
        )
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You output only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.8,
            max_tokens=700,
        )
        content = resp.choices[0].message.content
        import json
        data = json.loads(content)
        variants = data.get("variants") or data.get("Variants") or []
        if variants and isinstance(variants, list) and variants[0].get("subject"):
            print(f"PASS: Generated {len(variants)} variants. Example subject: "
                  f"{variants[0]['subject']!r}")
            RESULTS["openai"] = True
        else:
            print(f"FAIL: Unexpected JSON shape -> {content[:300]}")
            RESULTS["openai"] = False
    except Exception as e:
        print(f"FAIL: OpenAI exception -> {e}")
        RESULTS["openai"] = False


# ----------------------------------------------------------------------------
# (C) PPC billing logic against a temp shop
# ----------------------------------------------------------------------------
async def test_ppc_billing():
    print("\n=== (C) PPC BILLING (wallet + admin_ledger) ===")
    per_click = 0.05
    min_wallet_to_start = 5.0
    shop_id = f"poc-shop-{uuid.uuid4()}"
    shop_name = "POC Test Shop"
    start_balance = 5.10  # enough to start, will run down past 5 then to ~0

    try:
        await db.shops.insert_one({
            "id": shop_id, "name": shop_name, "wallet_balance": start_balance,
            "_poc": True, "created_at": datetime.now(timezone.utc).isoformat(),
        })

        # Gate: ensure shop meets min-wallet-to-start
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
        if (shop.get("wallet_balance", 0) or 0) < min_wallet_to_start:
            print("FAIL: shop wrongly blocked from starting campaign")
            RESULTS["ppc"] = False
            return
        print(f"OK: shop can start campaign (balance ${start_balance} >= min ${min_wallet_to_start})")

        charged_clicks = 0
        admin_profit_added = 0.0
        # Simulate 200 click attempts; each should charge until balance < per_click
        for _ in range(200):
            shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
            bal = shop.get("wallet_balance", 0) or 0
            if bal < per_click:
                break  # budget exhausted -> stop charging
            new_bal = round(bal - per_click, 2)
            await db.shops.update_one({"id": shop_id}, {"$set": {"wallet_balance": new_bal}})
            txn_id = str(uuid.uuid4())
            await db.wallet_transactions.insert_one({
                "id": txn_id, "shop_id": shop_id, "shop_name": shop_name,
                "type": "ppc_click_charge", "amount": -per_click, "balance_after": new_bal,
                "status": "completed", "_poc": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            await db.admin_ledger.insert_one({
                "id": str(uuid.uuid4()), "type": "platform_services",
                "subtype": "ppc_click", "amount": per_click, "direction": "credit",
                "shop_id": shop_id, "shop_name": shop_name, "ref_id": txn_id, "_poc": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            charged_clicks += 1
            admin_profit_added = round(admin_profit_added + per_click, 2)

        final = await db.shops.find_one({"id": shop_id}, {"_id": 0})
        final_bal = final.get("wallet_balance", 0)
        ledger_sum = 0.0
        async for e in db.admin_ledger.find({"shop_id": shop_id, "_poc": True}):
            ledger_sum = round(ledger_sum + e.get("amount", 0), 2)
        txn_count = await db.wallet_transactions.count_documents({"shop_id": shop_id, "_poc": True})

        print(f"OK: charged {charged_clicks} clicks; final wallet ${final_bal}; "
              f"admin_ledger credited ${ledger_sum}; wallet_txns={txn_count}")

        expected_clicks = round(start_balance / per_click)  # 5.10/0.05 = 102 (round avoids float trunc)
        ok = (
            charged_clicks == expected_clicks and
            abs(ledger_sum - admin_profit_added) < 1e-6 and
            final_bal < per_click and
            txn_count == charged_clicks
        )
        if ok:
            print(f"PASS: billing math correct (expected {expected_clicks} clicks).")
            RESULTS["ppc"] = True
        else:
            print(f"FAIL: billing mismatch (expected {expected_clicks} clicks).")
            RESULTS["ppc"] = False
    except Exception as e:
        print(f"FAIL: PPC exception -> {e}")
        RESULTS["ppc"] = False
    finally:
        # Cleanup POC docs
        await db.shops.delete_many({"_poc": True})
        await db.wallet_transactions.delete_many({"_poc": True})
        await db.admin_ledger.delete_many({"_poc": True})
        print("Cleanup: removed POC docs")


async def main():
    print("OPENAI_MODEL:", OPENAI_MODEL, "| KEY set:", bool(OPENAI_API_KEY), "| SMTP_USER:", SMTP_USER)
    await test_smtp()
    await test_openai()
    await test_ppc_billing()

    print("\n=============== POC SUMMARY ===============")
    for k in ("smtp", "openai", "ppc"):
        print(f"  {k.upper():8s}: {'PASS' if RESULTS.get(k) else 'FAIL'}")
    all_pass = all(RESULTS.get(k) for k in ("smtp", "openai", "ppc"))
    print("  OVERALL :", "PASS ✅" if all_pass else "FAIL ❌")
    print("==========================================")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    asyncio.run(main())
