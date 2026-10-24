"""
Email service functions for sending notification emails.
"""
import smtplib
import re
import html as _html_mod
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid, formataddr
import asyncio
import os
from datetime import datetime, timezone

from config import db, logger, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SENDER_EMAIL, SENDER_NAME


def _html_to_text(html_content: str) -> str:
    """Best-effort conversion of HTML to a readable plain-text alternative."""
    if not html_content:
        return ""
    text = html_content
    # Turn links into "text (url)"
    text = re.sub(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', r'\2 (\1)', text, flags=re.I | re.S)
    # Line breaks for common block elements
    text = re.sub(r'<\s*(br|/p|/div|/tr|/h[1-6])\s*/?>', '\n', text, flags=re.I)
    # Strip remaining tags
    text = re.sub(r'<[^>]+>', '', text)
    text = _html_mod.unescape(text)
    # Collapse excessive whitespace
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def _build_message(to_email: str, subject: str, html_content: str, to_name: str = None) -> MIMEMultipart:
    """Build a spam-resistant multipart email message (no network I/O)."""
    msg = MIMEMultipart('alternative')
    msg['From'] = formataddr((SENDER_NAME, SENDER_EMAIL))
    # Use formataddr for "To" with display name when available — helps inbox placement
    msg['To'] = formataddr((to_name, to_email)) if to_name else to_email
    msg['Subject'] = subject
    # Standard transactional headers that help inbox placement (avoid bulk-sender flags)
    msg['Reply-To'] = formataddr((SENDER_NAME, SENDER_EMAIL))
    msg['Return-Path'] = SENDER_EMAIL
    msg['Date'] = formatdate(localtime=True)
    try:
        msg['Message-ID'] = make_msgid(domain=SENDER_EMAIL.split('@')[-1])
    except Exception:
        msg['Message-ID'] = make_msgid()
    msg['MIME-Version'] = '1.0'
    msg['Content-Language'] = 'en-US'
    msg['X-Mailer'] = 'OpenMarket Lebanon'
    msg['X-Priority'] = '3'
    msg['X-MSMail-Priority'] = 'Normal'
    msg['Importance'] = 'Normal'
    # List-Unsubscribe (RFC 8058). Only emit the HTTP one-click variant when we have a
    # REAL public https URL — a localhost / http / non-resolving unsubscribe link is a
    # broken endpoint that Gmail probes and penalizes (routes to Spam). Fall back to the
    # always-valid mailto: form otherwise.
    _base = (os.environ.get("PUBLIC_URL") or os.environ.get("FRONTEND_URL") or "").rstrip("/")
    _is_public = _base.startswith("https://") and "localhost" not in _base and "127.0.0.1" not in _base
    from urllib.parse import quote
    _unsub_mailto = f"<mailto:{SENDER_EMAIL}?subject=Unsubscribe>"
    if _is_public:
        _unsub_http = f"<{_base}/api/ads/unsubscribe?e={quote(to_email)}>"
        msg['List-Unsubscribe'] = f"{_unsub_http}, {_unsub_mailto}"
        msg['List-Unsubscribe-Post'] = "List-Unsubscribe=One-Click"
    else:
        msg['List-Unsubscribe'] = _unsub_mailto

    # Always include BOTH a plain-text and an HTML part. A multipart message with
    # only an HTML body is a strong spam signal; the text part fixes that.
    plain_text = _html_to_text(html_content) or "Open this email in an HTML-capable client to view it."
    # Ensure plain text has some substance — empty/very short plain bodies look spammy
    if len(plain_text) < 50:
        plain_text = (plain_text + "\n\n--\nOpenMarket Lebanon\nhttps://openmarketlb.com").strip()
    msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))
    return msg


def _smtp_connect():
    """Open + authenticate a Gmail SMTP connection."""
    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(SMTP_USER, SMTP_PASS)
    return server


