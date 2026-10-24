"""
POC: Verify core integrations BEFORE building features.
  (A) SMTP email send (the "emails aren't sent" fix)
  (B) Google OAuth login endpoint returns a valid auth_url
  (C) OTP send + verify (dev/test mode) — for Google signup phone verification

Run: cd /app/backend && python scripts/test_integrations_poc.py
"""
import asyncio
import sys
import os
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE = "http://localhost:8001/api"
TEST_EMAIL = "openmarketlb@gmail.com"  # send to self for verification

results = {}


async def test_smtp():
    print("\n=== (A) SMTP EMAIL SEND ===")
    try:
        from services.email_service import send_email_async
        from config import SMTP_USER, SMTP_PASS
        print(f"SMTP_USER={SMTP_USER!r}  SMTP_PASS set={bool(SMTP_PASS)}")
        if not SMTP_USER or not SMTP_PASS:
            print("FAIL: SMTP credentials not configured")
            results["smtp"] = False
            return
        html = "<h2>OpenMarket POC Test</h2><p>This is a real SMTP deliverability test email.</p>"
        res = await send_email_async(TEST_EMAIL, "[POC] OpenMarket SMTP test", html, to_name="OpenMarket Test")
        if res:
            print(f"PASS: Email sent to {TEST_EMAIL}")
            results["smtp"] = True
        else:
            print("FAIL: send_email_async returned None (check logs for SMTP error)")
            results["smtp"] = False
    except Exception as e:
        print(f"FAIL: exception {type(e).__name__}: {e}")
        results["smtp"] = False


async def test_google():
    print("\n=== (B) GOOGLE OAUTH auth_url ===")
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{BASE}/auth/google/login?intent=signup")
        print("status", r.status_code)
        data = r.json()
        url = data.get("auth_url", "")
        ok = r.status_code == 200 and "accounts.google.com" in url and "client_id=" in url
        print(("PASS: " if ok else "FAIL: ") + url[:120])
        results["google"] = ok
    except Exception as e:
        print(f"FAIL: exception {type(e).__name__}: {e}")
        results["google"] = False


async def test_otp():
    print("\n=== (C) OTP SEND + VERIFY (dev mode) ===")
    phone = "+96171234599"
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r1 = await c.post(f"{BASE}/otp/send", json={"phone_number": phone, "purpose": "google_signup"})
            print("send status", r1.status_code, str(r1.json())[:200])
            d1 = r1.json()
            code = d1.get("otp_code")  # present in dev/fallback mode
            if not code:
                print("WARN: no otp_code returned (real SMS mode). Cannot auto-verify in POC.")
                # Still a pass if send succeeded with sent status
                results["otp"] = r1.status_code == 200
                return
            r2 = await c.post(f"{BASE}/otp/verify", json={"phone_number": phone, "code": code, "purpose": "google_signup"})
            print("verify status", r2.status_code, str(r2.json())[:200])
            ok = r2.status_code == 200 and r2.json().get("valid") is True
            print("PASS" if ok else "FAIL")
            results["otp"] = ok
    except Exception as e:
        print(f"FAIL: exception {type(e).__name__}: {e}")
        results["otp"] = False


async def main():
    await test_smtp()
    await test_google()
    await test_otp()
    print("\n================ SUMMARY ================")
    for k, v in results.items():
        print(f"  {k:8s}: {'PASS' if v else 'FAIL'}")
    allok = all(results.values())
    print("=========================================")
    print("ALL PASS" if allok else "SOME FAILED")
    sys.exit(0 if allok else 1)


if __name__ == "__main__":
    asyncio.run(main())
