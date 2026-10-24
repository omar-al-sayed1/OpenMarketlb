"""
OpenMarket Lebanon - Shop Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
import uuid, bcrypt, hashlib, random, os, asyncio, shutil, json
from pathlib import Path

from config import db, logger, UPLOADS_DIR, STRIPE_SECRET_KEY, ROOT_DIR, JWT_SECRET, JWT_ALGORITHM, client, SMTP_USER, SMTP_PASS
from auth import create_token, verify_token, get_current_user, require_auth, require_admin, require_shop, require_delivery, require_shop_or_admin, security
from models import *
from services.helpers import create_notification, get_commission_rate, get_customer_markup_factor, get_shop_commission_info, get_shop_revenue_factor, parse_datetime_aware, seed_storefront_themes

try:
    from services.email_service import send_email_async, send_order_confirmation_email, send_subscription_confirmation_email, send_manual_subscription_request_email, send_email, send_subscription_email, send_card_subscription_success_email, send_order_status_email
except ImportError:
    pass

try:
    from services.otp_service import create_and_send_otp, verify_otp_code, is_phone_recently_verified
except ImportError:
    pass

try:
    import stripe
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
    stripe.api_key = STRIPE_SECRET_KEY
except ImportError:
    pass

try:
    import httpx
except ImportError:
    pass

router = APIRouter()


async def _attach_referral_to_application(application: dict, referral_code: Optional[str]) -> dict:
    """If a valid agent referral code is provided, attach agent attribution to a
    guest shop application so the agent is credited when the shop is approved.

    Mutates and returns the application dict. No-op if code is missing/invalid.
    """
    code = (referral_code or "").strip()
    if not code:
        return application
    try:
        from services.referral_helpers import get_agent_by_referral_code
        # Try exact, then upper-cased (codes are stored upper-case like OMAR-IKL2L)
        agent = await get_agent_by_referral_code(code)
        if not agent:
            agent = await get_agent_by_referral_code(code.upper())
        if agent:
            application["referral_code"] = agent.get("referral_code") or code
            application["referred_by_agent_id"] = agent.get("id")
            application["referred_by_agent_name"] = agent.get("name")
            application["submitted_via"] = application.get("submitted_via") or "referral_link"
    except Exception as _e:
        logger.error(f"Failed to attach referral code '{code}' to application: {_e}")
    return application



def parse_datetime_aware(dt_string: str):
    """Parse datetime string and ensure it's timezone-aware (UTC)"""
    if not dt_string:
        return None
    try:
        # Replace 'Z' with '+00:00' for ISO format compatibility
        dt_string = dt_string.replace('Z', '+00:00')
        parsed = datetime.fromisoformat(dt_string)
        # If naive (no timezone), assume UTC
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


@router.post("/shop/register")
async def register_shop(shop_data: ShopCreate, user: Dict = Depends(require_auth)):
    """Register as a seller (logged-in user). Creates a Guest Shop Application
    flagged as a logged-in applicant for admin review. No shop is created until the
    admin approves — at which point the existing user account is upgraded to a shop
    (no password needed)."""
    # Validate required fields
    if not shop_data.name or not shop_data.name.strip():
        raise HTTPException(status_code=400, detail="Shop name is required")
    if not shop_data.phone or not shop_data.phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required")
    if not shop_data.address or not shop_data.address.strip():
        raise HTTPException(status_code=400, detail="Address is required")
    if not shop_data.state or not shop_data.state.strip():
        raise HTTPException(status_code=400, detail="State is required")

    # Check if user already has a shop
    existing_shop = await db.shops.find_one({"user_id": user["user_id"]})
    if existing_shop:
        raise HTTPException(status_code=400, detail="You already have a shop registered")

    # Check if user already has a pending application
    existing_app = await db.guest_shop_applications.find_one(
        {"user_id": user["user_id"], "status": "pending"}
    )
    if existing_app:
        raise HTTPException(status_code=400, detail="You already have a pending shop application under review")

    user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    applicant_email = (shop_data.email or (user_doc or {}).get("email") or user.get("email") or "").strip()
    applicant_name = (user_doc or {}).get("name") or applicant_email

    application = {
        "id": str(uuid.uuid4()),
        "guest_name": applicant_name,
        "email": applicant_email,
        "shop_name": shop_data.name,
        "description": shop_data.description or "",
        "logo": shop_data.logo or "",
        "phone": shop_data.phone,
        "address": shop_data.address,
        "state": shop_data.state,
        "category_ids": shop_data.category_ids or [],
        "status": "pending",
        "is_logged_in_user": True,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Capture referral attribution if the user came via an agent's referral link (?ref=CODE)
    await _attach_referral_to_application(application, shop_data.referral_code)
    await db.guest_shop_applications.insert_one(application)

    # Notify admin about the new seller application
    await create_notification(
        "admin",
        "New Shop Application",
        f"'{shop_data.name}' (logged-in user: {applicant_email}) has applied to become a seller — awaiting your review.",
        "subscription",
        "/admin/shops"
    )

    # User role stays "user" until admin approves the application
    return {"message": "Application sent to admin. You will receive an update once reviewed.", "status": "pending"}


@router.post("/shop/register-guest")
async def register_shop_guest(request: Request):
    """Guest shop registration - stores application for admin review without requiring login"""
    body = await request.json()
    
    name = (body.get("name") or "").strip()
    phone = (body.get("phone") or "").strip()
    address = (body.get("address") or "").strip()
    state = (body.get("state") or "").strip()
    email = (body.get("email") or "").strip()
    description = (body.get("description") or "").strip()
    logo = body.get("logo") or ""
    guest_name = (body.get("guest_name") or "").strip()
    category_ids = body.get("category_ids") or []
    if not isinstance(category_ids, list):
        category_ids = []
    wants_subscription = bool(body.get("wants_subscription"))
    
    if not name:
        raise HTTPException(status_code=400, detail="Shop name is required")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    if not address:
        raise HTTPException(status_code=400, detail="Address is required")
    if not state:
        raise HTTPException(status_code=400, detail="State is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Check if email already has a pending application
    existing = await db.guest_shop_applications.find_one({"email": email, "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="An application with this email is already pending review")
    
    application = {
        "id": str(uuid.uuid4()),
        "guest_name": guest_name,
        "email": email,
        "shop_name": name,
        "description": description,
        "logo": logo,
        "phone": phone,
        "address": address,
        "state": state,
        "category_ids": category_ids,
        "wants_subscription": wants_subscription,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Capture referral attribution if the guest came via an agent's referral link (?ref=CODE)
    await _attach_referral_to_application(application, body.get("referral_code"))
    await db.guest_shop_applications.insert_one(application)
    
    # Notify admin
    await create_notification(
        "admin",
        "New Guest Shop Application",
        f"'{name}' (guest: {email}) has applied to become a seller.",
        "subscription",
        "/admin/shops"
    )
    
    return {"message": "Application submitted! Our team will review and contact you via email.", "status": "pending"}


@router.get("/shop/profile")
async def get_shop_profile(user: Dict = Depends(require_shop)):
    """Get current shop's profile with tier info"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    # Grant monthly subscription perks (free spin + sponsor credits) if a new cycle is due
    from services.helpers import grant_monthly_subscription_benefits
    shop = await grant_monthly_subscription_benefits(shop)

    # Ensure tier defaults
    if "tier" not in shop:
        shop["tier"] = "starter"
    
    # Get tier config
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if settings:
        tiers = settings.get("tiers", {})
        tier_config = tiers.get(shop.get("tier", "starter"), {})
        shop["tier_badge"] = tier_config.get("badge", "")
        shop["tier_commission_rate"] = tier_config.get("commission_rate", 10)
        shop["tier_product_limit"] = tier_config.get("product_limit", 50)
    
    return shop


@router.put("/shop/profile")
async def update_shop_profile(shop_data: ShopUpdate, user: Dict = Depends(require_shop)):
    """Update shop profile"""
    update_fields = {k: v for k, v in shop_data.model_dump().items() if v is not None}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.shops.find_one_and_update(
        {"user_id": user["user_id"]},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0}
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Shop not found")
    return result


@router.get("/shop/subscription")
async def get_shop_subscription(user: Dict = Depends(require_shop)):
    """Get shop subscription status"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    
    # Check if subscription is expired
    subscription_status = shop.get("subscription_status", "none")
    subscription_end = shop.get("subscription_end")
    is_expired = False
    
    if subscription_end and subscription_status in ["active", "trial"]:
        end_date = parse_datetime_aware(subscription_end)
        if end_date and end_date < datetime.now(timezone.utc):
            is_expired = True
            # Update status in DB
            await db.shops.update_one(
                {"id": shop["id"]},
                {"$set": {"subscription_status": "expired"}}
            )
            subscription_status = "expired"
            from services.helpers import mark_subscription_ended
            await mark_subscription_ended(shop, "expired")

    return {
        "subscription_status": subscription_status,
        "subscription_required": shop.get("subscription_required", True),
        "subscription_start": shop.get("subscription_start"),
        "subscription_end": subscription_end,
        "is_expired": is_expired,
        "shop_status": shop.get("status"),
        "shop_name": shop.get("name"),
        "shop_id": shop.get("id"),
        "tier": shop.get("tier", "starter"),
        "price": platform_settings.get("subscription_price", 29.0) if platform_settings else 29.0,
        "trial_days": platform_settings.get("trial_days", 7) if platform_settings else 7,
        "tiers": platform_settings.get("tiers", {}) if platform_settings else {}
    }


@router.get("/shop/welcome-popup")
async def get_shop_welcome_popup(user: Dict = Depends(require_shop)):
    """First-login welcome popup content for a shop.

    Returns whether the popup should be shown (only until dismissed once), the
    shop's subscribed status, the welcome gift they received on approval
    ($2 wallet + 1 free sponsor for non-referred), and the subscription plan
    features. The frontend shows a subscribed-vs-not variant based on `is_subscribed`.
    """
    from services.helpers import get_welcome_bonus, is_shop_subscribed
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0}) or {}
    is_referred = bool(shop.get("referred_by_agent_id"))
    welcome = get_welcome_bonus(is_referred, platform_settings)
    cfg = await get_subscription_config(platform_settings)

    # Only show once — until the shop dismisses it. Also require the shop to be
    # approved (welcome bonus granted) so we don't greet pending applications.
    show = not bool(shop.get("first_login_welcome_seen")) and bool(shop.get("welcome_bonus_granted"))

    return {
        "show": show,
        "is_subscribed": is_shop_subscribed(shop),
        "shop_name": shop.get("name", ""),
        "welcome_bonus": {
            "wallet": welcome["wallet"],
            "sponsors": welcome["sponsors"],
            "summary": welcome["summary"],
        },
        "plan_name": cfg["name"],
        "features": cfg["features"],
    }


@router.post("/shop/welcome-popup/dismiss")
async def dismiss_shop_welcome_popup(user: Dict = Depends(require_shop)):
    """Mark the first-login welcome popup as seen so it never shows again."""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {"first_login_welcome_seen": True, "first_login_welcome_seen_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": "ok"}


@router.post("/shop/renew-subscription")
async def renew_shop_subscription(user: Dict = Depends(require_shop)):
    """Renew an active/expired subscription for +30 days, paid from the shop wallet.

    Extends from the current subscription end (so remaining days aren't lost) when
    still active; otherwise starts 30 days from now. Requires enough wallet balance.
    """
    from services.helpers import grant_monthly_subscription_benefits
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    cfg = await get_subscription_config(platform_settings)
    price = round(float(cfg["monthly_price"] or 0), 2)

    balance = float(shop.get("wallet_balance", 0) or 0)
    if balance < price:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Renewal costs ${price:.2f} but you have ${balance:.2f}.")

    now = datetime.now(timezone.utc)
    # Extend from current end if it's still in the future, else from now
    current_end = parse_datetime_aware(shop.get("subscription_end"))
    base = current_end if (current_end and current_end > now) else now
    new_end = base + timedelta(days=30)
    new_balance = round(balance - price, 2)

    await db.shops.update_one({"id": shop["id"]}, {"$set": {
        "wallet_balance": new_balance,
        "subscription_status": "active",
        "subscription_required": True,
        "subscription_end": new_end.isoformat(),
        "subscription_price_paid": price,
        "payment_method": "wallet",
        "tier": "pro",
    }})
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()), "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "type": "subscription_payment", "amount": -price, "balance_after": new_balance,
        "status": "completed", "note": "Subscription renewal (+30 days) via wallet",
        "created_at": now.isoformat(),
    })
    await db.subscription_payments.insert_one({
        "id": str(uuid.uuid4()), "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "amount": price, "months": 1, "payment_method": "wallet",
        "status": "completed", "created_at": now.isoformat(),
    })
    # Grant this cycle's perks (idempotent per 30-day cycle)
    try:
        fresh = await db.shops.find_one({"id": shop["id"]}, {"_id": 0})
        await grant_monthly_subscription_benefits(fresh)
    except Exception as _e:
        logging.error(f"Failed to grant renewal benefits: {_e}")

    try:
        await create_notification(
            recipient_type="shop",
            title="✅ Subscription Renewed",
            message=f"Your subscription was renewed for 30 days. New expiry: {new_end.strftime('%b %d, %Y')}.",
            notification_type="subscription",
            link="/shop/dashboard",
            recipient_id=shop["id"],
        )
    except Exception:
        pass

    return {"message": "Subscription renewed for 30 days!", "subscription_end": new_end.isoformat(), "new_balance": new_balance, "amount": price}


@router.get("/shop/status")
async def get_shop_status(user: Dict = Depends(require_auth)):
    """Get shop status for any authenticated user (for redirect logic)"""
    # Check if user has a shop
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    if not shop:
        # No shop yet — but they may have a pending Guest Shop Application on file
        pending_app = await db.guest_shop_applications.find_one(
            {"user_id": user["user_id"], "status": "pending"}, {"_id": 0}
        )
        if pending_app:
            return {
                "has_shop": True,
                "is_application": True,
                "application_id": pending_app.get("id"),
                "shop_name": pending_app.get("shop_name"),
                "shop_status": "pending",
                "subscription_status": "pending",
            }
        return {"has_shop": False}
    
    # Check subscription expiry
    subscription_status = shop.get("subscription_status", "none")
    subscription_end = shop.get("subscription_end")
    is_expired = False
    
    if subscription_end and subscription_status in ["active", "trial"]:
        try:
            end_date = parse_datetime_aware(subscription_end)
            if end_date and end_date < datetime.now(timezone.utc):
                is_expired = True
                await db.shops.update_one(
                    {"id": shop["id"]},
                    {"$set": {"subscription_status": "expired"}}
                )
                subscription_status = "expired"
                from services.helpers import mark_subscription_ended
                await mark_subscription_ended(shop, "expired")
        except Exception:
            pass
    
    return {
        "has_shop": True,
        "shop_id": shop.get("id"),
        "shop_name": shop.get("name"),
        "shop_status": shop.get("status"),  # pending, approved, suspended
        "subscription_status": subscription_status,  # none, trial, active, expired
        "subscription_end": subscription_end,
        "is_expired": is_expired
    }