def _send_smtp_email(to_email: str, subject: str, html_content: str, to_name: str = None):
    """Send a single email via Gmail SMTP (blocking - run in thread)."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning(f"Email not sent (no SMTP credentials): {subject} to {to_email}")
        return None
    msg = _build_message(to_email, subject, html_content, to_name)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        # Use authenticated SMTP_USER as envelope sender (must match for DMARC)
        server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
    return True


def _send_smtp_bulk(messages, reconnect_every: int = 50):
    """Send many emails over ONE reused SMTP connection (one login for the whole
    batch). Reconnecting + logging in per email is ~10s each on Gmail and triggers
    throttling; reusing the connection cuts that to a fraction and is the difference
    between a 100-recipient campaign taking 17 minutes vs. well under a minute.

    `messages`: list of {to_email, subject, html, to_name}.
    Returns {to_email: bool}.
    """
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("Bulk email not sent (no SMTP credentials)")
        return {m.get("to_email"): False for m in messages}

    results = {}
    server = None
    sent_since_connect = 0
    try:
        server = _smtp_connect()
        for m in messages:
            to_email = m.get("to_email")
            if not to_email:
                continue
            try:
                # Periodically refresh the connection — Gmail can drop long-lived sessions.
                if sent_since_connect >= reconnect_every:
                    try:
                        server.quit()
                    except Exception:
                        pass
                    server = _smtp_connect()
                    sent_since_connect = 0
                msg = _build_message(to_email, m.get("subject", ""), m.get("html", ""), m.get("to_name"))
                server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
                results[to_email] = True
                sent_since_connect += 1
            except (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError):
                # Connection died — reconnect once and retry this recipient.
                try:
                    server = _smtp_connect()
                    sent_since_connect = 0
                    msg = _build_message(to_email, m.get("subject", ""), m.get("html", ""), m.get("to_name"))
                    server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
                    results[to_email] = True
                    sent_since_connect += 1
                except Exception as e:
                    logger.error(f"Bulk email failed for {to_email}: {e}")
                    results[to_email] = False
            except Exception as e:
                logger.error(f"Bulk email failed for {to_email}: {e}")
                results[to_email] = False
    except Exception as e:
        logger.error(f"Bulk email connection error: {e}")
        for m in messages:
            results.setdefault(m.get("to_email"), False)
    finally:
        if server is not None:
            try:
                server.quit()
            except Exception:
                pass
    return results


async def send_bulk_emails_async(messages):
    """Async wrapper around _send_smtp_bulk. Returns {to_email: bool}."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("Bulk email not sent (no SMTP credentials)")
        return {}
    results = await asyncio.to_thread(_send_smtp_bulk, messages)
    ok = sum(1 for v in results.values() if v)
    logger.info(f"Bulk email finished: {ok}/{len(messages)} sent")
    return results


async def send_email_async(to_email: str, subject: str, html_content: str, to_name: str = None):
    """Send email asynchronously via Gmail SMTP"""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning(f"Email not sent (no SMTP credentials): {subject} to {to_email}")
        return None
    
    try:
        result = await asyncio.to_thread(_send_smtp_email, to_email, subject, html_content, to_name)
        logger.info(f"Email sent successfully to {to_email}: {subject}")
        return result
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return None


