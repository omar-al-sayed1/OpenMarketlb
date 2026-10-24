"""
OpenMarket Lebanon - Advertising Routes
Email marketing campaigns (blast + PPC), event/campaign sponsorship,
AI copy suggestions, click-tracking redirect, and admin ad management.

All wallet deductions are recorded in db.admin_ledger as
{type:"platform_services", direction:"credit"} so they count toward Admin Profit.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.responses import RedirectResponse, HTMLResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import os
import asyncio
import html as _html

from config import db, logger, OPENAI_API_KEY, OPENAI_MODEL
from auth import require_shop, require_admin, get_current_user
from services.helpers import create_notification

try:
    from services.email_service import send_email_async, send_bulk_emails_async
except ImportError:
    async def send_email_async(*args, **kwargs):
        return None
    async def send_bulk_emails_async(messages):
        return {}

router = APIRouter()

FRONTEND_URL = (os.environ.get("FRONTEND_URL") or "").rstrip("/")
# Base URL used INSIDE emails (click tracking, unsubscribe, CTA). Must be a real
# public https URL — localhost/http links are broken for recipients and a strong
# spam signal. Set PUBLIC_URL to your deployed site; falls back to FRONTEND_URL only
# if that itself is public https.
PUBLIC_URL = (os.environ.get("PUBLIC_URL") or "").rstrip("/")


def _is_public_url(u: str) -> bool:
    return bool(u) and u.startswith("https://") and "localhost" not in u and "127.0.0.1" not in u


def _email_base() -> str:
    for u in (PUBLIC_URL, FRONTEND_URL):
        if _is_public_url(u):
            return u.rstrip("/")
    return ""

# Keep strong references to fire-and-forget background tasks so they are not
# garbage-collected before they finish sending (asyncio.create_task footgun).
_bg_tasks: set = set()


def _spawn(coro):
    task = asyncio.create_task(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)
    return task

# ---- Default ad pricing ----
DEFAULTS = {
    "ads_enabled": True,
    "email_campaigns_enabled": True,
    "ppc_campaigns_enabled": True,
    "banner_campaigns_enabled": True,
    "email_price_per_email": 0.05,
    "ppc_price_per_click": 0.10,
    "ppc_min_wallet_to_start": 5.0,
    "event_sponsorship_default_price": 2.0,
}


async def get_ad_settings() -> Dict[str, Any]:
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0}) or {}
    out = {}
    for k, v in DEFAULTS.items():
        val = settings.get(k)
        out[k] = v if val is None else val
    return out


async def _get_shop(user: Dict) -> Dict:
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _clean(doc: Dict) -> Dict:
    return {k: v for k, v in doc.items() if k != "_id"}


# ===========================================================================
#  RECIPIENT TARGETING
# ===========================================================================
async def _resolve_recipients(shop: Dict, target_type: str, target_state: Optional[str]) -> List[Dict]:
    """Return a de-duplicated list of {email, name} recipients."""
    recipients = {}
    if target_type == "own_customers":
        shop_id = shop["id"]
        query = {"$or": [
            {"shop_id": shop_id},
            {"shop_ids": shop_id},
            {"items.shop_id": shop_id},
        ]}
        orders = await db.orders.find(query, {"_id": 0, "customer_email": 1, "guest_email": 1, "customer_name": 1, "user_id": 1}).to_list(5000)
        for o in orders:
            email = (o.get("customer_email") or o.get("guest_email") or "").strip().lower()
            if email and email not in recipients:
                recipients[email] = {"email": email, "name": o.get("customer_name") or "Customer"}
    else:  # "state" → all platform customers (users + shops) optionally filtered by state
        q = {"role": {"$in": ["user", "shop"]}}
        if target_state and target_state != "all":
            q["state"] = target_state
        users = await db.users.find(q, {"_id": 0, "email": 1, "name": 1}).to_list(20000)
        for u in users:
            email = (u.get("email") or "").strip().lower()
            if email and email not in recipients:
                recipients[email] = {"email": email, "name": u.get("name") or "Customer"}
    # Honor unsubscribe requests — never email people who opted out
    if recipients:
        unsubbed = await db.ad_unsubscribes.find({"email": {"$in": list(recipients.keys())}}, {"_id": 0, "email": 1}).to_list(20000)
        for u in unsubbed:
            recipients.pop((u.get("email") or "").strip().lower(), None)
    return list(recipients.values())


# ===========================================================================
#  EMAIL TEMPLATE
# ===========================================================================
def _build_email_html(shop_name: str, body_html: str, cta_text: str, click_url: str, preview: str = "", unsubscribe_url: str = "", recipient_name: str = "") -> str:
    safe_body = body_html or ""
    cta = cta_text or "Visit Shop"
    pre = _html.escape(preview or "")
    greeting = ""
    if recipient_name:
        first = recipient_name.split(" ")[0]
        greeting = f'<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hi {_html.escape(first)},</p>'
    unsub_html = (
        f'<br/><a href="{_html.escape(unsubscribe_url)}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> from these messages.'
        if unsubscribe_url else ""
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="format-detection" content="telephone=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>{_html.escape(shop_name)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f1f5f9;">{pre}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:22px 28px 6px;border-bottom:1px solid #eef2f7;">
          <div style="font-size:18px;font-weight:700;color:#111827;letter-spacing:0.2px;">{_html.escape(shop_name)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:3px;">OpenMarket Lebanon</div>
        </td></tr>
        <tr><td style="padding:28px;color:#374151;font-size:15px;line-height:1.7;">
          {greeting}
          {safe_body}
          <div style="text-align:center;margin:28px 0 8px;">
            <a href="{click_url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:6px;">{_html.escape(cta)}</a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.6;">
          <p style="margin:0 0 6px;">You're receiving this because you have an account with OpenMarket Lebanon.</p>
          <p style="margin:0 0 6px;color:#9ca3af;font-size:11px;">OpenMarket Lebanon, Beirut, Lebanon</p>
          <p style="margin:0;color:#9ca3af;font-size:11px;">&copy; {datetime.now().year} OpenMarket Lebanon. All rights reserved.{unsub_html}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def _send_campaign_emails(campaign: Dict, recipients: List[Dict]):
    """Background task: send the campaign email to all recipients."""
    cid = campaign.get("id")
    try:
        await _send_campaign_emails_impl(campaign, recipients)
    except Exception as e:
        # Never let a background send die silently — log it and flag the campaign.
        logger.exception(f"Campaign {cid} send failed: {e}")
        try:
            await db.email_campaigns.update_one(
                {"id": cid},
                {"$set": {"status": "failed", "error": str(e)[:300]}},
            )
        except Exception:
            pass


async def _send_campaign_emails_impl(campaign: Dict, recipients: List[Dict]):
    cid = campaign["id"]
    shop_name = campaign.get("shop_name", "Our Shop")
    raw_subject = campaign.get("subject", "A special offer for you")
    # Sanitize subject to reduce spam triggers — no all-caps, excessive emoji/punctuation
    import re as _re
    def _clean_subject(s: str) -> str:
        # Strip excessive ! / ? / $ and remove ALL-CAPS words longer than 3 chars
        s = _re.sub(r'!{2,}', '!', s)
        s = _re.sub(r'\?{2,}', '?', s)
        s = _re.sub(r'\${2,}', '$', s)
        # Avoid spam buzzwords if they're shouted in all caps
        s = _re.sub(r'\b(FREE|WIN|EARN|URGENT|ACT NOW|GUARANTEE|HOT|CLICK|BUY)\b', lambda m: m.group(1).title(), s)
        return s[:160]
    # Build every personalized message up front, then send them all over a single
    # reused SMTP connection (one login). This is dramatically faster than opening a
    # new Gmail connection per email and is what makes large campaigns actually finish.
    messages = []
    ebase = _email_base()
    brand_fallback = PUBLIC_URL if _is_public_url(PUBLIC_URL) else "https://openmarketlb.com"
    for r in recipients:
        if ebase:
            click_url = f"{ebase}/api/ads/click/{cid}?r={r['email']}"
            unsub_url = f"{ebase}/api/ads/unsubscribe?e={r['email']}"
        else:
            # No public URL configured — never embed localhost links (they break for
            # recipients and get the mail flagged as spam). Point the CTA at a real URL
            # and rely on the mailto: unsubscribe in the header instead.
            campaign_link = campaign.get("link_url") or ""
            click_url = campaign_link if _is_public_url(campaign_link) else brand_fallback
            unsub_url = ""
        html = _build_email_html(shop_name, campaign.get("body_html", ""), campaign.get("cta_text", "Shop Now"), click_url, campaign.get("preview", ""), unsub_url, recipient_name=r.get("name") or "")
        # Personalize subject — include first name where possible (helps inbox placement)
        recipient_name = (r.get("name") or "").split(" ")[0] if r.get("name") else ""
        if recipient_name and "{name}" in raw_subject:
            personalized_subject = raw_subject.replace("{name}", recipient_name)
        elif recipient_name and len(recipient_name) > 1:
            personalized_subject = f"{recipient_name}, {raw_subject}" if len(raw_subject) < 90 else raw_subject
        else:
            personalized_subject = raw_subject
        personalized_subject = _clean_subject(personalized_subject)
        messages.append({"to_email": r["email"], "subject": personalized_subject, "html": html, "to_name": r.get("name")})

    sent = 0
    try:
        results = await send_bulk_emails_async(messages)
        sent = sum(1 for ok in results.values() if ok)
    except Exception as e:
        logger.error(f"Campaign {cid} bulk send error: {e}")

    await db.email_campaigns.update_one(
        {"id": cid},
        {"$set": {"emails_sent": sent, "status": "sent" if campaign.get("type") == "blast" else "active", "sent_at": datetime.now(timezone.utc).isoformat()}},
    )
    logger.info(f"Campaign {cid} finished sending: {sent}/{len(recipients)} emails")


async def _record_ad_profit(shop: Dict, amount: float, subtype: str, note: str, ref_id: str):
    """Record an ad-related wallet deduction as admin profit."""
    await db.admin_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "type": "platform_services",
        "subtype": subtype,
        "amount": round(amount, 4),
        "direction": "credit",
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "ref_id": ref_id,
        "note": note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ===========================================================================
#  SHOP ENDPOINTS
# ===========================================================================
@router.get("/shop/advertising/overview")
async def shop_ads_overview(user: Dict = Depends(require_shop)):
    shop = await _get_shop(user)
    settings = await get_ad_settings()
    campaigns = await db.email_campaigns.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)

    total_spend = round(sum(c.get("cost_charged", 0) + c.get("spend", 0) for c in campaigns), 2)
    total_clicks = sum(c.get("clicks", 0) for c in campaigns)
    total_emails = sum(c.get("emails_sent", 0) for c in campaigns)
    active = sum(1 for c in campaigns if c.get("status") == "active")

    # Active boosts (existing promotions system)
    now_iso = datetime.now(timezone.utc).isoformat()
    active_boosts = await db.promotions.count_documents({"shop_id": shop["id"], "status": "active", "end_date": {"$gt": now_iso}})

    return {
        "wallet_balance": round(shop.get("wallet_balance", 0) or 0, 2),
        "settings": settings,
        "stats": {
            "total_campaigns": len(campaigns),
            "active_campaigns": active,
            "total_spend": total_spend,
            "total_clicks": total_clicks,
            "total_emails_sent": total_emails,
            "active_boosts": active_boosts,
        },
        "recent_campaigns": campaigns[:5],
    }


@router.get("/shop/advertising/campaigns")
async def shop_ads_campaigns(user: Dict = Depends(require_shop)):
    shop = await _get_shop(user)
    campaigns = await db.email_campaigns.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"campaigns": campaigns}


@router.post("/shop/advertising/email/ai-suggest")
async def shop_ads_ai_suggest(body: Dict, user: Dict = Depends(require_shop)):
    """Generate 3 AI email-copy variants (subject + preview + body_html + cta_text)."""
    shop = await _get_shop(user)
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="AI features not configured (missing API key)")

    goal = (body.get("goal") or "Promote our products and drive sales").strip()
    tone = (body.get("tone") or "friendly and persuasive").strip()
    occasion = (body.get("occasion") or "").strip()
    product_name = (body.get("product_name") or "").strip()

    from openai import AsyncOpenAI
    import json as _json

    system_msg = (
        "You are an expert email-marketing copywriter for an online marketplace shop. "
        "Generate exactly 3 distinct promotional email variants. "
        "Return STRICT JSON: {\"variants\":[{\"subject\":\"<=60 chars\",\"preview\":\"<=90 chars\","
        "\"body_html\":\"1-2 short paragraphs of simple HTML using <p> tags, no <html>/<body> wrapper, no images\","
        "\"cta_text\":\"2-4 words\"}]}. Keep it concise, mobile-friendly, and on-brand."
    )
    parts = [f"Shop name: {shop.get('name','Our Shop')}", f"Goal: {goal}", f"Tone: {tone}"]
    if occasion:
        parts.append(f"Occasion/Event: {occasion}")
    if product_name:
        parts.append(f"Featured product: {product_name}")
    if shop.get("description"):
        parts.append(f"About the shop: {shop.get('description')}")
    user_msg = "\n".join(parts)

    try:
        client_ai = AsyncOpenAI(api_key=OPENAI_API_KEY)
        resp = await client_ai.chat.completions.create(
            model=OPENAI_MODEL or "gpt-4o-mini",
            messages=[{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
            response_format={"type": "json_object"},
            temperature=0.85,
            max_tokens=900,
        )
        data = _json.loads(resp.choices[0].message.content)
        variants = data.get("variants") or []
        if not variants:
            raise ValueError("No variants returned")
        return {"variants": variants[:3]}
    except Exception as e:
        logger.error(f"AI suggest failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {e}")


@router.post("/shop/advertising/email/preview-recipients")
async def shop_ads_preview_recipients(body: Dict, user: Dict = Depends(require_shop)):
    shop = await _get_shop(user)
    settings = await get_ad_settings()
    target_type = body.get("target_type", "state")
    target_state = body.get("target_state")
    recipients = await _resolve_recipients(shop, target_type, target_state)
    count = len(recipients)
    cost = round(count * settings["email_price_per_email"], 2)
    return {
        "recipient_count": count,
        "price_per_email": settings["email_price_per_email"],
        "total_cost": cost,
        "wallet_balance": round(shop.get("wallet_balance", 0) or 0, 2),
        "sufficient": (shop.get("wallet_balance", 0) or 0) >= cost,
    }


@router.post("/shop/advertising/email/test")
async def shop_ads_email_test(body: Dict, user: Dict = Depends(require_shop)):
    """Send a TEST email to a custom address (usually the shop owner's own email)
    so they can verify deliverability before launching a real campaign. Does NOT
    cost wallet balance, is NOT tracked in campaigns, and bypasses the recipient list.
    """
    shop = await _get_shop(user)
    settings = await get_ad_settings()
    if not settings["ads_enabled"]:
        raise HTTPException(status_code=400, detail="Advertising is currently disabled by the admin")

    test_email = (body.get("test_email") or user.get("email") or "").strip().lower()
    if not test_email or "@" not in test_email:
        raise HTTPException(status_code=400, detail="A valid test email address is required")

    subject = (body.get("subject") or f"[Test] Email from {shop.get('name', 'OpenMarket')}").strip()
    body_html = (body.get("body_html") or "<p>This is a test email to verify deliverability.</p>").strip()
    cta_text = body.get("cta_text") or "Visit Shop"
    preview = body.get("preview", "")
    link_type = body.get("link_type", "shop")
    link_target_id = body.get("link_target_id")

    # Make absolutely clear this is a test
    if not subject.lower().startswith("[test]"):
        subject = f"[Test] {subject}"

    click_url = _resolve_link_url(link_type, link_target_id, shop)
    unsub_url = f"{FRONTEND_URL}/api/ads/unsubscribe?e={test_email}" if FRONTEND_URL else ""
    recipient_name = (user.get("name") or "").split(" ")[0] if user.get("name") else ""
    html = _build_email_html(shop.get("name", "OpenMarket"), body_html, cta_text, click_url, preview, unsub_url, recipient_name=recipient_name)

    try:
        result = await send_email_async(test_email, subject, html, to_name=user.get("name"))
        if not result:
            raise HTTPException(status_code=500, detail="Failed to send test email. Please check SMTP configuration.")
        return {
            "message": f"Test email sent to {test_email}. Please check your inbox (and SPAM folder).",
            "sent_to": test_email,
            "note": "If this email lands in spam, mark it 'Not Spam' to train Gmail filters for future campaigns."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test email failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {e}")



def _resolve_link_url(link_type: str, link_target_id: str, shop: Dict) -> str:
    base = FRONTEND_URL or ""
    if link_type == "product" and link_target_id:
        return f"{base}/products/{link_target_id}"
    return f"{base}/shop/{shop['id']}"


@router.post("/shop/advertising/email/blast")
async def shop_ads_email_blast(body: Dict, background_tasks: BackgroundTasks, user: Dict = Depends(require_shop)):
    shop = await _get_shop(user)
    settings = await get_ad_settings()
    if not settings["ads_enabled"]:
        raise HTTPException(status_code=400, detail="Advertising is currently disabled by the admin")
    if not settings.get("email_campaigns_enabled", True):
        raise HTTPException(status_code=400, detail="Email campaigns are currently disabled by the admin")

    subject = (body.get("subject") or "").strip()
    body_html = (body.get("body_html") or "").strip()
    if not subject or not body_html:
        raise HTTPException(status_code=400, detail="Subject and email body are required")

    target_type = body.get("target_type", "state")
    target_state = body.get("target_state")
    link_type = body.get("link_type", "shop")
    link_target_id = body.get("link_target_id")

    recipients = await _resolve_recipients(shop, target_type, target_state)
    # Optional: shop can cap how many recipients to send to (range selector)
    try:
        max_recipients = int(body.get("max_recipients") or 0)
    except (TypeError, ValueError):
        max_recipients = 0
    if max_recipients and max_recipients > 0:
        recipients = recipients[:max_recipients]
    count = len(recipients)
    if count == 0:
        raise HTTPException(status_code=400, detail="No recipients match this target. Try a different audience.")

    price = settings["email_price_per_email"]
    cost = round(count * price, 2)
    balance = shop.get("wallet_balance", 0) or 0
    if cost > balance:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Need ${cost:.2f} for {count} emails, have ${balance:.2f}.")

    new_balance = round(balance - cost, 2)
    await db.shops.update_one({"id": shop["id"]}, {"$set": {"wallet_balance": new_balance}})

    now = datetime.now(timezone.utc)
    cid = str(uuid.uuid4())
    link_url = _resolve_link_url(link_type, link_target_id, shop)
    campaign = {
        "id": cid, "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "type": "blast", "name": body.get("name") or subject,
        "subject": subject, "preview": body.get("preview", ""), "body_html": body_html,
        "cta_text": body.get("cta_text") or "Shop Now",
        "target_type": target_type, "target_state": target_state or "all",
        "link_type": link_type, "link_target_id": link_target_id, "link_url": link_url,
        "price_per_email": price, "recipients_count": count, "emails_sent": 0,
        "cost_charged": cost, "clicks": 0, "spend": 0.0,
        "status": "sending", "created_at": now.isoformat(),
    }
    await db.email_campaigns.insert_one(_clean(campaign))

    # Wallet txn
    txn_id = str(uuid.uuid4())
    await db.wallet_transactions.insert_one({
        "id": txn_id, "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "type": "email_campaign", "amount": -cost, "balance_after": new_balance,
        "status": "completed", "note": f"Email campaign '{subject}' to {count} recipients",
        "created_at": now.isoformat(),
    })
    await _record_ad_profit(shop, cost, "email_blast", f"Email blast '{subject}' ({count} emails) by {shop.get('name','')}", txn_id)

    # Send in the background (framework-managed — runs after the response is sent)
    background_tasks.add_task(_send_campaign_emails, campaign, recipients)

    return {"message": f"Campaign launched to {count} recipients", "campaign": _clean(campaign), "wallet_balance": new_balance}


@router.post("/shop/advertising/email/ppc")
async def shop_ads_email_ppc(body: Dict, background_tasks: BackgroundTasks, user: Dict = Depends(require_shop)):
    shop = await _get_shop(user)
    settings = await get_ad_settings()
    if not settings["ads_enabled"]:
        raise HTTPException(status_code=400, detail="Advertising is currently disabled by the admin")
    if not settings.get("ppc_campaigns_enabled", True):
        raise HTTPException(status_code=400, detail="Pay-Per-Click campaigns are currently disabled by the admin")

    subject = (body.get("subject") or "").strip()
    body_html = (body.get("body_html") or "").strip()
    if not subject or not body_html:
        raise HTTPException(status_code=400, detail="Subject and email body are required")

    min_wallet = settings["ppc_min_wallet_to_start"]
    balance = shop.get("wallet_balance", 0) or 0
    if balance < min_wallet:
        raise HTTPException(status_code=400, detail=f"You need at least ${min_wallet:.2f} in your wallet to start a Pay-Per-Click campaign. Current balance: ${balance:.2f}.")

    try:
        click_budget = float(body.get("click_budget") or 0)
    except (TypeError, ValueError):
        click_budget = 0
    if click_budget <= 0:
        raise HTTPException(status_code=400, detail="Please set a click budget greater than $0.")
    if click_budget > balance:
        raise HTTPException(status_code=400, detail=f"Click budget (${click_budget:.2f}) cannot exceed your wallet balance (${balance:.2f}).")

    target_type = body.get("target_type", "state")
    target_state = body.get("target_state")
    link_type = body.get("link_type", "shop")
    link_target_id = body.get("link_target_id")

    recipients = await _resolve_recipients(shop, target_type, target_state)
    # Optional: shop can cap how many recipients to reach (range selector)
    try:
        max_recipients = int(body.get("max_recipients") or 0)
    except (TypeError, ValueError):
        max_recipients = 0
    if max_recipients and max_recipients > 0:
        recipients = recipients[:max_recipients]
    count = len(recipients)
    if count == 0:
        raise HTTPException(status_code=400, detail="No recipients match this target. Try a different audience.")

    now = datetime.now(timezone.utc)
    cid = str(uuid.uuid4())
    link_url = _resolve_link_url(link_type, link_target_id, shop)
    campaign = {
        "id": cid, "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "type": "ppc", "name": body.get("name") or subject,
        "subject": subject, "preview": body.get("preview", ""), "body_html": body_html,
        "cta_text": body.get("cta_text") or "Shop Now",
        "target_type": target_type, "target_state": target_state or "all",
        "link_type": link_type, "link_target_id": link_target_id, "link_url": link_url,
        "price_per_click": settings["ppc_price_per_click"],
        "click_budget": round(click_budget, 2),
        "recipients_count": count, "emails_sent": 0,
        "cost_charged": 0.0, "clicks": 0, "spend": 0.0,
        "status": "sending", "created_at": now.isoformat(),
    }
    await db.email_campaigns.insert_one(_clean(campaign))
    background_tasks.add_task(_send_campaign_emails, campaign, recipients)

    return {"message": f"Pay-Per-Click campaign launched to {count} recipients", "campaign": _clean(campaign), "wallet_balance": round(balance, 2)}


# ----- Event / Campaign sponsorship -----
@router.get("/shop/advertising/events")
async def shop_ads_events(user: Dict = Depends(require_shop)):
    shop = await _get_shop(user)
    settings = await get_ad_settings()
    events = await db.admin_events.find(
        {"display_mode": "home_banner", "is_active": True},
        {"_id": 0},
    ).sort("banner_order", 1).to_list(100)
    out = []
    now = datetime.now(timezone.utc)
    
    # Check which event THIS shop already sponsors (constraint: only one event at a time)
    my_active_sponsorship = None  # {"event_id": ..., "event_title": ..., "end_at": ...}
    for e in events:
        cur = e.get("current_sponsor") or None
        if not cur or cur.get("shop_id") != shop["id"]:
            continue
        try:
            cur_end = datetime.fromisoformat(cur.get("end_at", ""))
            if cur_end > now:
                my_active_sponsorship = {
                    "event_id": e["id"],
                    "event_title": e.get("title", ""),
                    "end_at": cur.get("end_at"),
                }
                break
        except Exception:
            pass
    
    for e in events:
        sponsors = e.get("sponsoring_shops") or []
        current = e.get("current_sponsor") or None
        # Detect expired
        is_reserved = False
        reserved_until = None
        reserved_by = None
        if current:
            try:
                end_at = datetime.fromisoformat(current.get("end_at", ""))
                if end_at > now:
                    is_reserved = True
                    reserved_until = current.get("end_at")
                    reserved_by = {"shop_id": current.get("shop_id"), "shop_name": current.get("shop_name"), "logo": current.get("logo")}
                else:
                    # Expired - clear it
                    await db.admin_events.update_one({"id": e["id"]}, {"$set": {"current_sponsor": None}})
                    current = None
            except Exception:
                current = None
        joined_by_me = bool(current and current.get("shop_id") == shop["id"])
        blocked_by_other_sponsorship = bool(my_active_sponsorship and my_active_sponsorship["event_id"] != e["id"])
        price_per_day = float(e.get("sponsorship_price_per_day") or e.get("sponsorship_price") or settings["event_sponsorship_default_price"])
        out.append({
            "id": e["id"],
            "title": e.get("title", ""),
            "banner_subtitle": e.get("banner_subtitle", ""),
            "image_url": e.get("image_url", ""),
            "banner_accent_color": e.get("banner_accent_color", ""),
            "sponsorship_enabled": e.get("sponsorship_enabled", False),
            "sponsorship_price_per_day": price_per_day,
            "sponsorship_price": price_per_day,  # backward compat
            "sponsors_count": len(sponsors),
            "joined": joined_by_me,
            "is_reserved": is_reserved,
            "reserved_until": reserved_until,
            "reserved_by": reserved_by,
            "available": (not is_reserved) or joined_by_me,
            "blocked_by_other_sponsorship": blocked_by_other_sponsorship,
            "my_sponsor_title": (current.get("sponsor_title", "") if joined_by_me and current else ""),
            "my_sponsor_subtitle": (current.get("sponsor_subtitle", "") if joined_by_me and current else ""),
        })
    return {
        "events": out,
        "wallet_balance": round(shop.get("wallet_balance", 0) or 0, 2),
        "my_active_sponsorship": my_active_sponsorship,
    }


@router.post("/shop/advertising/events/{event_id}/join")
async def shop_ads_join_event(event_id: str, body: Dict = None, user: Dict = Depends(require_shop)):
    shop = await _get_shop(user)
    settings = await get_ad_settings()
    if not settings["ads_enabled"]:
        raise HTTPException(status_code=400, detail="Advertising is currently disabled by the admin")
    if not settings.get("banner_campaigns_enabled", True):
        raise HTTPException(status_code=400, detail="Banner campaigns are currently disabled by the admin")
    event = await db.admin_events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not event.get("sponsorship_enabled", False):
        raise HTTPException(status_code=400, detail="Sponsorship is not open for this event")
    
    body = body or {}
    try:
        days = max(1, int(body.get("days") or 1))
    except (TypeError, ValueError):
        days = 1
    if days > 365:
        days = 365
    
    # Check if banner is currently reserved
    now = datetime.now(timezone.utc)
    current = event.get("current_sponsor") or None
    if current:
        try:
            end_at = datetime.fromisoformat(current.get("end_at", ""))
            if end_at > now:
                if current.get("shop_id") == shop["id"]:
                    raise HTTPException(status_code=400, detail="Your shop already sponsors this banner")
                else:
                    raise HTTPException(status_code=400, detail=f"This banner is already reserved by another shop until {end_at.strftime('%b %d, %Y')}")
        except HTTPException:
            raise
        except Exception:
            pass
    
    # Constraint: a shop can only sponsor ONE event at a time
    other_active = await db.admin_events.find_one(
        {
            "id": {"$ne": event_id},
            "current_sponsor.shop_id": shop["id"],
            "current_sponsor.end_at": {"$gt": now.isoformat()},
        },
        {"_id": 0, "title": 1, "current_sponsor": 1},
    )
    if other_active:
        other_end = other_active.get("current_sponsor", {}).get("end_at", "")
        try:
            other_end_str = datetime.fromisoformat(other_end).strftime("%b %d, %Y") if other_end else ""
        except Exception:
            other_end_str = ""
        raise HTTPException(
            status_code=400,
            detail=(
                f"You are already sponsoring '{other_active.get('title','')}' until {other_end_str}. "
                "A shop can only sponsor ONE event at a time."
            ),
        )
    
    price_per_day = float(event.get("sponsorship_price_per_day") or event.get("sponsorship_price") or settings["event_sponsorship_default_price"])
    total_price = round(price_per_day * days, 2)
    balance = shop.get("wallet_balance", 0) or 0
    if total_price > balance:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Sponsorship costs ${total_price:.2f} for {days} day(s), you have ${balance:.2f}.")
    
    new_balance = round(balance - total_price, 2)
    end_at_dt = now + timedelta(days=days)
    await db.shops.update_one({"id": shop["id"]}, {"$set": {"wallet_balance": new_balance}})
    
    # Optional custom banner content the sponsoring shop can set
    sponsor_title = (body.get("title") or "").strip()
    sponsor_subtitle = (body.get("subtitle") or "").strip()
    
    sponsor_entry = {
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "logo": shop.get("logo", ""),
        "amount": total_price,
        "days": days,
        "price_per_day": price_per_day,
        "sponsor_title": sponsor_title,
        "sponsor_subtitle": sponsor_subtitle,
        "start_at": now.isoformat(),
        "end_at": end_at_dt.isoformat(),
        "joined_at": now.isoformat(),
    }
    await db.admin_events.update_one(
        {"id": event_id},
        {
            "$push": {"sponsoring_shops": sponsor_entry},
            "$set": {"current_sponsor": sponsor_entry},
        },
    )
    
    txn_id = str(uuid.uuid4())
    await db.wallet_transactions.insert_one({
        "id": txn_id, "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "type": "event_sponsorship", "amount": -total_price, "balance_after": new_balance,
        "status": "completed", "note": f"Sponsored event '{event.get('title','')}' for {days} day(s)",
        "created_at": now.isoformat(),
    })
    await db.event_sponsorships.insert_one({
        "id": str(uuid.uuid4()), "event_id": event_id, "event_title": event.get("title", ""),
        "shop_id": shop["id"], "shop_name": shop.get("name", ""), "amount": total_price,
        "days": days, "price_per_day": price_per_day,
        "start_at": now.isoformat(), "end_at": end_at_dt.isoformat(),
        "ref_id": txn_id, "created_at": now.isoformat(),
    })
    await _record_ad_profit(shop, total_price, "event_sponsorship", f"Event sponsorship '{event.get('title','')}' ({days}d) by {shop.get('name','')}", txn_id)
    await create_notification("admin", "New Event Sponsor", f"{shop.get('name')} sponsored '{event.get('title','')}' for ${total_price:.2f} ({days} day{'s' if days != 1 else ''})", "ads", "/admin/advertising")
    
    return {
        "message": f"You are now sponsoring '{event.get('title','')}' for {days} day{'s' if days != 1 else ''}!",
        "wallet_balance": new_balance,
        "days": days,
        "total_price": total_price,
        "end_at": end_at_dt.isoformat(),
    }


@router.put("/shop/advertising/events/{event_id}/sponsor-content")
async def shop_ads_update_sponsor_content(event_id: str, body: Dict = None, user: Dict = Depends(require_shop)):
    """The CURRENT sponsoring shop can customize the banner title & subtitle shown on the home page."""
    shop = await _get_shop(user)
    body = body or {}
    event = await db.admin_events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    current = event.get("current_sponsor") or None
    now = datetime.now(timezone.utc)
    valid = False
    if current and current.get("shop_id") == shop["id"]:
        try:
            valid = datetime.fromisoformat(current.get("end_at", "")) > now
        except Exception:
            valid = True
    if not valid:
        raise HTTPException(status_code=403, detail="You are not the active sponsor of this banner")

    sponsor_title = (body.get("title") or "").strip()
    sponsor_subtitle = (body.get("subtitle") or "").strip()

    # Update current_sponsor + the matching entry in sponsoring_shops
    sponsors = event.get("sponsoring_shops") or []
    for s in sponsors:
        if s.get("shop_id") == shop["id"] and s.get("end_at") == current.get("end_at"):
            s["sponsor_title"] = sponsor_title
            s["sponsor_subtitle"] = sponsor_subtitle
    current["sponsor_title"] = sponsor_title
    current["sponsor_subtitle"] = sponsor_subtitle
    await db.admin_events.update_one(
        {"id": event_id},
        {"$set": {"current_sponsor": current, "sponsoring_shops": sponsors}},
    )
    return {"message": "Banner content updated", "title": sponsor_title, "subtitle": sponsor_subtitle}


# ===========================================================================
#  PUBLIC: CLICK TRACKING + REDIRECT
# ===========================================================================
@router.get("/ads/click/{campaign_id}")
async def ads_click(campaign_id: str, r: Optional[str] = None, request: Request = None):
    campaign = await db.email_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        return RedirectResponse(url=(FRONTEND_URL or "/") or "/")

    target_url = campaign.get("link_url") or (FRONTEND_URL or "/")
    now = datetime.now(timezone.utc)
    charged = False
    amount = 0.0

    if campaign.get("type") == "ppc" and campaign.get("status") in ("active", "sending"):
        price = float(campaign.get("price_per_click") or 0.10)
        spend = float(campaign.get("spend") or 0.0)
        budget = float(campaign.get("click_budget") or 0.0)
        shop = await db.shops.find_one({"id": campaign["shop_id"]}, {"_id": 0})
        balance = (shop.get("wallet_balance", 0) or 0) if shop else 0

        if spend + price <= budget and balance >= price:
            new_balance = round(balance - price, 2)
            await db.shops.update_one({"id": campaign["shop_id"]}, {"$set": {"wallet_balance": new_balance}})
            txn_id = str(uuid.uuid4())
            await db.wallet_transactions.insert_one({
                "id": txn_id, "shop_id": campaign["shop_id"], "shop_name": campaign.get("shop_name", ""),
                "type": "ppc_click_charge", "amount": -price, "balance_after": new_balance,
                "status": "completed", "note": f"PPC click charge — campaign '{campaign.get('subject','')}'",
                "created_at": now.isoformat(),
            })
            await _record_ad_profit(shop or {"id": campaign["shop_id"], "name": campaign.get("shop_name", "")},
                                    price, "ppc_click", f"PPC click — '{campaign.get('subject','')}' by {campaign.get('shop_name','')}", txn_id)
            charged = True
            amount = price
            new_spend = round(spend + price, 2)
            update = {"$inc": {"clicks": 1, "spend": price, "cost_charged": price}}
            if new_spend + price > budget:
                update.setdefault("$set", {})["status"] = "completed"
            await db.email_campaigns.update_one({"id": campaign_id}, update)
        else:
            # Budget exhausted or wallet too low → stop charging, mark completed, still redirect
            await db.email_campaigns.update_one({"id": campaign_id}, {"$inc": {"clicks": 1}, "$set": {"status": "completed"}})
    else:
        # blast or non-charging click → just count
        await db.email_campaigns.update_one({"id": campaign_id}, {"$inc": {"clicks": 1}})

    await db.email_clicks.insert_one({
        "id": str(uuid.uuid4()), "campaign_id": campaign_id, "shop_id": campaign["shop_id"],
        "recipient": r or "", "type": campaign.get("type"),
        "charged": charged, "amount": amount,
        "created_at": now.isoformat(),
    })
    return RedirectResponse(url=target_url)


async def _record_unsubscribe(email: str, source: str = "email_link"):
    email = (email or "").strip().lower()
    if not email:
        return
    await db.ad_unsubscribes.update_one(
        {"email": email},
        {"$set": {"email": email, "source": source, "unsubscribed_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


_UNSUB_PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsubscribed — OpenMarket Lebanon</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;">
<div style="max-width:480px;margin:80px auto;background:#fff;border-radius:16px;padding:40px 32px;text-align:center;box-shadow:0 10px 40px rgba(2,6,23,.08);">
<div style="font-size:42px;">✅</div>
<h1 style="font-size:20px;color:#0f172a;margin:12px 0 6px;">You've been unsubscribed</h1>
<p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">{email} will no longer receive promotional emails from OpenMarket Lebanon shops.</p>
<a href="{base}/" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#10b981,#0d9488);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;">Back to OpenMarket</a>
</div></body></html>"""


@router.get("/ads/unsubscribe")
async def ads_unsubscribe_get(e: Optional[str] = None):
    """Unsubscribe landing page (clicked from the email's unsubscribe link)."""
    await _record_unsubscribe(e or "", source="email_link")
    base = FRONTEND_URL or ""
    safe_email = _html.escape((e or "").strip())
    return HTMLResponse(content=_UNSUB_PAGE.format(email=safe_email or "This address", base=base))


@router.post("/ads/unsubscribe")
async def ads_unsubscribe_post(e: Optional[str] = None):
    """One-click unsubscribe (RFC 8058 List-Unsubscribe-Post)."""
    await _record_unsubscribe(e or "", source="one_click")
    return {"status": "unsubscribed"}


# ===========================================================================
#  ADMIN ENDPOINTS
# ===========================================================================
AD_SUBTYPES = ["email_blast", "ppc_click", "event_sponsorship", "product_boost"]


@router.get("/admin/advertising/overview")
async def admin_ads_overview(admin: Dict = Depends(require_admin)):
    settings = await get_ad_settings()
    campaigns = await db.email_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

    # Ad revenue from ledger
    ledger = await db.admin_ledger.find({"type": "platform_services", "subtype": {"$in": AD_SUBTYPES}}, {"_id": 0}).to_list(100000)
    revenue_by_type = {st: 0.0 for st in AD_SUBTYPES}
    total_revenue = 0.0
    for e in ledger:
        st = e.get("subtype")
        amt = e.get("amount", 0) or 0
        if st in revenue_by_type:
            revenue_by_type[st] = round(revenue_by_type[st] + amt, 2)
        total_revenue = round(total_revenue + amt, 2)

    total_clicks = sum(c.get("clicks", 0) for c in campaigns)
    total_emails = sum(c.get("emails_sent", 0) for c in campaigns)
    sponsorships = await db.event_sponsorships.count_documents({})

    return {
        "settings": settings,
        "revenue": {
            "total": total_revenue,
            "by_type": revenue_by_type,
        },
        "stats": {
            "total_campaigns": len(campaigns),
            "active_campaigns": sum(1 for c in campaigns if c.get("status") == "active"),
            "blast_campaigns": sum(1 for c in campaigns if c.get("type") == "blast"),
            "ppc_campaigns": sum(1 for c in campaigns if c.get("type") == "ppc"),
            "total_clicks": total_clicks,
            "total_emails_sent": total_emails,
            "total_sponsorships": sponsorships,
        },
        "recent_campaigns": campaigns[:10],
    }


@router.put("/admin/advertising/settings")
async def admin_ads_update_settings(body: Dict, admin: Dict = Depends(require_admin)):
    allowed = [
        "ads_enabled",
        "email_campaigns_enabled", "ppc_campaigns_enabled", "banner_campaigns_enabled",
        "email_price_per_email", "ppc_price_per_click", "ppc_min_wallet_to_start",
        "event_sponsorship_default_price",
    ]
    update = {}
    bool_fields = {"ads_enabled", "email_campaigns_enabled", "ppc_campaigns_enabled", "banner_campaigns_enabled"}
    for k in allowed:
        if k in body and body[k] is not None:
            if k in bool_fields:
                update[k] = bool(body[k])
            else:
                try:
                    update[k] = float(body[k])
                except (TypeError, ValueError):
                    continue
    if not update:
        raise HTTPException(status_code=400, detail="No valid settings to update")
    await db.platform_settings.update_one({"id": "platform"}, {"$set": update}, upsert=True)
    return {"message": "Advertising settings updated", "settings": await get_ad_settings()}


@router.get("/admin/advertising/campaigns")
async def admin_ads_campaigns(type: Optional[str] = None, status: Optional[str] = None, shop_id: Optional[str] = None, admin: Dict = Depends(require_admin)):
    q = {}
    if type:
        q["type"] = type
    if status:
        q["status"] = status
    if shop_id:
        q["shop_id"] = shop_id
    campaigns = await db.email_campaigns.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"campaigns": campaigns}