@router.post("/shop/start-trial")
async def start_shop_trial(user: Dict = Depends(require_shop)):
    """Start free trial for shop"""
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if shop.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Shop must be approved first")
    
    if shop.get("subscription_status") in ["trial", "active"]:
        raise HTTPException(status_code=400, detail="Already have an active subscription or trial")
    
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    trial_days = platform_settings.get("trial_days", 7) if platform_settings else 7
    
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=trial_days)
    
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {
            "subscription_status": "trial",
            "subscription_start": now.isoformat(),
            "subscription_end": trial_end.isoformat()
        }}
    )
    
    return {"message": f"Trial started! Expires in {trial_days} days.", "trial_end": trial_end.isoformat()}


@router.post("/shop/cancel-subscription")
async def cancel_shop_subscription(user: Dict = Depends(require_shop)):
    """Shop owner cancels their own subscription"""
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if shop.get("subscription_status") not in ["active", "trial"]:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    
    now = datetime.now(timezone.utc)
    
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {
            "subscription_status": "cancelled",
            "subscription_cancelled_at": now.isoformat()
        }}
    )

    # Notify admin + stamp the ended time (for the admin shops badge)
    from services.helpers import mark_subscription_ended
    await mark_subscription_ended(shop, "cancelled")

    # Update user role back to regular user
    await db.users.update_one(
        {"id": user["user_id"]},
        {"$set": {"role": "user", "shop_id": None}}
    )

    return {"message": "Subscription cancelled successfully. Your shop is no longer active."}


@router.post("/shop/create-checkout-with-data")
async def create_checkout_with_shop_data(
    shop_data: ShopCreate,
    request: Request,
    months: int = 1,
    origin_url: Optional[str] = None,
    user: Dict = Depends(require_auth)
):
    """DEPRECATED: Card-based subscription is disabled. Shops are reviewed by admin only."""
    raise HTTPException(status_code=410, detail="Card-based subscription is disabled. Please submit your application — admin will review and approve your shop.")


DEFAULT_SUBSCRIPTION_FEATURES = [
    "1 free Lucky Spin every month",
    "2 free product sponsor credits every month",
    "Lower commission on your sales",
    "Full storefront theme customisation",
    "Marketing & boost tools + advanced analytics",
    "Priority customer support",
]


async def get_subscription_config(platform_settings: Optional[Dict] = None) -> Dict:
    """Single source of truth for the subscription plan shown to shops everywhere.

    Reads the admin-configured pro tier (name/description/price/features/monthly
    wallet credit) from platform_settings.tiers.pro and returns a normalized dict.
    The `features` list is what admin edits under Subscription Tiers → Features
    Included, and is rendered on the Become-a-Seller page, the shop dashboard
    subscribe card, and the welcome popups.
    """
    if platform_settings is None:
        platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0}) or {}
    pro = ((platform_settings.get("tiers") or {}).get("pro")) or {}
    monthly_price = platform_settings.get("subscription_price")
    if monthly_price is None:
        monthly_price = pro.get("monthly_price", 19.0)
    features = pro.get("features")
    if not isinstance(features, list) or len(features) == 0:
        features = list(DEFAULT_SUBSCRIPTION_FEATURES)
    return {
        "name": pro.get("name", "Subscription"),
        "description": pro.get("description", "Unlock the full seller experience for your shop."),
        "monthly_price": float(monthly_price or 0),
        "monthly_wallet_credit": float(pro.get("monthly_wallet_credit", 0) or 0),
        "features": features,
    }


@router.get("/shop/subscription-pricing")
async def get_subscription_pricing():
    """Get subscription pricing with yearly discount info + the admin-configured
    plan features/perks (single source of truth for shop-facing benefit sections)."""
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    cfg = await get_subscription_config(platform_settings)
    monthly_price = cfg["monthly_price"] or 29.0

    yearly_original = monthly_price * 12
    yearly_discount_percent = platform_settings.get("yearly_discount_percent", 8) if platform_settings else 8
    yearly_discount_amount = yearly_original * (yearly_discount_percent / 100)
    yearly_price = yearly_original - yearly_discount_amount

    return {
        "monthly": {
            "price": monthly_price,
            "label": "Monthly",
            "billing_period": "month"
        },
        "yearly": {
            "price": yearly_price,
            "original_price": yearly_original,
            "discount_percent": yearly_discount_percent,
            "savings": yearly_discount_amount,
            "monthly_equivalent": yearly_price / 12,
            "label": "Yearly",
            "billing_period": "year"
        },
        "currency": "USD",
        # Single source of truth for shop-facing benefit sections
        "plan_name": cfg["name"],
        "plan_description": cfg["description"],
        "features": cfg["features"],
        "monthly_wallet_credit": cfg["monthly_wallet_credit"],
    }


@router.post("/shop/subscribe")
async def subscribe_shop(
    request: Request,
    payment_method: str = "manual", 
    months: int = 1,
    origin_url: Optional[str] = None,
    user: Dict = Depends(require_auth)
):
    """Subscribe shop to paid plan - supports monthly (1-11 months) and yearly (12 months with 8% discount)"""
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    price = platform_settings.get("subscription_price", 29.0) if platform_settings else 29.0
    
    # Calculate total with yearly discount
    if months == 12:
        # 8% discount for yearly subscription
        original_total = price * 12
        discount_percentage = 8
        discount_amount = original_total * (discount_percentage / 100)
        total_price = original_total - discount_amount
    else:
        original_total = price * months
        discount_amount = 0
        total_price = original_total
    
    if payment_method == "wallet":
        # Pay for the subscription directly from the shop's wallet balance.
        balance = float(shop.get("wallet_balance", 0) or 0)
        if balance < total_price:
            raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. You need ${total_price:.2f} but have ${balance:.2f}.")
        now = datetime.now(timezone.utc)
        end = now + timedelta(days=30 * months)
        new_balance = round(balance - total_price, 2)
        await db.shops.update_one({"id": shop["id"]}, {"$set": {
            "wallet_balance": new_balance,
            "subscription_status": "active",
            "subscription_required": True,
            "subscription_start": now.isoformat(),
            "subscription_end": end.isoformat(),
            "subscription_price_paid": total_price,
            "payment_method": "wallet",
            "tier": "pro",
        }})
        # Wallet debit transaction
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()), "shop_id": shop["id"], "shop_name": shop.get("name", ""),
            "type": "subscription_payment", "amount": -total_price, "balance_after": new_balance,
            "status": "completed", "note": f"Subscription payment ({months} month{'s' if months != 1 else ''}) via wallet",
            "created_at": now.isoformat(),
        })
        # Record as admin subscription revenue (feeds Admin Profit / Finance Center)
        await db.subscription_payments.insert_one({
            "id": str(uuid.uuid4()), "shop_id": shop["id"], "shop_name": shop.get("name", ""),
            "amount": total_price, "months": months, "payment_method": "wallet",
            "status": "completed", "created_at": now.isoformat(),
        })
        # Grant the first month of subscription perks immediately
        try:
            from services.helpers import grant_monthly_subscription_benefits
            fresh = await db.shops.find_one({"id": shop["id"]}, {"_id": 0})
            await grant_monthly_subscription_benefits(fresh)
        except Exception as _e:
            logging.error(f"Failed to grant initial subscription benefits: {_e}")
        return {"message": "Subscribed successfully via wallet!", "subscription_end": end.isoformat(), "new_balance": new_balance, "amount": total_price}
    elif payment_method == "stripe":
        # Create Stripe checkout session for subscription
        if not origin_url:
            origin_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:3000')
        
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        success_url = f"{origin_url}/shop/subscription-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/become-seller"
        
        metadata = {
            "shop_id": shop["id"],
            "shop_name": shop.get("name"),
            "type": "subscription",
            "months": str(months),
            "price_per_month": str(price),
            "original_total": str(original_total),
            "discount_amount": str(discount_amount),
            "is_yearly": str(months == 12)
        }
        
        checkout_request = CheckoutSessionRequest(
            amount=float(total_price),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store pending subscription transaction
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "shop_id": shop["id"],
            "amount": total_price,
            "months": months,
            "currency": "usd",
            "metadata": metadata,
            "payment_status": "pending",
            "type": "subscription",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscription_transactions.insert_one(transaction)
        
        return {"url": session.url, "session_id": session.session_id, "amount": total_price}
    else:
        # Manual payment - admin will activate
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$set": {"subscription_status": "pending_payment"}}
        )
        return {"message": f"Subscription requested. Please pay ${price} and contact admin for activation.", "price": price}


@router.post("/shop/create-payment-intent")
async def create_shop_payment_intent(months: int = 1, user: Dict = Depends(require_auth)):
    """Create Stripe Payment Intent for shop subscription (embedded payment) - supports yearly with 8% discount"""
    # Check if user has a shop (either role is 'shop' or they just registered)
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found. Please register your shop first.")
    
    # Get platform settings
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    price = platform_settings.get("subscription_price", 29.0) if platform_settings else 29.0
    
    # Calculate total with yearly discount
    if months == 12:
        original_total = price * 12
        discount_percentage = 8
        discount_amount = original_total * (discount_percentage / 100)
        total_price = original_total - discount_amount
    else:
        original_total = price * months
        discount_amount = 0
        total_price = original_total
    
    try:
        # Create Stripe Payment Intent
        payment_intent = stripe.PaymentIntent.create(
            amount=int(total_price * 100),  # Stripe uses cents
            currency="usd",
            metadata={
                "shop_id": shop["id"],
                "shop_name": shop.get("name"),
                "user_id": user["user_id"],
                "user_email": user.get("email"),
                "type": "subscription",
                "months": str(months),
                "price_per_month": str(price),
                "original_total": str(original_total),
                "discount_amount": str(discount_amount),
                "is_yearly": str(months == 12)
            }
        )
        
        return {
            "client_secret": payment_intent.client_secret,
            "amount": total_price,
            "original_amount": original_total,
            "discount_amount": discount_amount,
            "payment_intent_id": payment_intent.id
        }
    except Exception as e:
        logger.error(f"Failed to create payment intent: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create payment intent")


@router.post("/shop/confirm-payment")
async def confirm_shop_payment(payment_intent_id: str, months: int = 1, user: Dict = Depends(require_auth)):
    """Confirm shop subscription payment and activate subscription"""
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    try:
        # Retrieve payment intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if payment_intent.status != "succeeded":
            raise HTTPException(status_code=400, detail="Payment not completed")
        
        # Get platform settings
        platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
        price = platform_settings.get("subscription_price", 29.0) if platform_settings else 29.0
        
        # Activate subscription
        subscription_start = datetime.now(timezone.utc)
        subscription_end = subscription_start + timedelta(days=30 * months)
        
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$set": {
                "status": "approved",
                "subscription_status": "active",
                "subscription_start": subscription_start.isoformat(),
                "subscription_end": subscription_end.isoformat(),
                "subscription_price_paid": price,
                "payment_method": "card"
            }}
        )
        
        # Record payment
        payment_record = {
            "id": str(uuid.uuid4()),
            "shop_id": shop["id"],
            "amount": price * months,
            "months": months,
            "payment_intent_id": payment_intent_id,
            "payment_method": "stripe",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscription_payments.insert_one(payment_record)
        
        # Send confirmation email
        try:
            await send_card_subscription_success_email(shop, user, price, subscription_end)
        except Exception as e:
            logger.error(f"Failed to send subscription success email: {str(e)}")
        
        logger.info(f"Shop {shop['id']} subscription activated via card payment")
        
        return {
            "success": True,
            "message": "Subscription activated successfully",
            "subscription_end": subscription_end.isoformat()
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to confirm payment: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to confirm payment")


@router.get("/shop/subscription/verify/{session_id}")
async def verify_subscription_payment(session_id: str, user: Dict = Depends(require_auth)):
    """Verify subscription payment after Stripe checkout"""
    # Check stripe session status first
    host_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    if status.payment_status == "paid":
        # Get transaction details
        transaction = await db.subscription_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Check if already processed
        if transaction.get("payment_status") == "paid":
            return {"message": "Subscription already activated", "status": "active"}
        
        # Check if we need to create shop first (new registration flow)
        shop = await db.shops.find_one({"user_id": user["user_id"]})
        if not shop and transaction.get("shop_data"):
            # Create shop from transaction data
            shop_data = transaction.get("shop_data")
            shop_id = str(uuid.uuid4())
            shop = {
                "id": shop_id,
                "user_id": user["user_id"],
                "name": shop_data.get("name"),
                "description": shop_data.get("description"),
                "logo": shop_data.get("logo"),
                "phone": shop_data.get("phone"),
                "email": shop_data.get("email") or user.get("email"),
                "address": shop_data.get("address"),
                "subscription_status": "pending",  # Will be activated below
                "payment_method": "card",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.shops.insert_one(shop)
            
            # Update user role to shop
            await db.users.update_one(
                {"id": user["user_id"]},
                {"$set": {"role": "shop", "shop_id": shop_id}}
            )
            
            logger.info(f"Created shop {shop_id} after successful payment for user {user['user_id']}")
        elif not shop:
            raise HTTPException(status_code=404, detail="Shop not found and no shop data in transaction")
        
        months = transaction.get("months", 1)
        amount = transaction.get("amount", 29.0)
        
        now = datetime.now(timezone.utc)
        end_date = now + timedelta(days=30 * months)
        end_date_str = end_date.strftime("%B %d, %Y")
        
        # Activate subscription
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$set": {
                "status": "approved",
                "subscription_status": "active",
                "subscription_start": now.isoformat(),
                "subscription_end": end_date.isoformat(),
                "subscription_price_paid": amount
            }}
        )
        
        # Update transaction status
        await db.subscription_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid"}}
        )
        
        # Record subscription payment for admin revenue
        subscription_record = {
            "id": str(uuid.uuid4()),
            "shop_id": shop["id"],
            "shop_name": shop.get("name"),
            "amount": amount,
            "months": months,
            "price_per_month": amount / months,
            "type": "subscription",
            "payment_method": "stripe",
            "stripe_session_id": session_id,
            "created_at": now.isoformat()
        }
        await db.subscription_payments.insert_one(subscription_record)
        
        # Send confirmation email
        shop_email = shop.get("email") or user.get("email")
        if shop_email:
            await send_subscription_email(
                shop_email, 
                shop.get("name"), 
                "payment_confirmed",
                {"amount": amount, "months": months, "expires": end_date_str}
            )
        
        # Generate new JWT token with updated role
        updated_user = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
        token_payload = {
            "user_id": updated_user["id"],
            "email": updated_user["email"],
            "role": updated_user["role"],  # Now "shop"
            "exp": datetime.now(timezone.utc) + timedelta(days=30)
        }
        new_token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        return {
            "message": "Subscription activated!", 
            "status": "active", 
            "expires": end_date.isoformat(),
            "token": new_token,  # New token with updated role
            "user": {
                "id": updated_user["id"],
                "email": updated_user["email"],
                "role": updated_user["role"],
                "name": updated_user.get("name"),
                "shop_id": shop["id"]
            }
        }
    
    return {"message": "Payment not completed", "status": status.payment_status}