async def send_order_confirmation_email(order: dict):
    """Send order confirmation email with Order ID"""
    email = order.get("guest_email") or order.get("customer_email")
    if not email:
        logger.warning(f"No email found for order {order.get('id')}")
        return
    
    customer_name = order.get("guest_name") or order.get("customer_name") or "Customer"
    order_id = order.get("id")
    total = order.get("total_amount", 0)
    items = order.get("items", [])
    
    items_html = ""
    for item in items:
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{item.get('name', 'Product')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">{item.get('quantity', 1)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.get('subtotal', 0):.2f}</td>
        </tr>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <tr>
                <td style="background: linear-gradient(to right, #7c3aed, #4f46e5); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Order Confirmed!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px;">
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Hi {customer_name},</p>
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Thank you for your order! Here are your order details:</p>
                    
                    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Order ID:</p>
                        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #7c3aed; font-family: monospace;">{order_id}</p>
                    </div>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #f9fafb;">
                                <th style="padding: 12px; text-align: left; font-size: 14px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Product</th>
                                <th style="padding: 12px; text-align: center; font-size: 14px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Qty</th>
                                <th style="padding: 12px; text-align: right; font-size: 14px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2" style="padding: 15px; text-align: right; font-weight: bold; font-size: 16px;">Total:</td>
                                <td style="padding: 15px; text-align: right; font-weight: bold; font-size: 18px; color: #10b981;">${total:.2f}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">You can track your order anytime using your Order ID on our website.</p>
                    
                    <p style="font-size: 14px; color: #374151; margin-top: 30px;">Thank you for shopping with us!</p>
                    <p style="font-size: 14px; color: #374151; margin-bottom: 0;">The OpenMarketlb Team</p>
                </td>
            </tr>
            <tr>
                <td style="background-color: #f9fafb; padding: 20px; text-align: center;">
                    <p style="font-size: 12px; color: #9ca3af; margin: 0;">© 2026 OpenMarketlb. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    await send_email_async(email, f"Order Confirmed - {order_id[:8]}...", html_content)


async def send_subscription_confirmation_email(shop: dict, payment_method: str):
    """Send subscription confirmation email to shop owner"""
    # Get shop owner email
    owner = await db.users.find_one({"shop_id": shop.get("id")}, {"_id": 0, "email": 1, "name": 1})
    if not owner:
        logger.warning(f"No owner found for shop {shop.get('id')}")
        return
    
    email = owner.get("email")
    owner_name = owner.get("name", "Shop Owner")
    shop_name = shop.get("name", "Your Shop")
    subscription_status = shop.get("subscription_status", "active")
    
    status_text = "Your subscription is now active!" if subscription_status == "active" else "Your subscription request has been received and is pending admin approval."
    payment_text = "via card payment" if payment_method == "card" else "via manual request"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <tr>
                <td style="background: linear-gradient(to right, #10b981, #059669); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 Subscription {subscription_status.title()}!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px;">
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Hi {owner_name},</p>
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">{status_text}</p>
                    
                    <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #059669; font-weight: bold;">Shop Details</p>
                        <p style="margin: 0 0 5px 0; font-size: 16px; color: #374151;"><strong>Shop Name:</strong> {shop_name}</p>
                        <p style="margin: 0 0 5px 0; font-size: 16px; color: #374151;"><strong>Payment Method:</strong> {payment_text.title()}</p>
                        <p style="margin: 0; font-size: 16px; color: #374151;"><strong>Status:</strong> {subscription_status.title()}</p>
                    </div>
                    
                    {"<p style='font-size: 14px; color: #6b7280; margin-bottom: 20px;'>You can now start adding products and managing your shop from the seller dashboard.</p>" if subscription_status == "active" else "<p style='font-size: 14px; color: #6b7280; margin-bottom: 20px;'>Our admin team will review your request shortly. You will receive another email once your subscription is approved.</p>"}
                    
                    <p style="font-size: 14px; color: #374151; margin-top: 30px;">Welcome to OpenMarketlb!</p>
                    <p style="font-size: 14px; color: #374151; margin-bottom: 0;">The OpenMarketlb Team</p>
                </td>
            </tr>
            <tr>
                <td style="background-color: #f9fafb; padding: 20px; text-align: center;">
                    <p style="font-size: 12px; color: #9ca3af; margin: 0;">© 2026 OpenMarketlb. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    await send_email_async(email, f"Subscription {subscription_status.title()} - {shop_name}", html_content)


async def send_manual_subscription_request_email(shop: dict, user: dict):
    """Send email when shop requests manual subscription"""
    email = user.get("email")
    owner_name = user.get("name", "Shop Owner")
    shop_name = shop.name if hasattr(shop, 'name') else shop.get("name", "Your Shop")
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <tr>
                <td style="background: linear-gradient(to right, #f59e0b, #d97706); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Subscription Request Received</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px;">
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Hi {owner_name},</p>
                    <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Your subscription request for <strong>{shop_name}</strong> has been received!</p>
                    
                    <div style="background-color: #fffbeb; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e; font-weight: bold;">What's Next?</p>
                        <p style="margin: 0; font-size: 14px; color: #374151;">Our admin team will review your request. Once approved, you'll receive a confirmation email and can start managing your shop.</p>
                    </div>
                    
                    <p style="font-size: 14px; color: #374151; margin-top: 30px;">Thank you for choosing OpenMarketlb!</p>
                    <p style="font-size: 14px; color: #374151; margin-bottom: 0;">The OpenMarketlb Team</p>
                </td>
            </tr>
            <tr>
                <td style="background-color: #f9fafb; padding: 20px; text-align: center;">
                    <p style="font-size: 12px; color: #9ca3af; margin: 0;">© 2026 OpenMarketlb. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    await send_email_async(email, f"Subscription Request Received - {shop_name}", html_content)


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email using Gmail SMTP"""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP credentials not configured, skipping email")
        return False
    
    try:
        await asyncio.to_thread(_send_smtp_email, to_email, subject, html_content)
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


async def send_subscription_email(shop_email: str, shop_name: str, event_type: str, details: dict = None):
    """Send subscription-related emails"""
    templates = {
        "activated": {
            "subject": f"Your OpenMarketlb Subscription is Active - {shop_name}",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #10b981;">Welcome to OpenMarketlb!</h1>
                <p>Great news! Your subscription for <strong>{shop_name}</strong> has been activated.</p>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p><strong>Subscription Details:</strong></p>
                    <p>Valid until: <strong>{details.get('expires', 'N/A')}</strong></p>
                    <p>Amount paid: <strong>${details.get('amount', 29)}</strong></p>
                </div>
                <p>You can now:</p>
                <ul>
                    <li>Add and manage your products</li>
                    <li>Receive and process orders</li>
                    <li>Track your sales and revenue</li>
                </ul>
                <p>Log in to your shop dashboard to get started!</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Thank you for choosing OpenMarketlb.</p>
            </div>
            """
        },
        "payment_confirmed": {
            "subject": f"Payment Confirmed - {shop_name} Subscription",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #10b981;">Payment Successful!</h1>
                <p>Your payment for <strong>{shop_name}</strong> has been confirmed.</p>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p><strong>Receipt:</strong></p>
                    <p>Amount: <strong>${details.get('amount', 29)}</strong></p>
                    <p>Duration: <strong>{details.get('months', 1)} month(s)</strong></p>
                    <p>Valid until: <strong>{details.get('expires', 'N/A')}</strong></p>
                </div>
                <p>Your shop is now active and ready to sell!</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Thank you for your payment.</p>
            </div>
            """
        },
        "expired": {
            "subject": f"Subscription Expired - {shop_name}",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #f59e0b;">Subscription Expired</h1>
                <p>Your subscription for <strong>{shop_name}</strong> has expired.</p>
                <div style="background: #fffbeb; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p><strong>What this means:</strong></p>
                    <ul>
                        <li>Your products are no longer visible to customers</li>
                        <li>You cannot add new products</li>
                        <li>Existing orders can still be fulfilled</li>
                    </ul>
                </div>
                <p>To reactivate your shop, please renew your subscription.</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">We hope to see you back soon!</p>
            </div>
            """
        },
        "cancelled": {
            "subject": f"Subscription Cancelled - {shop_name}",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #ef4444;">Subscription Cancelled</h1>
                <p>Your subscription for <strong>{shop_name}</strong> has been cancelled.</p>
                <p>Your products will no longer be visible to customers.</p>
                <p>If you believe this was a mistake, please contact our support team.</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">We're sorry to see you go.</p>
            </div>
            """
        },
        "approved": {
            "subject": f"Shop Approved - {shop_name}",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #10b981;">Congratulations! Your Shop is Approved!</h1>
                <p>Your shop <strong>{shop_name}</strong> has been approved by our admin team.</p>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p><strong>Next Steps:</strong></p>
                    <ol>
                        <li>Log in to your account</li>
                        <li>Subscribe to start selling (${details.get('price', 29)}/month)</li>
                        <li>Add your products</li>
                        <li>Start receiving orders!</li>
                    </ol>
                </div>
                <p>You have a <strong>{details.get('trial_days', 7)}-day free trial</strong> to get started!</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Welcome to the OpenMarketlb marketplace!</p>
            </div>
            """
        },
        "suspended": {
            "subject": f"Shop Suspended - {shop_name}",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #ef4444;">Shop Suspended</h1>
                <p>Your shop <strong>{shop_name}</strong> has been suspended.</p>
                <p>Your products are no longer visible to customers.</p>
                <p>If you believe this was a mistake, please contact our support team.</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">OpenMarketlb Team</p>
            </div>
            """
        }
    }
    
    template = templates.get(event_type)
    if template:
        await send_email(shop_email, template["subject"], template["html"])


async def send_card_subscription_success_email(shop: dict, user: dict, price: float, subscription_end: datetime):
    """Send email after successful card payment subscription"""
    shop_email = shop.get("email") or user.get("email")
    shop_name = shop.get("name")
    expires = subscription_end.strftime("%B %d, %Y")
    
    subject = f"🎉 Payment Successful - {shop_name} is Now Active!"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #10b981;">🎉 Your Shop is Live!</h1>
        <p>Congratulations! Your payment has been processed successfully and <strong>{shop_name}</strong> is now active on OpenMarketlb.</p>
        
        <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin-top: 0; color: #059669;">Subscription Details</h3>
            <p><strong>Amount Paid:</strong> ${price}/month</p>
            <p><strong>Valid Until:</strong> {expires}</p>
            <p><strong>Payment Method:</strong> Credit Card (Stripe)</p>
        </div>
        
        <div style="background: #eff6ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">What's Next?</h3>
            <ul style="padding-left: 20px;">
                <li>✅ Add your products to the shop</li>
                <li>✅ Set up your shop profile and branding</li>
                <li>✅ Start receiving orders from customers</li>
                <li>✅ Track your sales and revenue in the dashboard</li>
            </ul>
        </div>
        
        <p>
            <a href="{os.environ.get('FRONTEND_URL', 'https://state-shops-finder.preview.emergentagent.com')}/shop/dashboard" 
               style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Go to Dashboard →
            </a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for choosing OpenMarketlb! If you have any questions, feel free to reach out to our support team.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">OpenMarketlb Marketplace Team</p>
    </div>
    """
    
    await send_email(shop_email, subject, html)


async def send_manual_subscription_request_email(shop: dict, user: dict):
    """Send email to shop owner after manual subscription request"""
    shop_email = shop.get("email") or user.get("email")
    shop_name = shop.get("name")
    
    subject = f"Subscription Request Received - {shop_name}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #10b981;">Request Received!</h1>
        <p>Thank you for registering <strong>{shop_name}</strong> on OpenMarketlb.</p>
        
        <div style="background: #fffbeb; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #b45309;">⏳ Pending Admin Approval</h3>
            <p>Your manual subscription request is currently under review by our admin team.</p>
            <p><strong>What happens next:</strong></p>
            <ul style="padding-left: 20px;">
                <li>Our team will review your shop details</li>
                <li>You'll receive an email once approved</li>
                <li>After approval, you can start adding products</li>
            </ul>
        </div>
        
        <p style="background: #f3f4f6; padding: 15px; border-radius: 6px; font-size: 14px;">
            💡 <strong>Want instant access?</strong> You can also subscribe with a credit card for immediate activation!
        </p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            We typically review requests within 24-48 hours. Thank you for your patience!
        </p>
        <p style="color: #9ca3af; font-size: 12px;">OpenMarketlb Marketplace Team</p>
    </div>
    """
    
    await send_email(shop_email, subject, html)


async def send_order_status_email(email: str, order_id: str, new_status: str, order_details: dict = None):
    """Send order status update email to customer"""
    status_messages = {
        "processing": ("Your Order is Being Processed", "We're preparing your order for shipment.", "#3b82f6"),
        "shipped": ("Your Order Has Been Shipped!", "Your order is on its way to you.", "#8b5cf6"),
        "delivered": ("Your Order Has Been Delivered!", "Your order has been successfully delivered.", "#10b981"),
        "cancelled": ("Your Order Has Been Cancelled", "Your order has been cancelled.", "#ef4444"),
    }
    
    message_data = status_messages.get(new_status.lower())
    if not message_data:
        return
    
    title, message, color = message_data
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: {color}; margin: 0;">{title}</h1>
            <p style="color: #64748b; margin-top: 10px;">Order #{order_id[:8]}</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border-left: 4px solid {color};">
            <p style="margin: 0; color: #334155;">{message}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 14px;">Thank you for shopping with OpenMarketlb!</p>
        </div>
    </div>
    """
    
    await send_email(email, f"{title} - Order #{order_id[:8]}", html_content)