@router.get("/admin/advertising/events")
async def admin_ads_events(admin: Dict = Depends(require_admin)):
    settings = await get_ad_settings()
    events = await db.admin_events.find({"display_mode": "home_banner"}, {"_id": 0}).sort("banner_order", 1).to_list(200)
    out = []
    now = datetime.now(timezone.utc)
    for e in events:
        sponsors = e.get("sponsoring_shops") or []
        current = e.get("current_sponsor") or None
        is_reserved = False
        reserved_until = None
        if current:
            try:
                end_at = datetime.fromisoformat(current.get("end_at", ""))
                if end_at > now:
                    is_reserved = True
                    reserved_until = current.get("end_at")
                else:
                    await db.admin_events.update_one({"id": e["id"]}, {"$set": {"current_sponsor": None}})
                    current = None
            except Exception:
                current = None
        price_per_day = float(e.get("sponsorship_price_per_day") or e.get("sponsorship_price") or settings["event_sponsorship_default_price"])
        out.append({
            "id": e["id"], "title": e.get("title", ""),
            "banner_subtitle": e.get("banner_subtitle", ""),
            "image_url": e.get("image_url", ""),
            "is_active": e.get("is_active", True),
            "sponsorship_enabled": e.get("sponsorship_enabled", False),
            "sponsorship_price_per_day": price_per_day,
            "sponsorship_price": price_per_day,
            "sponsors": sponsors,
            "sponsors_count": len(sponsors),
            "current_sponsor": current,
            "is_reserved": is_reserved,
            "reserved_until": reserved_until,
            "revenue": round(sum(s.get("amount", 0) for s in sponsors), 2),
        })
    return {"events": out}


