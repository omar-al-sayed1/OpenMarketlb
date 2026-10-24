"""Quick POC: verify SMTP credentials send a real email."""
import asyncio, sys
sys.path.insert(0, '/app/backend')
from services.email_service import send_email_async

async def main():
    html = "<h2>OpenMarket Test</h2><p>SMTP POC verification email. If you received this, sending works.</p>"
    res = await send_email_async("openmarketlb@gmail.com", "OpenMarket SMTP POC Test", html, "OpenMarket Admin")
    print("RESULT:", res)
    print("PASS" if res else "FAIL")

if __name__ == "__main__":
    asyncio.run(main())