@router.post("/shop/create-payment-intent-with-data")
async def create_payment_intent_with_shop_data(data: CreatePaymentIntentRequest, user: Dict = Depends(require_auth)):
    """Create a Stripe Payment Intent for shop subscription (embedded checkout)"""
    
    # Get platform settings for price
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    price = platform_settings.get("subscription_price", 29.0) if platform_settings else 29.0
    total_amount = int(price * data.months * 100)  # Convert to cents
    
    # Initialize Stripe
    stripe.api_key = STRIPE_API_KEY
    
    try:
        # Create Payment Intent
        intent = stripe.PaymentIntent.create(
            amount=total_amount,
            currency="usd",
            automatic_payment_methods={"enabled": True},
            metadata={
                "user_id": user["user_id"],
                "shop_name": data.shop_name,
                "months": str(data.months),
                "price_per_month": str(price),
                "type": "shop_subscription"
            }
        )
        
        # Store pending shop/transaction data
        pending_id = str(uuid.uuid4())
        pending_data = {
            "id": pending_id,
            "payment_intent_id": intent.id,
            "user_id": user["user_id"],
            "shop_data": {
                "name": data.shop_name,
                "description": data.description,
                "logo": data.logo,
                "phone": data.phone,
                "email": data.email or user.get("email"),
                "address": data.address
            },
            "amount": price * data.months,
            "months": data.months,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pending_shop_payments.insert_one(pending_data)
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "amount": price * data.months,
            "publishable_key": "pk_test_emergent"  # Use test publishable key
        }
    except Exception as e:
        logging.error(f"Failed to create payment intent: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create payment: {str(e)}")