@router.put("/admin/advertising/events/{event_id}/sponsorship")
async def admin_ads_event_sponsorship(event_id: str, body: Dict, admin: Dict = Depends(require_admin)):
    update = {}
    if "sponsorship_enabled" in body:
        update["sponsorship_enabled"] = bool(body["sponsorship_enabled"])
    # accept both sponsorship_price and sponsorship_price_per_day (per-day pricing)
    if "sponsorship_price_per_day" in body and body["sponsorship_price_per_day"] is not None:
        try:
            v = float(body["sponsorship_price_per_day"])
            update["sponsorship_price_per_day"] = v
            update["sponsorship_price"] = v  # backward compat
        except (TypeError, ValueError):
            pass
    elif "sponsorship_price" in body and body["sponsorship_price"] is not None:
        try:
            v = float(body["sponsorship_price"])
            update["sponsorship_price"] = v
            update["sponsorship_price_per_day"] = v
        except (TypeError, ValueError):
            pass
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.admin_events.find_one_and_update(
        {"id": event_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event sponsorship updated", "event": result}


@router.delete("/admin/advertising/events/{event_id}/sponsor")
async def admin_ads_remove_sponsor(event_id: str, body: Dict = None, admin: Dict = Depends(require_admin)):
    """Admin can remove the current sponsor from a banner.
    This frees the banner for other shops to sponsor again (no refund issued).
    """
    body = body or {}
    event = await db.admin_events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    current = event.get("current_sponsor") or None
    if not current:
        raise HTTPException(status_code=400, detail="There is no active sponsor on this banner")
    
    shop_id = current.get("shop_id")
    shop_name = current.get("shop_name") or ""
    now = datetime.now(timezone.utc)
    
    # Mark removal in the sponsoring_shops list
    sponsors = event.get("sponsoring_shops") or []
    new_sponsors = []
    for s in sponsors:
        if s.get("shop_id") == shop_id and s.get("end_at") == current.get("end_at"):
            s = {**s, "removed_by_admin": True, "removed_at": now.isoformat()}
        new_sponsors.append(s)
    
    await db.admin_events.update_one(
        {"id": event_id},
        {"$set": {"current_sponsor": None, "sponsoring_shops": new_sponsors}},
    )
    
    # Notify the shop owner
    try:
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "user_id": 1, "name": 1})
        if shop and shop.get("user_id"):
            await create_notification(
                "shop",
                "Banner Sponsorship Removed",
                f"Admin removed your sponsorship from '{event.get('title','')}'. Please contact support if you have any questions.",
                "ads",
                "/shop/advertising",
                shop_id,
            )
    except Exception:
        pass
    
    return {"message": f"Removed {shop_name} from '{event.get('title','')}' banner"}


@router.get("/admin/advertising/clicks")
async def admin_ads_clicks(limit: int = 100, admin: Dict = Depends(require_admin)):
    clicks = await db.email_clicks.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"clicks": clicks}