@router.post("/shop/confirm-payment")
async def confirm_payment(payment_intent_id: str, user: Dict = Depends(require_auth)):
    """Confirm payment and activate shop subscription"""
    
    # Get pending payment data
    pending = await db.pending_shop_payments.find_one(
        {"payment_intent_id": payment_intent_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not pending:
        raise HTTPException(status_code=404, detail="Pending payment not found")
    
    # Verify payment with Stripe
    stripe.api_key = STRIPE_API_KEY
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status != "succeeded":
            return {"success": False, "message": f"Payment not completed: {intent.status}"}
        
        # Check if already processed
        if pending.get("status") == "completed":
            return {"success": True, "message": "Payment already processed"}
        
        shop_data = pending.get("shop_data", {})
        months = pending.get("months", 1)
        amount = pending.get("amount", 29.0)
        
        now = datetime.now(timezone.utc)
        end_date = now + timedelta(days=30 * months)
        end_date_str = end_date.strftime("%B %d, %Y")
        
        # Check if shop exists
        existing_shop = await db.shops.find_one({"user_id": user["user_id"]})
        
        if existing_shop:
            # Update existing shop subscription
            await db.shops.update_one(
                {"user_id": user["user_id"]},
                {"$set": {
                    "subscription_status": "active",
                    "subscription_start": now.isoformat(),
                    "subscription_end": end_date.isoformat(),
                    "subscription_price_paid": amount,
                    "payment_method": "card",
                    "status": "approved"
                }}
            )
            shop_id = existing_shop["id"]
        else:
            # Create new shop with active subscription
            shop = Shop(
                user_id=user["user_id"],
                name=shop_data.get("name", "My Shop"),
                description=shop_data.get("description"),
                logo=shop_data.get("logo"),
                phone=shop_data.get("phone"),
                email=shop_data.get("email"),
                address=shop_data.get("address"),
                status="approved",
                subscription_status="active",
                subscription_start=now,
                subscription_end=end_date,
                payment_method="card",
                subscription_price_paid=amount
            )
            
            doc = shop.model_dump()
            doc['subscription_start'] = doc['subscription_start'].isoformat()
            doc['subscription_end'] = doc['subscription_end'].isoformat()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.shops.insert_one(doc)
            shop_id = shop.id
            
            # Update user role
            await db.users.update_one(
                {"id": user["user_id"]},
                {"$set": {"role": "shop", "shop_id": shop_id}}
            )
        
        # Update pending payment status
        await db.pending_shop_payments.update_one(
            {"payment_intent_id": payment_intent_id},
            {"$set": {"status": "completed"}}
        )
        
        # Record subscription payment
        subscription_record = {
            "id": str(uuid.uuid4()),
            "shop_id": shop_id,
            "shop_name": shop_data.get("name"),
            "amount": amount,
            "months": months,
            "price_per_month": amount / months,
            "type": "subscription",
            "payment_method": "card",
            "stripe_payment_intent_id": payment_intent_id,
            "created_at": now.isoformat()
        }
        await db.subscription_payments.insert_one(subscription_record)
        
        # Send confirmation email
        shop_email = shop_data.get("email") or user.get("email")
        if shop_email:
            await send_subscription_email(
                shop_email, 
                shop_data.get("name"), 
                "payment_confirmed",
                {"amount": amount, "months": months, "expires": end_date_str}
            )
        
        return {
            "success": True,
            "message": "Shop subscription activated!",
            "shop_id": shop_id
        }
        
    except Exception as e:
        logging.error(f"Failed to confirm payment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to confirm payment: {str(e)}")


@router.get("/shop/products")
async def get_shop_products(user: Dict = Depends(require_shop)):
    """Get shop's own products with both original and commission prices"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    products = await db.products.find({"shop_id": shop["id"]}, {"_id": 0}).to_list(1000)
    
    info = await get_shop_commission_info(shop["id"])
    commission_rate = info["rate"]
    commission_type = info["type"]
    customer_factor = get_customer_markup_factor(commission_rate, commission_type)
    shop_factor = get_shop_revenue_factor(commission_rate, commission_type)
    for prod in products:
        original_price = prod.get('price', 0)
        original_discount = prod.get('discount_price')
        
        # Store the listed/shop-set prices
        prod['original_price'] = original_price
        prod['original_discount_price'] = original_discount
        
        # Customer-facing prices
        prod['customer_price'] = round(original_price * customer_factor, 2)
        if original_discount:
            prod['customer_discount_price'] = round(original_discount * customer_factor, 2)
        
        # Shop revenue per unit (after commission deduction if on_shop / half_half)
        prod['shop_revenue_price'] = round(original_price * shop_factor, 2)
        if original_discount:
            prod['shop_revenue_discount_price'] = round(original_discount * shop_factor, 2)
        prod['commission_type'] = commission_type
        prod['commission_rate_pct'] = round(commission_rate * 100, 2)
        
        # Include view count (default 0)
        prod['view_count'] = prod.get('view_count', 0)
    
    return products


@router.post("/shop/products/ai-generate")
async def ai_generate_product(body: Dict, user: Dict = Depends(require_shop)):
    """AI-powered product details generator. Generates description, suggested categories, and product type
    based on a product name (and optional image URL). Uses OpenAI gpt-4o-mini."""
    from openai import AsyncOpenAI
    from config import OPENAI_API_KEY, OPENAI_MODEL
    import json as _json
    
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="AI features not configured (missing API key)")
    
    product_name = (body.get("name") or "").strip()
    image_url = (body.get("image_url") or "").strip() or None
    seed_description = (body.get("description") or "").strip()
    
    if not product_name and not image_url:
        raise HTTPException(status_code=400, detail="Please provide a product name or image to generate details")
    
    # Fetch shop's preferred categories for biasing suggestions
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    shop_cat_ids = shop.get("category_ids", []) if shop else []
    
    # Get all active categories
    all_categories = await db.categories.find({"is_active": True}, {"_id": 0, "id": 1, "name": 1, "parent_id": 1}).to_list(500)
    cat_lookup = {c["id"]: c for c in all_categories}
    
    # Build the category context
    cat_list = "\n".join([f"- ID:{c['id']} | Name: {c['name']}" for c in all_categories])
    
    shop_cat_names = []
    for cid in shop_cat_ids:
        if cid in cat_lookup:
            shop_cat_names.append(cat_lookup[cid]["name"])
    
    shop_focus = ""
    if shop_cat_names:
        shop_focus = f"\nThis shop primarily sells: {', '.join(shop_cat_names)}. Prefer these categories when relevant."
    
    system_msg = (
        "You are an expert e-commerce product copywriter for OpenMarketlb marketplace. "
        "Given a product name (and optionally an image URL), generate:\n"
        "1. A SHORT, punchy product description — STRICTLY 1 to 2 sentences MAX (40-90 words total). "
        "No fluff, no marketing clichés, no emojis. Focus on what the product is and its key feature/benefit.\n"
        "2. The best-matching category IDs from the list (1-3 IDs, in order of relevance).\n"
        "3. A suggested target audience: one of 'men', 'women', 'kids', or 'none'.\n"
        "4. Suggested product tags / keywords (3-5 short tags).\n"
        "5. Suggested variant types this product likely has from: ['color','size','shape']. Empty if none.\n\n"
        f"Available categories:\n{cat_list}\n"
        f"{shop_focus}\n\n"
        "Always respond with valid JSON only, no markdown, with this exact schema:\n"
        '{ "description": "...", "category_ids": ["id1","id2"], "type": "men|women|kids|none", '
        '"tags": ["tag1","tag2"], "suggested_variants": ["color","size"] }'
    )
    
    user_msg_parts = [f"Product name: {product_name or 'unknown'}"]
    if seed_description:
        user_msg_parts.append(f"Existing notes: {seed_description}")
    user_msg_text = "\n".join(user_msg_parts)
    
    try:
        client_ai = AsyncOpenAI(api_key=OPENAI_API_KEY)
        # Build messages — include image if provided (gpt-4o-mini supports vision)
        if image_url and image_url.startswith(("http://", "https://", "data:")):
            user_content = [
                {"type": "text", "text": user_msg_text},
                {"type": "image_url", "image_url": {"url": image_url}}
            ]
        else:
            user_content = user_msg_text
        
        response = await client_ai.chat.completions.create(
            model=OPENAI_MODEL or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_content},
            ],
            temperature=0.6,
            max_tokens=400,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = _json.loads(raw)
    except Exception as e:
        logger.error(f"AI product generate failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")
    
    # Sanitize: ensure category_ids are valid
    valid_ids = []
    for cid in (data.get("category_ids") or []):
        if cid in cat_lookup:
            valid_ids.append(cid)
    
    return {
        "description": (data.get("description") or "").strip(),
        "category_ids": valid_ids[:3],
        "type": data.get("type") if data.get("type") in ("men", "women", "kids", "none") else "none",
        "tags": data.get("tags") or [],
        "suggested_variants": [v for v in (data.get("suggested_variants") or []) if v in ("color", "size", "shape")],
    }


@router.post("/shop/products")
async def create_shop_product(product: ProductCreate, user: Dict = Depends(require_shop)):
    """Create a product for shop"""
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if shop.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Shop must be approved to add products")
    
    if shop.get("subscription_status") not in ["trial", "active"]:
        raise HTTPException(status_code=400, detail="Active subscription required to add products")
    
    # NOTE: Tier-based product limits removed — all shops have unlimited products.
    product_data = product.model_dump()
    product_data["shop_id"] = shop["id"]
    product_data["shop_name"] = shop["name"]
    
    # Handle category_ids
    if not product_data.get('category_ids') and product_data.get('category_id'):
        product_data['category_ids'] = [product_data['category_id']]
    elif product_data.get('category_ids') and not product_data.get('category_id'):
        product_data['category_id'] = product_data['category_ids'][0] if product_data['category_ids'] else None
    
    # Set defaults for variant fields
    for field in ['colors', 'sizes', 'shapes', 'types', 'category_ids']:
        if product_data.get(field) is None:
            product_data[field] = []
    
    prod = Product(**product_data)
    doc = prod.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    # Ensure variant images in images array
    if not doc.get('images') or len(doc['images']) == 0:
        vi = []
        for c in (doc.get('colors') or []): 
            if c.get('image_url'): vi.append(c['image_url'])
        for s in (doc.get('shapes') or []): 
            if s.get('image_url'): vi.append(s['image_url'])
        if doc.get('size_variant_image'): vi.append(doc['size_variant_image'])
        for s in (doc.get('sizes') or []): 
            if s.get('image_url'): vi.append(s['image_url'])
        if doc.get('type_variant_image'): vi.append(doc['type_variant_image'])
        for t in (doc.get('types') or []):
            if t.get('image_url'): vi.append(t['image_url'])
        if vi: doc['images'] = list(dict.fromkeys(vi))
    await db.products.insert_one(doc)
    
    # If shop has an active sale, apply sale discount to this new product
    now = datetime.now(timezone.utc).isoformat()
    active_sale = await db.shop_sales.find_one(
        {"shop_id": shop["id"], "is_active": True, "end_date": {"$gt": now}},
        {"_id": 0}
    )
    if active_sale:
        sale_discount = active_sale.get("discount_percent", 0)
        if sale_discount > 0:
            base_price = doc.get("price", 0)
            new_discount_price = round(base_price * (1 - sale_discount / 100), 2)
            await db.products.update_one(
                {"id": doc["id"]},
                {"$set": {
                    "discount_price": new_discount_price,
                    "shop_sale_id": active_sale["id"],
                    "shop_sale_discount": sale_discount,
                    "shop_sale_title": active_sale.get("title", ""),
                }}
            )
            # Add this product to the sale's original_prices snapshot
            await db.shop_sales.update_one(
                {"id": active_sale["id"]},
                {"$set": {f"original_prices.{doc['id']}": {
                    "price": doc.get("price", 0),
                    "discount_price": doc.get("discount_price"),
                }}}
            )
    
    # Notify admin about new product
    await create_notification(
        "admin",
        "New Product Listed",
        f"'{product_data.get('name')}' added by {shop['name']} - ${product_data.get('price', 0):.2f}",
        "product",
        "/admin/products"
    )
    
    # Re-read to include sale fields in response
    final_doc = await db.products.find_one({"id": doc["id"]}, {"_id": 0})
    if final_doc:
        if isinstance(final_doc.get('created_at'), str):
            final_doc['created_at'] = datetime.fromisoformat(final_doc['created_at'])
        return final_doc
    
    return prod


@router.put("/shop/products/{product_id}")
async def update_shop_product(product_id: str, product: ProductCreate, user: Dict = Depends(require_shop)):
    """Update shop's own product"""
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Check product belongs to shop
    existing = await db.products.find_one({"id": product_id, "shop_id": shop["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found or not yours")
    
    product_data = product.model_dump()
    product_data["shop_id"] = shop["id"]
    product_data["shop_name"] = shop["name"]
    
    if not product_data.get('category_ids') and product_data.get('category_id'):
        product_data['category_ids'] = [product_data['category_id']]
    
    # Set defaults for variant fields
    for field in ['colors', 'sizes', 'shapes', 'types', 'category_ids']:
        if product_data.get(field) is None:
            product_data[field] = []
    
    result = await db.products.find_one_and_update(
        {"id": product_id, "shop_id": shop["id"]},
        {"$set": product_data},
        return_document=True,
        projection={"_id": 0}
    )
    
    # Notify admin about product update
    await create_notification(
        "admin",
        "Product Updated",
        f"'{product_data.get('name')}' updated by {shop['name']}",
        "product",
        "/admin/products"
    )
    
    return result


@router.delete("/shop/products/{product_id}")
async def delete_shop_product(product_id: str, user: Dict = Depends(require_shop)):
    """Delete shop's own product"""
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Get product name before deletion
    product = await db.products.find_one({"id": product_id, "shop_id": shop["id"]}, {"_id": 0, "name": 1})
    
    result = await db.products.delete_one({"id": product_id, "shop_id": shop["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found or not yours")
    
    # Notify admin about product deletion
    await create_notification(
        "admin",
        "Product Deleted",
        f"'{product.get('name', 'Unknown')}' was deleted by {shop['name']}",
        "product",
        "/admin/products"
    )
    
    return {"message": "Product deleted"}


@router.get("/shop/orders")
async def get_shop_orders(user: Dict = Depends(require_shop)):
    """Get orders containing shop's products"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Find orders with items from this shop
    orders = await db.orders.find(
        {"shop_ids": shop["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Filter items to only show shop's items
    for order in orders:
        order["items"] = [item for item in order.get("items", []) if item.get("shop_id") == shop["id"]]
        # Calculate shop's revenue (without commission, using original prices)
        order["shop_total"] = sum(item.get("original_subtotal", item.get("subtotal", 0)) for item in order["items"])
    
    return orders


@router.put("/shop/orders/{order_id}/status")
async def update_shop_order_status(order_id: str, status: str, user: Dict = Depends(require_shop)):
    """Update order status for shop's items"""
    shop = await db.shops.find_one({"user_id": user["user_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    order = await db.orders.find_one({"id": order_id, "shop_ids": shop["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    valid_statuses = ["pending", "processing", "ready", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"order_status": status}}
    )
    
    return {"message": "Order status updated"}


@router.post("/shop/create-order")
async def shop_create_order(order_data: ShopCreateOrderRequest, user: Dict = Depends(require_shop)):
    """Shop creates an order on behalf of a customer - only shop's own products"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if not order_data.items or len(order_data.items) == 0:
        raise HTTPException(status_code=400, detail="No items in order")
    
    commission_rate = await get_commission_rate(shop["id"])
    
    order_items = []
    total_amount = 0.0
    original_total = 0.0
    
    for item_data in order_data.items:
        product = await db.products.find_one({"id": item_data["product_id"], "shop_id": shop["id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item_data['product_id']} not found or does not belong to your shop")
        
        quantity = item_data.get("quantity", 1)
        selected_color = item_data.get("selected_color")
        selected_size = item_data.get("selected_size")
        selected_shape = item_data.get("selected_shape")
        selected_type = item_data.get("selected_type")
        color_image = None
        variant_price = None
        
        # Check stock for each selected variant
        if selected_color and product.get("colors"):
            color_variant = next((c for c in product["colors"] if c["color_name"] == selected_color), None)
            if color_variant and color_variant.get("stock", 0) < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']} in color {selected_color}")
            if color_variant:
                color_image = color_variant.get("image_url")
                if color_variant.get("price") is not None:
                    variant_price = color_variant.get("discount_price") or color_variant.get("price")
        if selected_size and product.get("sizes"):
            size_variant = next((s for s in product["sizes"] if s["size_name"] == selected_size), None)
            if size_variant and size_variant.get("stock", 0) < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']} in size {selected_size}")
            if size_variant and variant_price is None and size_variant.get("price") is not None:
                variant_price = size_variant.get("discount_price") or size_variant.get("price")
        if selected_shape and product.get("shapes"):
            shape_variant = next((sh for sh in product["shapes"] if sh["shape_name"] == selected_shape), None)
            if shape_variant and shape_variant.get("stock", 0) < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']} in shape {selected_shape}")
            if shape_variant and variant_price is None and shape_variant.get("price") is not None:
                variant_price = shape_variant.get("discount_price") or shape_variant.get("price")
        if selected_type and product.get("types"):
            type_variant = next((t for t in product["types"] if t.get("type_name") == selected_type), None)
            if type_variant and type_variant.get("stock", 0) < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']} in type {selected_type}")
            if type_variant and variant_price is None and type_variant.get("price") is not None:
                variant_price = type_variant.get("discount_price") or type_variant.get("price")
        # Fallback: no variant-specific stock checked -> use product stock
        if not (selected_color or selected_size or selected_shape or selected_type):
            if product["stock"] < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']}")
        
        product_image = color_image or (product.get("images", [None])[0] if product.get("images") else None)
        original_price = variant_price if variant_price is not None else (product.get("discount_price") or product["price"])
        customer_price = round(original_price * (1 + commission_rate), 2) if commission_rate > 0 else original_price
        
        order_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "image": product_image,
            "selected_color": selected_color,
            "selected_size": selected_size,
            "selected_shape": selected_shape,
            "selected_type": selected_type,
            "price": customer_price,
            "original_price": original_price,
            "quantity": quantity,
            "subtotal": round(customer_price * quantity, 2),
            "original_subtotal": round(original_price * quantity, 2),
            "shop_id": shop["id"],
            "shop_name": shop.get("name", "")
        })
        total_amount += customer_price * quantity
        original_total += original_price * quantity
    
    commission_amount = round(total_amount - original_total, 2)
    
    # Shop ordering gets half-commission discount + loyalty points
    shop_order_discount = 0.0
    if commission_amount > 0:
        shop_order_discount = round(commission_amount / 2, 2)
        total_amount = round(total_amount - shop_order_discount, 2)
        commission_amount = round(commission_amount - shop_order_discount, 2)
    
    # Delivery fee from state
    delivery_fee = 1.0
    shipping_state = order_data.shipping_address.get("state", "")
    if shipping_state:
        state_doc = await db.states.find_one(
            {"name": {"$regex": f"^{shipping_state}$", "$options": "i"}, "is_active": True},
            {"_id": 0}
        )
        if state_doc:
            delivery_fee = state_doc.get("delivery_fee", 1.0)
    total_amount += delivery_fee
    
    # Calculate shop revenue (original total without commission)
    shop_revenue_amount = round(original_total, 2)
    
    # Handle wallet payment
    payment_method = order_data.payment_method
    wallet_paid = False
    if payment_method == "wallet":
        # Check shop wallet balance
        if (shop.get("wallet_balance", 0) or 0) < total_amount:
            raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. You have ${(shop.get('wallet_balance', 0) or 0):.2f} but need ${total_amount:.2f}")
        
        # Debit shop wallet
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$inc": {"wallet_balance": -total_amount}}
        )
        
        # Record wallet transaction
        shop_after = await db.shops.find_one({"id": shop["id"]}, {"_id": 0, "wallet_balance": 1})
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "type": "order_wallet_payment",
            "amount": -total_amount,
            "balance_after": shop_after.get("wallet_balance", 0),
            "status": "completed",
            "note": f"Wallet payment for order",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        wallet_paid = True
    
    order_dict = {
        "id": str(uuid.uuid4()),
        "user_id": None,
        "customer_name": order_data.customer_name,
        "customer_email": order_data.customer_email,
        "customer_phone": order_data.customer_phone,
        "guest_name": order_data.customer_name,
        "guest_email": order_data.customer_email,
        "guest_phone": order_data.customer_phone,
        "user_phone": order_data.customer_phone,
        "shipping_address": dict(order_data.shipping_address),
        "items": order_items,
        "delivery_fee": delivery_fee,
        "commission_amount": commission_amount,
        "shop_revenue_amount": shop_revenue_amount,
        "shop_order_discount": shop_order_discount,
        "total_amount": total_amount,
        "payment_method": payment_method,
        "payment_status": "pending",
        "order_status": "pending",
        "payout_status": "pending",
        "shop_ids": [shop["id"]],
        "created_by_shop": shop["id"],
        "delivery_user_id": None,
        "delivery_status": "pending",
        "wallet_paid": wallet_paid,
        "delivery_fee_released": False,
        "revenue_distributed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order_dict.copy())
    
    # Update stock (decrement the right variant's stock AND general product stock)
    for item_data in order_data.items:
        selected_color = item_data.get("selected_color")
        selected_size = item_data.get("selected_size")
        selected_shape = item_data.get("selected_shape")
        qty = item_data.get("quantity", 1)
        pid = item_data["product_id"]
        if selected_color:
            await db.products.update_one(
                {"id": pid, "colors.color_name": selected_color},
                {"$inc": {"colors.$.stock": -qty}}
            )
        if selected_size:
            await db.products.update_one(
                {"id": pid, "sizes.size_name": selected_size},
                {"$inc": {"sizes.$.stock": -qty}}
            )
        if selected_shape:
            await db.products.update_one(
                {"id": pid, "shapes.shape_name": selected_shape},
                {"$inc": {"shapes.$.stock": -qty}}
            )
        # Always decrease the general product stock
        await db.products.update_one(
            {"id": pid},
            {"$inc": {"stock": -qty}}
        )
    
    # Notify admin
    await create_notification(
        "admin", "New Shop Order",
        f"Shop '{shop['name']}' created Order #{order_dict['id'][:8]} - Total: ${order_dict['total_amount']:.2f}" + (f" (Shop discount: ${shop_order_discount:.2f})" if shop_order_discount > 0 else ""),
        "order", "/admin/orders"
    )
    
    # Award loyalty points to shop for ordering
    try:
        loyalty_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
        if loyalty_settings and loyalty_settings.get("loyalty_enabled"):
            points_per_dollar = loyalty_settings.get("loyalty_points_per_dollar", 1)
            points_earned = int(original_total * points_per_dollar)
            if points_earned > 0:
                await db.shops.update_one(
                    {"id": shop["id"]},
                    {"$inc": {"loyalty_points": points_earned}}
                )
                await db.orders.update_one(
                    {"id": order_dict["id"]},
                    {"$set": {"shop_loyalty_points_earned": points_earned}}
                )
    except Exception as e:
        logger.error(f"Shop loyalty points error: {e}")
    
    return {k: v for k, v in order_dict.items() if k != "_id"}


@router.get("/shop/analytics")
async def get_shop_analytics(user: Dict = Depends(require_shop)):
    """Get shop's revenue and sales analytics"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Get platform settings for default commission
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    commission_enabled = (platform_settings or {}).get("commission_enabled", False)
    default_commission = platform_settings.get("commission_percentage", 0) if platform_settings else 0
    
    # Use shop-specific commission or default (0 if commission disabled)
    if not commission_enabled:
        commission_percentage = 0
    else:
        # Use shop-specific commission, then tier-based, then platform default
        if shop.get("commission_percentage") is not None:
            commission_percentage = shop["commission_percentage"]
        else:
            # Check tier-based commission
            shop_tier = shop.get("tier", "starter")
            tiers = (platform_settings or {}).get("tiers", {})
            tier_config = tiers.get(shop_tier, {})
            if tier_config.get("commission_rate") is not None:
                commission_percentage = tier_config["commission_rate"]
            else:
                commission_percentage = default_commission
    
    # Get all orders for this shop
    orders = await db.orders.find(
        {"shop_ids": shop["id"], "payment_status": "paid"},
        {"_id": 0}
    ).to_list(1000)
    
    net_revenue = 0
    gross_revenue = 0
    total_orders = len(orders)
    
    # Calculate revenue from shop's items
    # net_revenue = original price (what shop actually gets)
    # gross_revenue = customer-facing price (includes commission)
    for order in orders:
        shop_items = [item for item in order.get("items", []) if item.get("shop_id") == shop["id"]]
        for item in shop_items:
            gross_revenue += item.get("subtotal", 0)
            net_revenue += item.get("original_subtotal", item.get("subtotal", 0))
    
    # Commission is the difference
    commission_amount = gross_revenue - net_revenue
    
    # Products count
    products_count = await db.products.count_documents({"shop_id": shop["id"]})
    
    # Get low stock products for this shop
    shop_products = await db.products.find({"shop_id": shop["id"]}, {"_id": 0}).to_list(10000)
    low_stock_products = [p for p in shop_products if p.get("stock", 0) < 5]
    
    # Monthly revenue (net = original price, what shop actually earns)
    monthly_revenue = {}
    for order in orders:
        created_at = order.get("created_at")
        if isinstance(created_at, str):
            created_at = parse_datetime_aware(created_at)
        if not created_at:
            continue
        month_key = created_at.strftime("%Y-%m")
        shop_items = [item for item in order.get("items", []) if item.get("shop_id") == shop["id"]]
        month_net = sum(item.get("original_subtotal", item.get("subtotal", 0)) for item in shop_items)
        monthly_revenue[month_key] = monthly_revenue.get(month_key, 0) + month_net
    
    return {
        "total_revenue": net_revenue,  # Net revenue after commission
        "gross_revenue": gross_revenue,
        "commission_amount": commission_amount,
        "commission_percentage": commission_percentage,
        "total_orders": total_orders,
        "products_count": products_count,
        "monthly_revenue": monthly_revenue,
        "low_stock_count": len(low_stock_products),
        "low_stock_products": low_stock_products[:10]
    }


@router.get("/shop/report/pdf")
async def generate_shop_pdf_report(user: Dict = Depends(require_shop)):
    """Shop: Generate PDF report for this shop"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import inch
    from starlette.responses import StreamingResponse
    import io
    
    try:
        shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if not shop:
            raise HTTPException(status_code=404, detail="Shop not found")
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40)
        story = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=20, textColor=colors.HexColor('#10b981'), spaceAfter=20)
        heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#1e293b'), spaceBefore=16, spaceAfter=8)
        normal_style = styles['Normal']
        
        story.append(Paragraph(f"{shop.get('name', 'Shop')} - Report", title_style))
        story.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}", normal_style))
        story.append(Spacer(1, 20))
        
        # Shop Info
        story.append(Paragraph("Shop Information", heading_style))
        info_data = [
            ["Field", "Value"],
            ["Shop Name", shop.get("name", "N/A")],
            ["Email", shop.get("email", "N/A")],
            ["Phone", shop.get("phone", "N/A")],
            ["Address", shop.get("address", "N/A")],
            ["Status", shop.get("subscription_status", "N/A").capitalize()],
        ]
        if shop.get("subscription_end"):
            info_data.append(["Subscription Expires", shop["subscription_end"][:10]])
        
        t1 = Table(info_data, colWidths=[2*inch, 3*inch])
        t1.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdf4')]),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t1)
        story.append(Spacer(1, 12))
        
        # Products
        products = await db.products.find({"shop_id": shop["id"]}, {"_id": 0}).to_list(1000)
        story.append(Paragraph("Products", heading_style))
        prod_data = [
            ["Metric", "Value"],
            ["Total Products", str(len(products))],
            ["Active Products", str(len([p for p in products if p.get("is_active")]))],
            ["Total Stock", str(sum(p.get("stock", 0) for p in products))],
        ]
        t2 = Table(prod_data, colWidths=[2*inch, 3*inch])
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#eff6ff')]),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t2)
        story.append(Spacer(1, 12))
        
        # Orders & Revenue
        orders = await db.orders.find({"shop_ids": shop["id"]}, {"_id": 0}).to_list(10000)
        total_revenue = 0
        for o in orders:
            for item in o.get("items", []):
                if item.get("shop_id") == shop["id"]:
                    total_revenue += item.get("original_subtotal", item.get("subtotal", 0))
        
        story.append(Paragraph("Orders & Revenue", heading_style))
        order_data = [
            ["Metric", "Value"],
            ["Total Orders", str(len(orders))],
            ["Pending Orders", str(len([o for o in orders if o.get("order_status") == "pending"]))],
            ["Delivered Orders", str(len([o for o in orders if o.get("order_status") == "delivered"]))],
            ["Total Revenue", f"${total_revenue:,.2f}"],
        ]
        t3 = Table(order_data, colWidths=[2*inch, 3*inch])
        t3.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fffbeb')]),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t3)
        story.append(Spacer(1, 12))
        
        # Product list
        if products:
            story.append(Paragraph("Product Details", heading_style))
            pl_data = [["Product", "Price", "Stock", "Status"]]
            for p in products[:20]:
                pl_data.append([
                    p.get("name", "N/A")[:30],
                    f"${p.get('price', 0):.2f}",
                    str(p.get("stock", 0)),
                    "Active" if p.get("is_active") else "Inactive"
                ])
            t4 = Table(pl_data, colWidths=[2.5*inch, 1*inch, 0.8*inch, 0.8*inch])
            t4.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f3ff')]),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(t4)
        
        doc.build(story)
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={shop.get('name', 'shop')}_report_{datetime.now().strftime('%Y%m%d')}.pdf"}
        )
    except Exception as e:
        logging.error(f"Failed to generate shop PDF report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/shop/wallet")
async def get_shop_wallet(user: Dict = Depends(require_shop)):
    """Get shop wallet balance and recent transactions"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    balance = shop.get("wallet_balance", 0)
    transactions = await db.wallet_transactions.find(
        {"shop_id": shop["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"balance": balance, "transactions": transactions}


@router.post("/shop/wallet/request")
async def request_wallet_topup(request: Request, user: Dict = Depends(require_shop)):
    """Shop requests money to be added to wallet"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    body = await request.json()
    amount = body.get("amount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    now = datetime.now(timezone.utc)
    txn = {
        "id": str(uuid.uuid4()),
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "type": "topup_request",
        "amount": amount,
        "status": "pending",
        "note": f"Wallet top-up request for ${amount:.2f}",
        "created_at": now.isoformat()
    }
    await db.wallet_transactions.insert_one(txn)
    
    await create_notification("admin", "Wallet Top-up Request", f"{shop.get('name')} requested ${amount:.2f} wallet top-up", "wallet", "/admin/shops")
    
    return {"message": "Top-up request sent to admin", "transaction": {k: v for k, v in txn.items() if k != "_id"}}


@router.post("/shop/wallet/cashout")
async def request_cashout(request: Request, user: Dict = Depends(require_shop)):
    """Shop requests to cash out money from digital wallet"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    body = await request.json()
    amount = body.get("amount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Cash out method: cash | whish | omt. Whish & OMT require a phone/account number.
    method = (body.get("method") or "cash").strip().lower()
    method_number = (body.get("method_number") or "").strip()
    if method not in ("cash", "whish", "omt"):
        raise HTTPException(status_code=400, detail="Invalid cash out method")
    if method in ("whish", "omt") and not method_number:
        raise HTTPException(status_code=400, detail="A phone number is required for Wish Money and OMT")
    if method == "cash":
        method_number = ""

    # Check minimum cashout amount
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    min_cashout = settings.get("min_cashout_amount", 5.0) if settings else 5.0
    if amount < min_cashout:
        raise HTTPException(status_code=400, detail=f"Minimum cash out amount is ${min_cashout:.2f}")
    
    current_balance = shop.get("wallet_balance", 0) or 0
    if amount > current_balance:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: ${current_balance:.2f}")
    
    # Check for existing pending cashout
    pending_cashout = await db.cashout_requests.find_one(
        {"shop_id": shop["id"], "status": "pending"},
        {"_id": 0}
    )
    if pending_cashout:
        raise HTTPException(status_code=400, detail="You already have a pending cash out request. Please wait for admin to process it.")
    
    now = datetime.now(timezone.utc)
    
    # Deduct from wallet balance immediately (reserved)
    new_balance = round(current_balance - amount, 2)
    await db.shops.update_one({"id": shop["id"]}, {"$set": {"wallet_balance": new_balance}})
    
    # Create cashout request
    cashout_doc = {
        "id": str(uuid.uuid4()),
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "amount": amount,
        "method": method,
        "method_number": method_number,
        "status": "pending",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.cashout_requests.insert_one(cashout_doc)
    
    # Create wallet transaction
    txn = {
        "id": str(uuid.uuid4()),
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "type": "cashout_request",
        "amount": -amount,
        "balance_after": new_balance,
        "status": "pending",
        "note": f"Cash out request for ${amount:.2f}",
        "cashout_id": cashout_doc["id"],
        "created_at": now.isoformat()
    }
    await db.wallet_transactions.insert_one(txn)
    
    # Notify admin
    await create_notification("admin", "Cash Out Request", f"{shop.get('name')} requested ${amount:.2f} cash out", "wallet", "/admin/cashout-requests")
    
    return {"message": "Cash out request submitted", "cashout": {k: v for k, v in cashout_doc.items() if k != "_id"}, "new_balance": new_balance}


@router.get("/shop/cashout-settings")
async def get_shop_cashout_settings(user: Dict = Depends(require_shop)):
    """Get minimum cashout amount for shop"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    return {"min_cashout_amount": settings.get("min_cashout_amount", 5.0) if settings else 5.0}


@router.post("/shop/promotions")
async def create_promotion(request: Request, user: Dict = Depends(require_shop)):
    """Shop boosts a product using wallet balance"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if not settings or not settings.get("promotion_enabled", False):
        raise HTTPException(status_code=400, detail="Product promotions are currently disabled")
    
    body = await request.json()
    product_id = body.get("product_id")
    duration_days = body.get("duration_days", 7)
    use_free_credit = bool(body.get("use_free_credit", False))
    
    if not product_id:
        raise HTTPException(status_code=400, detail="Product ID is required")
    if duration_days < 1 or duration_days > 30:
        raise HTTPException(status_code=400, detail="Duration must be between 1 and 30 days")
    
    product = await db.products.find_one({"id": product_id, "shop_id": shop["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or not yours")
    
    existing = await db.promotions.find_one({
        "product_id": product_id, "status": "active",
        "end_date": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    if existing:
        raise HTTPException(status_code=400, detail="This product already has an active promotion")
    
    daily_price = settings.get("promotion_daily_price", 2.0)
    total_cost = round(daily_price * duration_days, 2)
    wallet_balance = shop.get("wallet_balance", 0) or 0
    
    # Determine if we can use a free credit
    free_short = int(shop.get("free_sponsor_credits", 0) or 0)
    free_long = int(shop.get("free_sponsor_10day_credits", 0) or 0)
    used_free = False
    used_free_type = None
    
    if use_free_credit:
        # 10-day free credit must be used as exactly 10 days
        if free_long > 0 and duration_days == 10:
            used_free = True
            used_free_type = "free_sponsor_10day_credits"
        elif free_short > 0 and duration_days == 3:
            # short credit is a 3-day standard free sponsor
            used_free = True
            used_free_type = "free_sponsor_credits"
        else:
            raise HTTPException(status_code=400, detail="Free credit cannot be used for this duration. Use 3 days (regular) or 10 days (special).")
    
    if not used_free and total_cost > wallet_balance:
        raise HTTPException(status_code=400, detail=f"Not enough credits in wallet. Need ${total_cost:.2f}, have ${wallet_balance:.2f}. Contact admin to add money to your wallet.")
    
    # Deduct from wallet only if not using a free credit
    new_balance = wallet_balance
    if not used_free:
        new_balance = round(wallet_balance - total_cost, 2)
        await db.shops.update_one({"id": shop["id"]}, {"$set": {"wallet_balance": new_balance}})
    else:
        # Consume one free credit
        await db.shops.update_one({"id": shop["id"]}, {"$inc": {used_free_type: -1}})
    
    now = datetime.now(timezone.utc)
    
    # Record wallet transaction
    boost_txn_id = str(uuid.uuid4())
    txn = {
        "id": boost_txn_id, "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "type": "boost_payment" if not used_free else "boost_free_credit",
        "amount": -total_cost if not used_free else 0,
        "balance_after": new_balance,
        "status": "completed",
        "note": (f"Boost '{product.get('name')}' for {duration_days} days" + (" (FREE credit)" if used_free else "")),
        "created_at": now.isoformat()
    }
    await db.wallet_transactions.insert_one(txn)
    
    # Record admin revenue from boost (only when paid)
    if not used_free:
        await db.admin_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "type": "platform_services",
            "subtype": "product_boost",
            "amount": total_cost,
            "direction": "credit",
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "ref_id": boost_txn_id,
            "note": f"Product boost '{product.get('name')}' for {duration_days} days by {shop.get('name', '')}",
            "created_at": now.isoformat()
        })
    
    promotion = {
        "id": str(uuid.uuid4()), "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "product_id": product_id, "product_name": product.get("name", ""),
        "duration_days": duration_days, "daily_price": daily_price,
        "total_cost": 0 if used_free else total_cost,
        "payment_method": "free_credit" if used_free else "wallet",
        "is_free": used_free,
        "status": "active",
        "start_date": now.isoformat(), "end_date": (now + timedelta(days=duration_days)).isoformat(),
        "views": 0, "orders": 0, "created_at": now.isoformat()
    }
    await db.promotions.insert_one(promotion)
    await db.products.update_one({"id": product_id}, {"$set": {"is_promoted": True, "promotion_end": promotion["end_date"]}})
    
    return {"message": "Product boosted!" + (" (Free sponsor credit used)" if used_free else ""), "promotion": {k: v for k, v in promotion.items() if k != "_id"}, "wallet_balance": new_balance, "used_free_credit": used_free}


@router.get("/shop/promotions")
async def get_shop_promotions(user: Dict = Depends(require_shop)):
    """Get shop's promotions (active and past)"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    promotions = await db.promotions.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Auto-expire promotions
    now = datetime.now(timezone.utc).isoformat()
    for promo in promotions:
        if promo["status"] == "active" and promo["end_date"] <= now:
            await db.promotions.update_one({"id": promo["id"]}, {"$set": {"status": "expired"}})
            await db.products.update_one({"id": promo["product_id"]}, {"$set": {"is_promoted": False}})
            promo["status"] = "expired"
    
    return {"promotions": promotions, "wallet_balance": shop.get("wallet_balance", 0)}


@router.put("/shop/promotions/{promotion_id}/cancel")
async def cancel_promotion(promotion_id: str, user: Dict = Depends(require_shop)):
    """Cancel an active promotion (no refund for used days)"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    promo = await db.promotions.find_one({"id": promotion_id, "shop_id": shop["id"]})
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    if promo["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active promotions can be cancelled")
    
    await db.promotions.update_one(
        {"id": promotion_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.products.update_one({"id": promo["product_id"]}, {"$set": {"is_promoted": False}})
    
    return {"message": "Promotion cancelled. No refund for used days."}


@router.get("/shop/tier")
async def get_shop_tier_info(user: Dict = Depends(require_shop)):
    """Returns shop info. Tier system has been removed — all shops are treated equally with full features."""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    default_commission = (settings or {}).get("commission_percentage", 10)
    
    product_count = await db.products.count_documents({"shop_id": shop["id"]})
    
    return {
        "current_tier": "standard",
        "tier_start": shop.get("tier_start"),
        "tier_end": shop.get("tier_end"),
        "subscription_status": shop.get("subscription_status"),
        "tiers": {},
        "product_count": product_count,
        "product_limit": "unlimited",
        "wallet_balance": shop.get("wallet_balance", 0),
        "monthly_wallet_credit": 0,
        "commission_rate": shop.get("commission_percentage") if shop.get("commission_percentage") is not None else default_commission,
        "analytics_level": "full",
        "has_report_download": True,
        "has_search_priority": True,
        "has_badge": False,
    }


@router.post("/shop/upgrade-tier")
async def request_tier_upgrade(request: Request, user: Dict = Depends(require_shop)):
    """DEPRECATED: Tier upgrades have been removed. All shops have full access."""
    raise HTTPException(status_code=410, detail="Tier upgrades are no longer required — all shops have full access to all features.")


@router.get("/shop/tier-upgrade-requests")
async def get_shop_tier_requests(user: Dict = Depends(require_shop)):
    """Get shop's tier upgrade request history"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    requests = await db.tier_upgrade_requests.find(
        {"shop_id": shop["id"]}, {"_id": 0}
    ).sort("requested_at", -1).to_list(20)
    return {"requests": requests}


@router.get("/shop/badge-counts")
async def shop_badge_counts(user: Dict = Depends(require_shop)):
    """Get real-time badge counts for shop sidebar"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "id": 1})
    if not shop:
        return {"pending_orders": 0, "unread_messages": 0}
    shop_id = shop["id"]
    pending_orders = await db.orders.count_documents({"shop_id": shop_id, "order_status": "pending"})
    unread_messages = await db.messages.count_documents({
        "receiver_id": user["user_id"], "read": False
    })
    return {
        "pending_orders": pending_orders,
        "unread_messages": unread_messages
    }


@router.post("/shop/badges/mark-seen")
async def shop_mark_badge_seen(request: Request, user: Dict = Depends(require_shop)):
    """Mark shop badge section as seen"""
    body = await request.json()
    section = body.get("section", "")
    
    await db.badge_reads.update_one(
        {"user_id": user["user_id"], "section": section},
        {"$set": {"user_id": user["user_id"], "section": section, "last_seen": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"status": "ok"}


@router.post("/shop/products/{product_id}/gift")
async def set_product_gift(product_id: str, request: Request, user: Dict = Depends(require_shop)):
    """All approved shops can attach a free gift to a product"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    product = await db.products.find_one({"id": product_id, "shop_id": shop["id"]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in your shop")
    
    body = await request.json()
    gift_type = body.get("gift_type", "gift_only")  # 'existing_product' or 'gift_only'
    gift_product_id = body.get("gift_product_id")
    gift_name = body.get("gift_name", "")
    gift_image = body.get("gift_image", "")
    gift_stock = body.get("gift_stock")  # Optional stock number for the gift
    
    if gift_type == "existing_product":
        if not gift_product_id:
            raise HTTPException(status_code=400, detail="Please select a product to use as gift")
        gift_prod = await db.products.find_one({"id": gift_product_id, "shop_id": shop["id"]}, {"_id": 0})
        if not gift_prod:
            raise HTTPException(status_code=404, detail="Gift product not found in your shop")
        gift_name = gift_prod["name"]
        gift_image = gift_prod.get("images", [""])[0] if gift_prod.get("images") else ""
    else:
        if not gift_name:
            raise HTTPException(status_code=400, detail="Please provide a gift name")
    
    # Validate gift_stock
    if gift_stock is not None:
        gift_stock = int(gift_stock)
        if gift_stock < 0:
            raise HTTPException(status_code=400, detail="Gift stock cannot be negative")
    
    now = datetime.now(timezone.utc).isoformat()
    gift_doc = {
        "id": str(uuid.uuid4()),
        "shop_id": shop["id"],
        "product_id": product_id,
        "gift_type": gift_type,
        "gift_product_id": gift_product_id if gift_type == "existing_product" else None,
        "gift_name": gift_name,
        "gift_image": gift_image,
        "gift_stock": gift_stock,
        "gift_stock_used": 0,
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    # Upsert: one gift per product
    await db.product_gifts.update_one(
        {"product_id": product_id, "shop_id": shop["id"]},
        {"$set": gift_doc},
        upsert=True
    )
    
    return {"status": "ok", "gift": gift_doc}


@router.delete("/shop/products/{product_id}/gift")
async def remove_product_gift(product_id: str, user: Dict = Depends(require_shop)):
    """Remove gift from a product"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    result = await db.product_gifts.delete_one({"product_id": product_id, "shop_id": shop["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No gift found for this product")
    
    return {"status": "ok", "message": "Gift removed"}


@router.get("/shop/products/{product_id}/gift")
async def get_product_gift(product_id: str, user: Dict = Depends(require_shop)):
    """Get gift info for a product (shop owner)"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    gift = await db.product_gifts.find_one({"product_id": product_id, "shop_id": shop["id"]}, {"_id": 0})
    return {"gift": gift}


@router.get("/shop/gifts")
async def get_shop_gifts(user: Dict = Depends(require_shop)):
    """Get all gifts for a shop"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    gifts = await db.product_gifts.find({"shop_id": shop["id"], "is_active": True}, {"_id": 0}).to_list(500)
    return {"gifts": gifts}


@router.get("/shop/spin/info")
async def get_shop_spin_info(user: Dict = Depends(require_shop)):
    """Get spin wheel info for a shop (available to all approved shops)"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    settings = await db.spin_settings.find_one({"id": "spin"}, {"_id": 0})
    if not settings:
        return {"enabled": False, "free_spins": 0, "spin_cost": 7, "is_pro": True}
    
    # Monthly free spin is a SUBSCRIPTION perk. Grant it (if a new monthly cycle is due,
    # measured from the shop's subscription date) via the unified benefits helper, then
    # read the current balance. Non-subscribed shops receive no monthly free spin.
    from services.helpers import grant_monthly_subscription_benefits, is_shop_subscribed
    await grant_monthly_subscription_benefits(shop)
    now = datetime.now(timezone.utc)
    subscribed = is_shop_subscribed(shop)
    spin_state = await db.shop_spin_state.find_one({"shop_id": shop["id"]}, {"_id": 0}) or {}
    free_spins = spin_state.get("free_spins_balance", 0) or shop.get("free_spins_balance", 0)
    
    # Get recent history
    history = await db.spin_history.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    
    # Only return ACTIVE outcomes (so shop sees exactly what admin enabled)
    active_outcomes = [
        {"key": o["key"], "label": o["label"], "weight": o.get("weight", 0), "payload": o.get("payload") or {}}
        for o in settings.get("outcomes", []) if o.get("is_active", True)
    ]
    
    return {
        "enabled": settings.get("enabled", True),
        "free_spins": free_spins,
        "spin_cost": settings.get("spin_cost_usd", 7),
        "is_pro": True,  # All shops are now treated equally
        "is_subscribed": subscribed,  # drives the "Subscribe to get a free spin" message
        "outcomes": active_outcomes,
        "history": history
    }


@router.post("/shop/spin/play")
async def play_spin(request: Request, user: Dict = Depends(require_shop)):
    """Play the spin wheel"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # NOTE: Tier-based gating removed — all approved shops can use the spin wheel.
    
    settings = await db.spin_settings.find_one({"id": "spin"}, {"_id": 0})
    if not settings or not settings.get("enabled"):
        raise HTTPException(status_code=400, detail="Spin wheel is currently disabled")
    
    body = await request.json()
    use_free_spin = body.get("use_free_spin", False)
    
    spin_cost = settings.get("spin_cost_usd", 7)
    spin_type = "paid"
    
    if use_free_spin:
        spin_state = await db.shop_spin_state.find_one({"shop_id": shop["id"]}, {"_id": 0})
        if not spin_state or spin_state.get("free_spins_balance", 0) <= 0:
            raise HTTPException(status_code=400, detail="No free spins available")
        spin_type = "monthly_free"
        # Deduct free spin
        await db.shop_spin_state.update_one(
            {"shop_id": shop["id"]},
            {"$inc": {"free_spins_balance": -1}}
        )
    else:
        # Deduct from wallet
        wallet_balance = shop.get("wallet_balance", 0)
        if wallet_balance < spin_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. You need ${spin_cost:.2f} but have ${wallet_balance:.2f}")
        
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$inc": {"wallet_balance": -spin_cost}}
        )
        # Record wallet transaction
        spin_txn_id = str(uuid.uuid4())
        await db.wallet_transactions.insert_one({
            "id": spin_txn_id,
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "type": "spin_purchase",
            "amount": -spin_cost,
            "status": "completed",
            "note": f"Lucky Spin Wheel - ${spin_cost:.2f}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        # Record admin revenue from spin (platform services)
        await db.admin_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "type": "platform_services",
            "subtype": "spin_wheel",
            "amount": spin_cost,
            "direction": "credit",
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "ref_id": spin_txn_id,
            "note": f"Spin wheel purchase by {shop.get('name', '')}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Choose outcome based on weights - only from ACTIVE outcomes
    outcomes = [o for o in settings.get("outcomes", []) if o.get("is_active", True)]
    if not outcomes:
        raise HTTPException(status_code=500, detail="No active spin outcomes configured")
    
    weights = [o.get("weight", 1) for o in outcomes]
    total_weight = sum(weights)
    rand_val = random.uniform(0, total_weight)
    cumulative = 0
    chosen_outcome = outcomes[-1]  # fallback
    for o in outcomes:
        cumulative += o.get("weight", 1)
        if rand_val <= cumulative:
            chosen_outcome = o
            break
    
    now = datetime.now(timezone.utc)
    applied_effects = {}
    
    # Check if commission_reduction is already active for this shop
    if chosen_outcome["key"] == "commission_reduction":
        existing_promo = await db.shop_commission_promos.find_one({
            "shop_id": shop["id"],
            "is_active": True,
            "expires_at": {"$gt": now.isoformat()}
        }, {"_id": 0})
        
        if existing_promo:
            # Already has active commission reduction - reject and give free re-spin
            applied_effects = {
                "type": "commission_reduction_rejected",
                "reason": "You already have an active commission reduction",
                "existing_expires_at": existing_promo.get("expires_at")
            }
            # Grant free re-spin
            await db.shop_spin_state.update_one(
                {"shop_id": shop["id"]},
                {"$inc": {"free_spins_balance": 1}},
                upsert=True
            )
            applied_effects["free_respin_granted"] = True
            
            # Record in history and return early
            history_entry = {
                "id": str(uuid.uuid4()),
                "shop_id": shop["id"],
                "spin_type": spin_type,
                "cost": 0 if spin_type != "paid" else spin_cost,
                "outcome_key": chosen_outcome["key"],
                "outcome_label": chosen_outcome["label"],
                "outcome_payload": chosen_outcome.get("payload", {}),
                "applied_effects": applied_effects,
                "created_at": now.isoformat()
            }
            await db.spin_history.insert_one(history_entry.copy())
            
            updated_spin_state = await db.shop_spin_state.find_one({"shop_id": shop["id"]}, {"_id": 0})
            updated_shop = await db.shops.find_one({"id": shop["id"]}, {"_id": 0, "wallet_balance": 1})
            
            return {
                "outcome": {
                    "key": chosen_outcome["key"],
                    "label": chosen_outcome["label"],
                    "payload": chosen_outcome.get("payload", {})
                },
                "applied_effects": applied_effects,
                "free_spins_remaining": updated_spin_state.get("free_spins_balance", 0) if updated_spin_state else 0,
                "wallet_balance": updated_shop.get("wallet_balance", 0) if updated_shop else 0,
                "spin_type": spin_type,
                "history_id": history_entry["id"]
            }
    
    # Apply effects
    if chosen_outcome["key"] == "free_sponsors_4":
        # Grant 4 free sponsor credits (each 7-day boost is free)
        count = chosen_outcome.get("payload", {}).get("count", 4)
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$inc": {"free_sponsor_credits": count}}
        )
        applied_effects = {"type": "free_sponsor_credits", "count": count}
    
    elif chosen_outcome["key"] == "free_sponsor_10_days":
        # Grant 1 long sponsorship (10 days)
        days = chosen_outcome.get("payload", {}).get("days", 10)
        count = chosen_outcome.get("payload", {}).get("count", 1)
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$inc": {"free_sponsor_10day_credits": count}}
        )
        applied_effects = {"type": "free_sponsor_10day", "count": count, "days": days}
    
    elif chosen_outcome["key"] == "free_theme":
        # Auto-assign a RANDOM theme — the shop does NOT pick one manually.
        unlocked = shop.get("themes_unlocked", ["classic"])
        all_themes = await db.storefront_themes.find({"enabled": True}, {"_id": 0, "key": 1, "name": 1}).to_list(100)
        locked = [t for t in all_themes if t.get("key") and t["key"] not in unlocked and t["key"] != "classic"]
        if locked:
            chosen_theme = random.choice(locked)
            unlocked.append(chosen_theme["key"])
            # Unlock it AND apply it as the shop's active storefront theme
            await db.shops.update_one(
                {"id": shop["id"]},
                {"$set": {"themes_unlocked": unlocked, "theme": chosen_theme["key"]}}
            )
            applied_effects = {
                "type": "free_theme",
                "theme_key": chosen_theme["key"],
                "theme_name": chosen_theme.get("name", chosen_theme["key"]),
            }
        else:
            # Shop already owns every theme — grant a credit so the win isn't wasted
            await db.shops.update_one({"id": shop["id"]}, {"$inc": {"free_theme_credits": 1}})
            applied_effects = {"type": "free_theme", "count": 1, "note": "All themes already unlocked"}
    
    elif chosen_outcome["key"] == "free_subscription":
        # Legacy outcome (kept for backward compat with old history) - convert to days credit no-op
        applied_effects = {"type": "legacy", "note": "Outcome no longer active"}
    
    elif chosen_outcome["key"] == "subscription_extension":
        # Legacy outcome (kept for backward compat with old history) - convert to days credit no-op
        applied_effects = {"type": "legacy", "note": "Outcome no longer active"}
    
    elif chosen_outcome["key"] in ["wallet_credit_small", "wallet_credit_large"]:
        amount = chosen_outcome.get("payload", {}).get("amount", 0)
        if amount > 0:
            await db.shops.update_one(
                {"id": shop["id"]},
                {"$inc": {"wallet_balance": amount}}
            )
            await db.wallet_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "shop_id": shop["id"],
                "shop_name": shop.get("name", ""),
                "type": "spin_reward",
                "amount": amount,
                "status": "completed",
                "note": f"Spin Wheel Reward: +${amount:.2f}",
                "created_at": now.isoformat()
            })
            applied_effects = {"type": "wallet_credit", "amount": amount}
    
    elif chosen_outcome["key"] == "commission_reduction":
        reduction = chosen_outcome.get("payload", {}).get("reduction_percent", 3)
        duration = chosen_outcome.get("payload", {}).get("duration_days", 9)
        expires_at = (now + timedelta(days=duration)).isoformat()
        
        promo = {
            "id": str(uuid.uuid4()),
            "shop_id": shop["id"],
            "reduction_percent": reduction,
            "duration_days": duration,
            "started_at": now.isoformat(),
            "expires_at": expires_at,
            "source": "spin_wheel",
            "is_active": True
        }
        await db.shop_commission_promos.insert_one(promo.copy())
        applied_effects = {"type": "commission_reduction", "reduction_percent": reduction, "duration_days": duration, "expires_at": expires_at}
    
    elif chosen_outcome["key"] == "another_spin":
        # Add a free spin
        await db.shop_spin_state.update_one(
            {"shop_id": shop["id"]},
            {"$inc": {"free_spins_balance": 1}},
            upsert=True
        )
        applied_effects = {"type": "another_spin"}
    
    elif chosen_outcome["key"] == "try_again":
        applied_effects = {"type": "try_again"}
    
    # Record in history
    history_entry = {
        "id": str(uuid.uuid4()),
        "shop_id": shop["id"],
        "spin_type": spin_type,
        "cost": 0 if spin_type != "paid" else spin_cost,
        "outcome_key": chosen_outcome["key"],
        "outcome_label": chosen_outcome["label"],
        "outcome_payload": chosen_outcome.get("payload", {}),
        "applied_effects": applied_effects,
        "created_at": now.isoformat()
    }
    await db.spin_history.insert_one(history_entry.copy())
    
    # Get updated free spins
    updated_spin_state = await db.shop_spin_state.find_one({"shop_id": shop["id"]}, {"_id": 0})
    updated_shop = await db.shops.find_one({"id": shop["id"]}, {"_id": 0, "wallet_balance": 1})
    
    return {
        "outcome": {
            "key": chosen_outcome["key"],
            "label": chosen_outcome["label"],
            "payload": chosen_outcome.get("payload", {})
        },
        "applied_effects": applied_effects,
        "free_spins_remaining": updated_spin_state.get("free_spins_balance", 0) if updated_spin_state else 0,
        "wallet_balance": updated_shop.get("wallet_balance", 0) if updated_shop else 0,
        "spin_type": spin_type,
        "history_id": history_entry["id"]
    }


@router.get("/shop/spin/history")
async def get_shop_spin_history(user: Dict = Depends(require_shop)):
    """Get spin history for current shop"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    history = await db.spin_history.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"history": history}


@router.get("/shop/subscription/status")
async def get_shop_subscription_status(user: Dict = Depends(require_shop)):
    """Get shop subscription status with renewal info and warnings"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    tiers = settings.get("tiers", {}) if settings else {}
    
    tier = shop.get("tier", "starter")
    tier_config = tiers.get(tier, {})
    
    subscription_end = shop.get("subscription_end")
    days_left = None
    is_near_expiry = False
    wallet_sufficient = True
    
    # Calculate renewal price based on auto_renew_period
    auto_renew_period = shop.get("auto_renew_period", "monthly")
    if auto_renew_period == "yearly":
        renewal_price = tier_config.get("yearly_price", 0)
    else:
        renewal_price = tier_config.get("monthly_price", 19)
    
    wallet_balance = shop.get("wallet_balance", 0) or 0
    
    if subscription_end:
        try:
            end_date = parse_datetime_aware(subscription_end)
            if end_date:
                days_left = max(0, (end_date - datetime.now(timezone.utc)).days)
                is_near_expiry = days_left <= 7
                wallet_sufficient = wallet_balance >= renewal_price
        except:
            pass
    
    return {
        "subscription_status": shop.get("subscription_status", "none"),
        "subscription_required": shop.get("subscription_required", True),
        "subscription_end": subscription_end,
        "days_left": days_left,
        "is_near_expiry": is_near_expiry,
        "tier": tier,
        "tier_name": tier_config.get("name", tier.title()),
        "auto_renew_enabled": shop.get("auto_renew_enabled", False),
        "auto_renew_period": shop.get("auto_renew_period", "monthly"),
        "renewal_price": renewal_price,
        "wallet_balance": wallet_balance,
        "wallet_sufficient": wallet_sufficient,
        "monthly_price": tier_config.get("monthly_price", 19),
        "yearly_price": tier_config.get("yearly_price", 0),
    }


@router.post("/shop/subscription/auto-renew")
async def toggle_auto_renew(request: Request, user: Dict = Depends(require_shop)):
    """Auto-renew is always enabled - just update period"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    body = await request.json()
    period = body.get("period", "monthly")
    
    if period not in ["monthly", "yearly"]:
        raise HTTPException(status_code=400, detail="Period must be 'monthly' or 'yearly'")
    
    # Auto-renew is always on
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {"auto_renew_enabled": True, "auto_renew_period": period}}
    )
    
    return {"message": "Auto-renew is always enabled", "auto_renew_enabled": True, "auto_renew_period": period}


@router.post("/shop/subscription/renew-now")
async def renew_subscription_now(request: Request, user: Dict = Depends(require_shop)):
    """Renew subscription immediately using wallet balance"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    body = await request.json()
    period = body.get("period", "monthly")
    
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    tiers = settings.get("tiers", {}) if settings else {}
    tier = shop.get("tier", "starter")
    tier_config = tiers.get(tier, {})
    
    if period == "yearly":
        price = tier_config.get("yearly_price", 0)
        duration_days = 365
    else:
        price = tier_config.get("monthly_price", 19)
        duration_days = 30
    
    wallet_balance = shop.get("wallet_balance", 0) or 0
    if wallet_balance < price:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Need ${price:.2f}, have ${wallet_balance:.2f}")
    
    now = datetime.now(timezone.utc)
    
    # Calculate new subscription end
    current_end = shop.get("subscription_end")
    if current_end:
        try:
            end_date = parse_datetime_aware(current_end)
            if end_date and end_date > now:
                new_end = end_date + timedelta(days=duration_days)
            else:
                new_end = now + timedelta(days=duration_days)
        except:
            new_end = now + timedelta(days=duration_days)
    else:
        new_end = now + timedelta(days=duration_days)
    
    new_balance = round(wallet_balance - price, 2)
    
    # Update shop
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {
            "wallet_balance": new_balance,
            "subscription_status": "active",
            "subscription_end": new_end.isoformat(),
            "auto_renew_period": period,
        }}
    )
    
    # Record wallet transaction
    renew_txn_id = str(uuid.uuid4())
    await db.wallet_transactions.insert_one({
        "id": renew_txn_id,
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "type": "subscription_renewal",
        "amount": -price,
        "balance_after": new_balance,
        "status": "completed",
        "note": f"Subscription renewal ({period}) - {tier.title()} tier",
        "created_at": now.isoformat()
    })
    
    # Record admin revenue (subscriptions)
    await db.admin_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "type": "subscriptions",
        "subtype": f"wallet_renewal_{period}",
        "amount": price,
        "direction": "credit",
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "ref_id": renew_txn_id,
        "note": f"Subscription renewal ({period}) by {shop.get('name', '')} via wallet - {tier.title()} tier",
        "created_at": now.isoformat()
    })
    
    return {
        "message": f"Subscription renewed for {duration_days} days",
        "new_end": new_end.isoformat(),
        "wallet_balance": new_balance,
        "amount_charged": price
    }


@router.get("/shop/storefront/themes")
async def get_shop_themes(user: Dict = Depends(require_shop)):
    """Shop: Get theme catalog with unlock status"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    themes = await db.storefront_themes.find({"enabled": True}, {"_id": 0}).to_list(100)
    if not themes:
        await seed_storefront_themes()
        themes = await db.storefront_themes.find({"enabled": True}, {"_id": 0}).to_list(100)
    
    unlocked = shop.get("themes_unlocked", ["classic"])
    current_theme = shop.get("theme", "classic")
    is_pro = shop.get("tier") == "pro"
    # No automatic free theme — shops only get free themes by winning them on the Spin Wheel.
    free_unlocks = shop.get("free_theme_unlocks_remaining", 0)
    
    enriched = []
    for t in themes:
        is_unlocked = t["key"] in unlocked or t["key"] == "classic"
        enriched.append({
            **t,
            "is_unlocked": is_unlocked,
            "is_current": t["key"] == current_theme,
            "can_apply": is_unlocked,
        })
    
    return {
        "themes": enriched,
        "current_theme": current_theme,
        "theme_accent": shop.get("theme_accent", ""),
        "theme_banner": shop.get("theme_banner", ""),
        "is_pro": is_pro,
        "free_unlocks_remaining": free_unlocks,
        "free_theme_credits": shop.get("free_theme_credits", 0) or 0,
        "wallet_balance": shop.get("wallet_balance", 0),
        "unlocked_themes": unlocked,
    }


@router.post("/shop/storefront/theme/purchase")
async def purchase_theme(request: Request, user: Dict = Depends(require_shop)):
    """Shop: Purchase/unlock a storefront theme"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if shop.get("tier") != "pro":
        raise HTTPException(status_code=403, detail="Only Pro shops can purchase themes. Starter shops use the Classic theme.")
    
    body = await request.json()
    theme_key = body.get("theme_key")
    if not theme_key:
        raise HTTPException(status_code=400, detail="theme_key is required")
    
    theme = await db.storefront_themes.find_one({"key": theme_key, "enabled": True}, {"_id": 0})
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    unlocked = shop.get("themes_unlocked", ["classic"])
    if theme_key in unlocked:
        raise HTTPException(status_code=400, detail="Theme already unlocked")
    
    free_unlocks = shop.get("free_theme_unlocks_remaining", 0)
    free_theme_credits = shop.get("free_theme_credits", 0) or 0
    now = datetime.now(timezone.utc)
    
    if free_unlocks > 0:
        # Use free unlock
        unlocked.append(theme_key)
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$set": {
                "themes_unlocked": unlocked,
                "free_theme_unlocks_remaining": free_unlocks - 1
            }}
        )
        return {"message": f"Theme '{theme['name']}' unlocked for free!", "themes_unlocked": unlocked, "free_unlocks_remaining": free_unlocks - 1}
    
    if free_theme_credits > 0:
        # Use spin-wheel free theme credit
        unlocked.append(theme_key)
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$set": {"themes_unlocked": unlocked},
             "$inc": {"free_theme_credits": -1}}
        )
        return {"message": f"Theme '{theme['name']}' unlocked using your free-theme credit from the Spin Wheel!", "themes_unlocked": unlocked, "free_theme_credits_remaining": max(0, free_theme_credits - 1)}
    
    # Paid unlock - apply sale discount if present
    base_price = theme.get("price_usd", 6.0)
    # Check for global theme sale
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    theme_sale_percent = (platform_settings or {}).get("theme_sale_percent", 0)
    if theme_sale_percent > 0 and theme_sale_percent <= 100:
        price = round(base_price * (1 - theme_sale_percent / 100), 2)
    else:
        price = base_price
    
    wallet_balance = shop.get("wallet_balance", 0) or 0
    if wallet_balance < price:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Need ${price:.2f}, have ${wallet_balance:.2f}")
    
    new_balance = round(wallet_balance - price, 2)
    unlocked.append(theme_key)
    
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {"wallet_balance": new_balance, "themes_unlocked": unlocked}}
    )
    
    # Record wallet transaction
    txn_id = str(uuid.uuid4())
    await db.wallet_transactions.insert_one({
        "id": txn_id, "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "type": "theme_purchase", "amount": -price, "balance_after": new_balance,
        "status": "completed", "note": f"Unlocked theme: {theme['name']}",
        "created_at": now.isoformat()
    })
    
    # Record admin revenue
    await db.admin_ledger.insert_one({
        "id": str(uuid.uuid4()), "type": "platform_services", "subtype": "theme_unlock",
        "amount": price, "direction": "credit",
        "shop_id": shop["id"], "shop_name": shop.get("name", ""),
        "ref_id": txn_id, "note": f"Theme unlock '{theme['name']}' by {shop.get('name', '')}",
        "created_at": now.isoformat()
    })
    
    return {"message": f"Theme '{theme['name']}' purchased!", "themes_unlocked": unlocked, "wallet_balance": new_balance}


@router.post("/shop/storefront/theme/apply")
async def apply_theme(request: Request, user: Dict = Depends(require_shop)):
    """Shop: Apply a theme to the storefront"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    body = await request.json()
    theme_key = body.get("theme_key", "classic")
    theme_accent = body.get("theme_accent", "")
    theme_banner = body.get("theme_banner", "")
    
    # Starter forced to classic
    if shop.get("tier") != "pro" and theme_key != "classic":
        raise HTTPException(status_code=403, detail="Starter shops can only use the Classic theme. Upgrade to Pro for premium themes.")
    
    # Check if theme is unlocked
    unlocked = shop.get("themes_unlocked", ["classic"])
    if theme_key != "classic" and theme_key not in unlocked:
        raise HTTPException(status_code=403, detail="Theme not unlocked. Please purchase it first.")
    
    update = {"theme": theme_key}
    if theme_accent:
        update["theme_accent"] = theme_accent
    if theme_banner:
        update["theme_banner"] = theme_banner
    
    await db.shops.update_one({"id": shop["id"]}, {"$set": update})
    return {"message": f"Theme applied: {theme_key}", "theme": theme_key, "theme_accent": theme_accent}


@router.put("/shop/location")
async def update_shop_location(request: Request, user: Dict = Depends(require_shop)):
    """Update shop location (latitude, longitude, address)"""
    body = await request.json()
    lat = body.get("latitude")
    lng = body.get("longitude")
    location_address = body.get("location_address", "")
    
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Latitude and longitude are required")
    
    update = {
        "latitude": float(lat),
        "longitude": float(lng),
        "location_address": location_address
    }
    
    result = await db.shops.find_one_and_update(
        {"user_id": user["user_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Shop not found")
    return {"message": "Location updated", "latitude": lat, "longitude": lng, "location_address": location_address}


@router.get("/shop/location")
async def get_shop_location(user: Dict = Depends(require_shop)):
    """Get shop location"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "latitude": 1, "longitude": 1, "location_address": 1, "name": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/shop/onboarding-status")
async def get_shop_onboarding_status(user: Dict = Depends(require_shop)):
    """Get shop onboarding progress for the setup wizard"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    shop_id = shop["id"]
    
    # Step 1: Has products?
    product_count = await db.products.count_documents({"shop_id": shop_id, "is_active": True})
    has_products = product_count > 0
    
    # Step 2: Verification submitted? (location removed per requirements)
    verification = await db.shop_verifications.find_one({"shop_id": shop_id}, {"_id": 0})
    verification_status = verification.get("status") if verification else None
    is_verified = shop.get("is_verified", False)
    
    # Step 3: Profile complete?
    has_description = bool(shop.get("description"))
    has_phone = bool(shop.get("phone"))
    profile_complete = has_description and has_phone
    
    steps = [
        {"id": "products", "title": "Add Your Products", "description": "List at least one product to start selling", "completed": has_products, "link": "/shop/products", "count": product_count},
        {"id": "profile", "title": "Complete Your Profile", "description": "Add a description and contact info", "completed": profile_complete, "link": "/shop/settings"},
        {"id": "verification", "title": "Get Verified", "description": "Earn a verified badge for higher trust", "completed": is_verified, "link": "/shop/verification", "status": verification_status},
    ]
    
    completed_count = sum(1 for s in steps if s["completed"])
    total_steps = len(steps)
    
    # Onboarding cannot be dismissed - always show until complete
    return {
        "steps": steps,
        "completed": completed_count,
        "total": total_steps,
        "progress": round((completed_count / total_steps) * 100),
        "all_complete": completed_count == total_steps,
        "dismissed": False,
        "shop_name": shop.get("name", ""),
    }


@router.post("/shop/onboarding-dismiss")
async def dismiss_onboarding(user: Dict = Depends(require_shop)):
    """Dismiss the onboarding wizard"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    await db.shops.update_one({"id": shop["id"]}, {"$set": {"onboarding_dismissed": True}})
    return {"message": "Onboarding dismissed"}


@router.get("/shop/verification/status")
async def get_shop_verification_status(user: Dict = Depends(require_shop)):
    """Get current verification status for the shop"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    verification = await db.shop_verifications.find_one({"shop_id": shop["id"]}, {"_id": 0})
    
    has_location = bool(shop.get("latitude") and shop.get("longitude"))
    
    documents = verification.get("documents", {}) if verification else {}
    
    return {
        "is_verified": shop.get("is_verified", False),
        "verification_status": verification.get("status") if verification else "not_started",
        "email_verified": verification.get("email_verified", False) if verification else False,
        "location_set": has_location,
        "document_uploaded": verification.get("document_uploaded", False) if verification else False,
        "document_url": verification.get("document_url") if verification else None,
        "documents": documents,
        "document_type": verification.get("document_type") if verification else None,
        "submitted_at": verification.get("submitted_at") if verification else None,
        "rejection_reason": verification.get("rejection_reason") if verification else None,
    }


@router.post("/shop/verification/email/send-code")
async def send_verification_email_code(user: Dict = Depends(require_shop)):
    """Send a verification code to the shop's email"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Generate 6-digit code
    code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store or update verification record
    await db.shop_verifications.update_one(
        {"shop_id": shop["id"]},
        {"$set": {
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "email": shop.get("email", user.get("email", "")),
            "email_code": code,
            "email_code_expires": expires_at.isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }, "$setOnInsert": {
            "status": "in_progress",
            "email_verified": False,
            "document_uploaded": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Try sending email
    shop_email = shop.get("email", user.get("email", ""))
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7c3aed;">Shop Verification Code</h2>
        <p>Your verification code for <strong>{shop.get('name', 'your shop')}</strong> is:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 12px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">{code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
    </div>
    """
    await send_email_async(shop_email, "OpenMarket - Shop Verification Code", html)
    
    # Always return code in dev mode (no SMTP configured)
    response = {"message": "Verification code sent", "email": shop_email}
    if not SMTP_USER or not SMTP_PASS:
        response["dev_code"] = code
    return response


@router.post("/shop/verification/email/verify")
async def verify_shop_email(code: str = "", user: Dict = Depends(require_shop)):
    """Verify the email code"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    verification = await db.shop_verifications.find_one({"shop_id": shop["id"]})
    if not verification:
        raise HTTPException(status_code=400, detail="No verification started")
    
    stored_code = verification.get("email_code")
    expires = verification.get("email_code_expires", "")
    
    if not stored_code:
        raise HTTPException(status_code=400, detail="No code sent. Please request a new code.")
    
    # Check expiry
    if expires and datetime.now(timezone.utc).isoformat() > expires:
        raise HTTPException(status_code=400, detail="Code expired. Please request a new code.")
    
    if code != stored_code:
        raise HTTPException(status_code=400, detail="Invalid code")
    
    await db.shop_verifications.update_one(
        {"shop_id": shop["id"]},
        {"$set": {"email_verified": True, "email_code": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Email verified successfully", "email_verified": True}


@router.post("/shop/verification/document/upload")
async def upload_verification_document(file: UploadFile = File(...), doc_type: str = "id_front", user: Dict = Depends(require_shop)):
    """Upload ID/Passport document for verification. doc_type: id_front, id_back, passport"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.pdf', '.webp'}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, PDF, WEBP files allowed")
    
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    unique_filename = f"verification_{shop['id']}_{doc_type}_{uuid.uuid4()}{file_ext}"
    file_path = UPLOADS_DIR / unique_filename
    with open(file_path, "wb") as f:
        f.write(contents)
    
    doc_url = f"/api/uploads/{unique_filename}"
    
    # Update the verification record with document info
    update_fields = {
        f"documents.{doc_type}": doc_url,
        "document_uploaded": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Also keep legacy document_url for backward compat
    update_fields["document_url"] = doc_url
    
    await db.shop_verifications.update_one(
        {"shop_id": shop["id"]},
        {"$set": update_fields}
    )
    
    return {"message": "Document uploaded", "document_url": doc_url, "doc_type": doc_type}


@router.delete("/shop/verification/document/{doc_type}")
async def delete_verification_document(doc_type: str, user: Dict = Depends(require_shop)):
    """Remove a specific uploaded document"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    verification = await db.shop_verifications.find_one({"shop_id": shop["id"]})
    if not verification:
        raise HTTPException(status_code=404, detail="No verification found")
    
    documents = verification.get("documents", {})
    if doc_type in documents:
        # Delete the file
        file_url = documents[doc_type]
        filename = file_url.split("/")[-1]
        file_path = UPLOADS_DIR / filename
        if file_path.exists():
            file_path.unlink()
        
        # Remove from DB
        await db.shop_verifications.update_one(
            {"shop_id": shop["id"]},
            {"$unset": {f"documents.{doc_type}": ""}}
        )
        
        # Check if any documents remain
        remaining = {k: v for k, v in documents.items() if k != doc_type}
        if not remaining:
            await db.shop_verifications.update_one(
                {"shop_id": shop["id"]},
                {"$set": {"document_uploaded": False, "document_url": None}}
            )
    
    return {"message": f"Document '{doc_type}' removed"}


@router.post("/shop/verification/submit")
async def submit_shop_verification(user: Dict = Depends(require_shop)):
    """Submit verification request for admin review"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if shop.get("is_verified"):
        raise HTTPException(status_code=400, detail="Shop is already verified")
    
    verification = await db.shop_verifications.find_one({"shop_id": shop["id"]})
    if not verification:
        raise HTTPException(status_code=400, detail="Please complete verification steps first")
    
    if not verification.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email not verified")
    
    has_location = bool(shop.get("latitude") and shop.get("longitude"))
    if not has_location:
        raise HTTPException(status_code=400, detail="Shop location not set")
    
    if not verification.get("document_uploaded"):
        raise HTTPException(status_code=400, detail="Document not uploaded")
    
    await db.shop_verifications.update_one(
        {"shop_id": shop["id"]},
        {"$set": {
            "status": "pending",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify admin about new verification request
    await create_notification(
        recipient_type="admin",
        title="New Verification Request",
        message=f"Shop '{shop.get('name', '')}' has submitted a verification request. Review their documents.",
        notification_type="system",
        link="/admin/verification-requests"
    )
    
    return {"message": "Verification submitted for review", "status": "pending"}



# ============ SHOP SALES / DISCOUNTS ============

class ShopSaleCreate(BaseModel):
    discount_percent: float  # 5-90%
    end_date: str  # ISO date string
    title: Optional[str] = None
    description: Optional[str] = None

class ShopSaleUpdate(BaseModel):
    discount_percent: Optional[float] = None
    end_date: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/shop/sales/preview")
async def preview_shop_sale(sale_data: ShopSaleCreate, user: Dict = Depends(require_shop)):
    """Preview which products have a higher existing discount than the proposed sale"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    products = await db.products.find({"shop_id": shop["id"]}, {"_id": 0}).to_list(5000)
    higher_discount_products = []
    for p in products:
        if p.get("discount_price") and p.get("price") and p["discount_price"] < p["price"]:
            existing_discount_pct = round(((p["price"] - p["discount_price"]) / p["price"]) * 100, 1)
            if existing_discount_pct > sale_data.discount_percent:
                higher_discount_products.append({
                    "id": p["id"],
                    "name": p["name"],
                    "price": p["price"],
                    "discount_price": p["discount_price"],
                    "existing_discount_percent": existing_discount_pct,
                    "image": (p.get("images") or [None])[0],
                })
    return {"products_with_higher_discount": higher_discount_products, "total": len(higher_discount_products)}


@router.get("/shop/sales")
async def get_shop_sales(user: Dict = Depends(require_shop)):
    """Get all sales for this shop"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    sales = await db.shop_sales.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return sales


@router.post("/shop/sales")
async def create_shop_sale(sale_data: ShopSaleCreate, user: Dict = Depends(require_shop)):
    """Create a new shop-wide sale"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if sale_data.discount_percent < 1 or sale_data.discount_percent > 90:
        raise HTTPException(status_code=400, detail="Discount must be between 1% and 90%")
    
    # Check for active sale overlap
    active = await db.shop_sales.find_one({"shop_id": shop["id"], "is_active": True, "end_date": {"$gt": datetime.now(timezone.utc).isoformat()}})
    if active:
        raise HTTPException(status_code=400, detail="You already have an active sale. Edit or delete it first.")
    
    # Save original prices for all products before applying sale
    products = await db.products.find({"shop_id": shop["id"]}, {"_id": 0}).to_list(5000)
    original_prices = {}
    for p in products:
        original_prices[p["id"]] = {
            "price": p.get("price", 0),
            "discount_price": p.get("discount_price"),
        }
    
    sale_id = str(uuid.uuid4())
    sale_doc = {
        "id": sale_id,
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "discount_percent": sale_data.discount_percent,
        "title": sale_data.title or f"{int(sale_data.discount_percent)}% OFF Everything",
        "description": sale_data.description or "",
        "end_date": sale_data.end_date,
        "is_active": True,
        "original_prices": original_prices,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.shop_sales.insert_one(sale_doc)
    
    # Apply sale discount to all products — always % OFF the original price, not stacked
    discount_factor = 1 - (sale_data.discount_percent / 100)
    for p in products:
        base_price = p.get("price", 0)  # always use original price, NOT discount_price
        new_discount_price = round(base_price * discount_factor, 2)
        await db.products.update_one(
            {"id": p["id"]},
            {"$set": {
                "discount_price": new_discount_price,
                "shop_sale_id": sale_id,
                "shop_sale_discount": sale_data.discount_percent,
                "shop_sale_title": sale_doc["title"],
            }}
        )
    
    return {k: v for k, v in sale_doc.items() if k != "_id"}


@router.put("/shop/sales/{sale_id}")
async def update_shop_sale(sale_id: str, sale_data: ShopSaleUpdate, user: Dict = Depends(require_shop)):
    """Update a shop sale"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    sale = await db.shop_sales.find_one({"id": sale_id, "shop_id": shop["id"]}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    update = {}
    if sale_data.discount_percent is not None:
        if sale_data.discount_percent < 1 or sale_data.discount_percent > 90:
            raise HTTPException(status_code=400, detail="Discount must be between 1% and 90%")
        update["discount_percent"] = sale_data.discount_percent
    if sale_data.end_date is not None:
        update["end_date"] = sale_data.end_date
    if sale_data.title is not None:
        update["title"] = sale_data.title
    if sale_data.description is not None:
        update["description"] = sale_data.description
    if sale_data.is_active is not None:
        update["is_active"] = sale_data.is_active
    
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    
    result = await db.shop_sales.find_one_and_update(
        {"id": sale_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    
    # Re-apply prices if discount changed — always % OFF original price
    if "discount_percent" in update and sale.get("is_active"):
        original_prices = sale.get("original_prices", {})
        discount_factor = 1 - (update["discount_percent"] / 100)
        for pid, prices in original_prices.items():
            base_price = prices.get("price", 0)  # always use original price
            new_discount = round(base_price * discount_factor, 2)
            await db.products.update_one(
                {"id": pid},
                {"$set": {"discount_price": new_discount, "shop_sale_discount": update["discount_percent"]}}
            )
    
    # If deactivated, restore original prices
    if update.get("is_active") is False:
        original_prices = sale.get("original_prices", {})
        for pid, prices in original_prices.items():
            restore_fields = {"discount_price": prices.get("discount_price")}
            await db.products.update_one(
                {"id": pid},
                {"$set": restore_fields, "$unset": {"shop_sale_id": "", "shop_sale_discount": "", "shop_sale_title": ""}}
            )
    
    return result


@router.delete("/shop/sales/{sale_id}")
async def delete_shop_sale(sale_id: str, user: Dict = Depends(require_shop)):
    """Delete a shop sale and restore original prices"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    sale = await db.shop_sales.find_one({"id": sale_id, "shop_id": shop["id"]}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Restore original prices
    original_prices = sale.get("original_prices", {})
    for pid, prices in original_prices.items():
        restore_fields = {"discount_price": prices.get("discount_price")}
        await db.products.update_one(
            {"id": pid},
            {"$set": restore_fields, "$unset": {"shop_sale_id": "", "shop_sale_discount": "", "shop_sale_title": ""}}
        )
    
    await db.shop_sales.delete_one({"id": sale_id})
    return {"message": "Sale deleted and prices restored"}


@router.get("/shop/sales/active")
async def get_active_shop_sale(user: Dict = Depends(require_shop)):
    """Get currently active sale for this shop"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    now = datetime.now(timezone.utc).isoformat()
    sale = await db.shop_sales.find_one(
        {"shop_id": shop["id"], "is_active": True, "end_date": {"$gt": now}},
        {"_id": 0}
    )
    return sale


# ==================== SHOP GALLERY ====================

@router.get("/shop/gallery")
async def get_shop_gallery(user: Dict = Depends(require_shop)):
    """Get the gallery of the current shop"""
    shop = await db.shops.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "id": 1, "gallery": 1}
    )
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return {"gallery": shop.get("gallery", [])}


@router.post("/shop/gallery")
async def add_shop_gallery_photos(request: Request, user: Dict = Depends(require_shop)):
    """Add one or more photos to the shop gallery.
    Body: { "photos": [{"url": str, "caption": str?}, ...] } or { "url": str, "caption": str? }
    """
    body = await request.json()
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Accept either { photos: [..] } or single { url, caption }
    incoming = []
    if isinstance(body, dict):
        if "photos" in body and isinstance(body.get("photos"), list):
            incoming = body["photos"]
        elif "url" in body:
            incoming = [body]
    
    if not incoming:
        raise HTTPException(status_code=400, detail="No photos provided")
    
    now = datetime.now(timezone.utc).isoformat()
    new_items = []
    for item in incoming:
        if not isinstance(item, dict) or not item.get("url"):
            continue
        new_items.append({
            "id": str(uuid.uuid4()),
            "url": item["url"],
            "caption": item.get("caption", ""),
            "status": "pending",  # new photos pending admin moderation
            "created_at": now
        })
    
    if not new_items:
        raise HTTPException(status_code=400, detail="No valid photos to add")
    
    existing = shop.get("gallery", []) or []
    updated_gallery = existing + new_items
    
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {"gallery": updated_gallery}}
    )
    
    return {"message": "Photos added", "added": new_items, "gallery": updated_gallery}


@router.put("/shop/gallery/reorder")
async def reorder_shop_gallery(request: Request, user: Dict = Depends(require_shop)):
    """Reorder gallery by providing array of photo ids in new order.
    Body: { "order": ["photo_id_1", "photo_id_2", ...] }
    """
    body = await request.json()
    new_order_ids = body.get("order", [])
    if not isinstance(new_order_ids, list):
        raise HTTPException(status_code=400, detail="`order` must be a list of photo ids")
    
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    gallery = shop.get("gallery", []) or []
    by_id = {p.get("id"): p for p in gallery}
    new_gallery = []
    for pid in new_order_ids:
        if pid in by_id:
            new_gallery.append(by_id[pid])
    # Append any not in order list
    for p in gallery:
        if p.get("id") not in new_order_ids:
            new_gallery.append(p)
    
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {"gallery": new_gallery}}
    )
    return {"message": "Gallery reordered", "gallery": new_gallery}


@router.put("/shop/gallery/{photo_id}")
async def update_shop_gallery_photo(photo_id: str, request: Request, user: Dict = Depends(require_shop)):
    """Update a gallery photo's caption"""
    body = await request.json()
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    gallery = shop.get("gallery", []) or []
    found = False
    for item in gallery:
        if item.get("id") == photo_id:
            if "caption" in body:
                item["caption"] = body["caption"]
            if "url" in body and body["url"]:
                item["url"] = body["url"]
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {"gallery": gallery}}
    )
    return {"message": "Photo updated", "gallery": gallery}


@router.delete("/shop/gallery/{photo_id}")
async def delete_shop_gallery_photo(photo_id: str, user: Dict = Depends(require_shop)):
    """Delete a single photo from the shop gallery"""
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    gallery = shop.get("gallery", []) or []
    new_gallery = [p for p in gallery if p.get("id") != photo_id]
    
    if len(new_gallery) == len(gallery):
        raise HTTPException(status_code=404, detail="Photo not found")
    
    await db.shops.update_one(
        {"id": shop["id"]},
        {"$set": {"gallery": new_gallery}}
    )
    return {"message": "Photo deleted", "gallery": new_gallery}
