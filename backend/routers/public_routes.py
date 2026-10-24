"""
OpenMarket Lebanon - Public Routes
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
from services.helpers import apply_commission_to_product, calc_next_tier, calc_redemption_value, calc_tier, check_and_run_auto_renewals, check_and_run_monthly_credit, create_notification, generate_conversation_id, get_commission_rate, get_default_loyalty_settings, get_loyalty_settings, get_recipient_name, get_shop_commission_info, parse_datetime_aware, periodic_auto_renewal_check, run_seller_model_migration, seed_storefront_themes

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

# OpenAI client for AI chat & smart-search. Guarded so the module still imports
# if the package or key is missing (endpoints fall back gracefully when None).
try:
    from openai import AsyncOpenAI
    from config import OPENAI_API_KEY, OPENAI_MODEL
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
except Exception:
    openai_client = None
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

router = APIRouter()



def generate_conversation_id(sender_id: str, sender_type: str, recipient_id: str, recipient_type: str) -> str:
    """Generate a consistent conversation ID between two parties"""
    import hashlib
    # Sort to ensure same ID regardless of who sends first
    parties = sorted([f"{sender_type}:{sender_id}", f"{recipient_type}:{recipient_id}"])
    hash_input = '_'.join(parties)
    return f"conv_{hashlib.sha256(hash_input.encode()).hexdigest()[:12]}"


async def get_recipient_name(recipient_id: str, recipient_type: str) -> str:
    """Get the name of a recipient"""
    if recipient_type == "admin":
        user = await db.users.find_one({"id": recipient_id}, {"_id": 0})
        return user.get("name", "Admin") if user else "Admin"
    elif recipient_type == "shop":
        shop = await db.shops.find_one({"id": recipient_id}, {"_id": 0})
        return shop.get("name", "Shop") if shop else "Shop"
    elif recipient_type in ("customer", "user"):
        user = await db.users.find_one({"id": recipient_id}, {"_id": 0})
        return user.get("name", "Customer") if user else "Customer"
    elif recipient_type == "agent":
        user = await db.users.find_one({"id": recipient_id}, {"_id": 0})
        return (user.get("name") or "Agent") if user else "Agent"
    return "Unknown"


async def is_messaging_blocked(entity_type: str, entity_id: str) -> bool:
    """Return True if a customer/shop is blocked from messaging by admin."""
    if not entity_id:
        return False
    # Normalise 'user' -> 'customer'
    et = "customer" if entity_type in ("customer", "user") else entity_type
    block = await db.messaging_blocks.find_one({"entity_type": et, "entity_id": entity_id})
    return bool(block)


async def build_product_snapshot(product_id: str) -> Optional[dict]:
    """Build a lightweight product snapshot for product attachments in messages."""
    if not product_id:
        return None
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        return None
    images = p.get("images") or []
    image = p.get("image") or (images[0] if images else None)
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "price": p.get("price"),
        "discount_price": p.get("discount_price"),
        "image": image,
        "shop_id": p.get("shop_id"),
        "shop_name": p.get("shop_name"),
    }


def calc_next_tier(lifetime_points: float, tiers: list) -> Optional[dict]:
    """Get the next tier info"""
    sorted_tiers = sorted(tiers, key=lambda t: t["min_points"])
    for tier in sorted_tiers:
        if tier["min_points"] > lifetime_points:
            return tier
    return None


async def check_and_run_monthly_credit():
    """Check if monthly wallet credit has been run this month, if not run it"""
    try:
        settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
        if not settings:
            return
        
        now = datetime.now(timezone.utc)
        current_month = now.strftime("%Y-%m")
        last_run = settings.get("wallet_monthly_credit_last_run", "")
        
        if last_run == current_month:
            return  # Already run this month
        
        tiers = settings.get("tiers", {})
        active_shops = await db.shops.find(
            {"subscription_status": {"$in": ["active", "trial"]}, "status": "approved"},
            {"_id": 0}
        ).to_list(1000)
        
        for shop in active_shops:
            last_credit = shop.get("wallet_last_monthly_credit")
            if last_credit and last_credit.startswith(current_month):
                continue
            
            tier = shop.get("tier", "starter")
            tier_config = tiers.get(tier, {})
            credit_amount = tier_config.get("monthly_wallet_credit", 1 if tier == "starter" else 3)
            
            if credit_amount <= 0:
                continue
            
            current_balance = shop.get("wallet_balance", 0) or 0
            new_balance = round(current_balance + credit_amount, 2)
            
            await db.shops.update_one(
                {"id": shop["id"]},
                {"$set": {"wallet_balance": new_balance, "wallet_last_monthly_credit": current_month}}
            )
            
            bg_credit_txn_id = str(uuid.uuid4())
            await db.wallet_transactions.insert_one({
                "id": bg_credit_txn_id, "shop_id": shop["id"], "shop_name": shop.get("name", ""),
                "type": "monthly_credit", "amount": credit_amount, "balance_after": new_balance,
                "status": "completed", "note": f"{tier.title()} tier monthly wallet credit ({current_month})",
                "created_at": now.isoformat()
            })
            
            # Record admin ledger debit for monthly credit
            await db.admin_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "type": "monthly_credits",
                "subtype": f"{tier}_monthly_credit",
                "amount": credit_amount,
                "direction": "debit",
                "shop_id": shop["id"],
                "shop_name": shop.get("name", ""),
                "ref_id": bg_credit_txn_id,
                "note": f"Monthly ${credit_amount} credit given to {shop.get('name', '')} ({tier.title()} tier)",
                "created_at": now.isoformat()
            })
        
        # Mark as run
        await db.platform_settings.update_one(
            {"id": "platform"},
            {"$set": {"wallet_monthly_credit_last_run": current_month}}
        )
    except Exception as e:
        print(f"Monthly credit check error: {e}")


async def run_seller_model_migration():
    """Idempotent migration:
    - Force card_subscription_enabled = False (card subscription removed).
    - Drop the legacy 'starter' tier from platform_settings.tiers (only 'pro' remains).
    - Migrate any shops still on 'starter' tier to 'pro'.
    - Backfill commission_type ('on_customer') and subscription_required (True) on shops.
    """
    try:
        # Platform settings: disable card subscription, drop starter tier
        await db.platform_settings.update_one(
            {"id": "platform"},
            {"$set": {"card_subscription_enabled": False},
             "$unset": {"tiers.starter": ""}}
        )
        # Migrate shops still on starter tier
        await db.shops.update_many({"tier": "starter"}, {"$set": {"tier": "pro"}})
        # Backfill defaults on existing shops
        await db.shops.update_many(
            {"commission_type": {"$exists": False}},
            {"$set": {"commission_type": "on_customer"}}
        )
        await db.shops.update_many(
            {"subscription_required": {"$exists": False}},
            {"$set": {"subscription_required": True}}
        )
        logger.info("Seller model migration completed")
    except Exception as e:
        logger.error(f"Seller model migration failed: {e}")


async def check_and_run_auto_renewals():
    """Check and auto-renew subscriptions for eligible shops"""
    try:
        settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
        if not settings:
            return
        
        now = datetime.now(timezone.utc)
        tiers = settings.get("tiers", {})
        
        # Find shops with auto_renew_enabled and expired/expiring subscriptions
        shops = await db.shops.find({
            "auto_renew_enabled": True,
            "status": "approved",
            "subscription_status": {"$in": ["active", "trial", "expired"]}
        }, {"_id": 0}).to_list(1000)
        
        renewed = 0
        skipped_funds = 0
        skipped_not_expired = 0
        
        for shop in shops:
            sub_end = shop.get("subscription_end")
            if not sub_end:
                continue
            
            try:
                end_date = parse_datetime_aware(sub_end)
            except:
                continue
            
            # Only renew if expired or expires today
            if not end_date or end_date > now:
                skipped_not_expired += 1
                continue
            
            # Check if already renewed today
            last_renewal = shop.get("auto_renew_last_run")
            today_str = now.strftime("%Y-%m-%d")
            if last_renewal and last_renewal == today_str:
                continue
            
            tier = shop.get("tier", "starter")
            tier_config = tiers.get(tier, {})
            period = shop.get("auto_renew_period", "monthly")
            
            if period == "yearly":
                price = tier_config.get("yearly_price", 0)
                duration_days = 365
            else:
                price = tier_config.get("monthly_price", 19)
                duration_days = 30
            
            # Apply sale discount if active
            sale_active = tier_config.get("sale_active", False)
            sale_percentage = tier_config.get("sale_percentage", 0)
            if not sale_active:
                sale_active = settings.get("subscription_sale_active", False)
                sale_percentage = settings.get("subscription_sale_percentage", 0)
            if sale_active and sale_percentage > 0:
                price = round(price * (1 - sale_percentage / 100), 2)
            
            wallet_balance = shop.get("wallet_balance", 0) or 0
            if wallet_balance < price:
                skipped_funds += 1
                continue
            
            # Perform renewal
            new_end = now + timedelta(days=duration_days)
            new_balance = round(wallet_balance - price, 2)
            
            await db.shops.update_one(
                {"id": shop["id"]},
                {"$set": {
                    "wallet_balance": new_balance,
                    "subscription_status": "active",
                    "subscription_end": new_end.isoformat(),
                    "auto_renew_last_run": today_str,
                }}
            )
            
            renew_txn_id = str(uuid.uuid4())
            await db.wallet_transactions.insert_one({
                "id": renew_txn_id,
                "shop_id": shop["id"],
                "shop_name": shop.get("name", ""),
                "type": "subscription_auto_renewal",
                "amount": -price,
                "balance_after": new_balance,
                "status": "completed",
                "note": f"Auto-renewal ({period}) - {tier.title()} tier",
                "created_at": now.isoformat()
            })
            
            await db.admin_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "type": "subscriptions",
                "subtype": f"auto_renewal_{period}",
                "amount": price,
                "direction": "credit",
                "shop_id": shop["id"],
                "shop_name": shop.get("name", ""),
                "ref_id": renew_txn_id,
                "note": f"Auto-renewal ({period}) by {shop.get('name', '')} - {tier.title()} tier",
                "created_at": now.isoformat()
            })
            
            renewed += 1
        
        if renewed > 0 or skipped_funds > 0:
            logger.info(f"Auto-renewal: {renewed} renewed, {skipped_funds} skipped (insufficient funds), {skipped_not_expired} not yet expired")
    except Exception as e:
        logger.error(f"Auto-renewal check error: {e}")


async def periodic_auto_renewal_check():
    """Run auto-renewal check every 12 hours"""
    while True:
        await asyncio.sleep(43200)  # 12 hours
        await check_and_run_auto_renewals()


@router.put("/users/profile")
async def update_profile(profile_data: UserUpdate, user: Dict = Depends(require_auth)):
    update_fields = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.users.find_one_and_update(
        {"id": user["user_id"]},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0, "password": 0}
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    return result


@router.post("/contact")
async def create_contact_message(message_data: ContactMessageCreate):
    message = {
        "id": str(uuid.uuid4()),
        "name": message_data.name,
        "email": message_data.email,
        "phone_number": message_data.phone_number,
        "message": message_data.message,
        "message_type": message_data.message_type or "general",
        "photo": message_data.photo,
        "status": "unread",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.contact_messages.insert_one(message)
    return {"message": "Message sent successfully"}


@router.get("/settings")
async def get_site_settings():
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    if not settings:
        default_settings = {
            "id": "site_settings",
            "contact_email": "contact@openmarketlb.com",
            "contact_phone": "12-345-6789",
            "hero_image_1": "https://images.pexels.com/photos/7772182/pexels-photo-7772182.jpeg",
            "hero_image_2": "https://images.pexels.com/photos/3769747/pexels-photo-3769747.jpeg",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.site_settings.insert_one(default_settings)
        return default_settings
    return settings


@router.get("/platform-settings")
async def get_platform_settings():
    """Get platform settings (subscription price, trial days, commission)"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if not settings:
        # Create default settings
        default_settings = {
            "id": "platform",
            "subscription_price": 29.0,
            "trial_days": 7,
            "commission_enabled": True,
            "commission_percentage": 10.0,
            "card_subscription_enabled": False,
            "card_payment_enabled": True,
            "yearly_discount_percent": 8,
            "otp_verification_enabled": False,
            "promotion_enabled": True,
            "promotion_daily_price": 2.0,
            "promotion_max_slots_per_page": 4,
            "primary_color": "#3bf4fb",
            "secondary_color": "#caff8a",
            "tiers": {
                "pro": {
                    "name": "Pro",
                    "monthly_price": 39,
                    "yearly_price": round(39 * 12 * 0.85, 2),
                    "product_limit": 0,
                    "commission_rate": 6,
                    "analytics_level": "full",
                    "monthly_wallet_credit": 6,
                    "search_priority": "higher",
                    "badge": "Pro Seller",
                    "report_download": True,
                    "trial_days": 7
                }
            }
        }
        await db.platform_settings.insert_one(default_settings)
        return default_settings
    # Ensure yearly_discount_percent is always present
    if "yearly_discount_percent" not in settings:
        settings["yearly_discount_percent"] = 8
    # Ensure brand colors always present (theme the web + mobile apps)
    settings.setdefault("primary_color", "#3bf4fb")
    settings.setdefault("secondary_color", "#caff8a")
    # Ensure tiers and promotion settings
    if "tiers" not in settings:
        settings["tiers"] = {
            "pro": {"name": "Pro", "monthly_price": 39, "yearly_price": round(39*12*0.85,2), "product_limit": 0, "commission_rate": 6, "analytics_level": "full", "monthly_wallet_credit": 6, "search_priority": "higher", "badge": "Pro Seller", "report_download": True, "trial_days": 7}
        }
    if "promotion_enabled" not in settings:
        settings["promotion_enabled"] = True
    if "promotion_daily_price" not in settings:
        settings["promotion_daily_price"] = 3.0
    if "promotion_max_slots_per_page" not in settings:
        settings["promotion_max_slots_per_page"] = 4
    if "sponsored_strategy" not in settings:
        settings["sponsored_strategy"] = "interleave"
    if "sponsored_density" not in settings:
        settings["sponsored_density"] = 3
    if "dark_mode_enabled" not in settings:
        settings["dark_mode_enabled"] = True
    if "language_toggle_enabled" not in settings:
        settings["language_toggle_enabled"] = True
    if "event_popup_color" not in settings:
        settings["event_popup_color"] = ""
    # 4 product variant toggles — default all enabled
    variant_toggle_defaults = {
        "variant_color_enabled": True,
        "variant_size_enabled": True,
        "variant_shape_enabled": True,
        "variant_type_enabled": True,
    }
    for _k, _v in variant_toggle_defaults.items():
        if _k not in settings:
            settings[_k] = _v
    # Sponsored placement controls (master + per-surface). Default ALL ON.
    sponsored_placement_defaults = {
        "sponsored_master_enabled": True,
        "sponsored_placement_products": True,
        "sponsored_placement_product_detail": True,
        "sponsored_placement_cart_checkout": True,
        "sponsored_placement_category_band": True,
        "sponsored_placement_shop_public": True,
    }
    for _k, _v in sponsored_placement_defaults.items():
        if _k not in settings:
            settings[_k] = _v
    return settings


@router.get("/type-images")
async def get_type_images():
    """Get type images (men/women/kids) - public endpoint"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    return settings.get("type_images", {}) if settings else {}


@router.get("/about-page")
async def get_about_page():
    """Get about page content - public endpoint"""
    page = await db.about_page.find_one({"id": "about"}, {"_id": 0})
    if not page:
        return {"id": "about", "sections": []}
    return page


@router.get("/home-banners")
async def get_home_banners():
    """Public endpoint: Return active admin events with display_mode == 'home_banner', 
    sorted by banner_order then created_at. Used by the homepage swipable carousel."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    cursor = db.admin_events.find({
        "is_active": True,
        "display_mode": "home_banner"
    }, {"_id": 0})
    events = await cursor.to_list(50)
    
    # Filter out events not yet started or already expired
    visible = []
    for e in events:
        sd = (e.get("start_date") or "").strip()
        ed = (e.get("end_date") or "").strip()
        if sd and sd > now_iso:
            continue
        if ed and ed < now_iso:
            continue
        
        # Auto-clear expired current_sponsor (so a stale banner isn't redirected forever)
        current = e.get("current_sponsor") or None
        if current:
            try:
                end_at = datetime.fromisoformat(current.get("end_at", ""))
                if end_at <= now:
                    await db.admin_events.update_one({"id": e["id"]}, {"$set": {"current_sponsor": None}})
                    e["current_sponsor"] = None
            except Exception:
                pass
        visible.append(e)
    
    # Sort by banner_order asc, then created_at desc
    visible.sort(key=lambda x: (x.get("banner_order", 0), -1 * (1 if x.get("created_at") else 0)))
    return visible


@router.get("/stats/public")
async def get_public_stats():
    """Get real platform statistics for the about page"""
    shops_count = await db.shops.count_documents({"subscription_status": {"$in": ["active", "trial"]}})
    products_count = await db.products.count_documents({"is_active": True})
    orders_count = await db.orders.count_documents({})
    users_count = await db.users.count_documents({"role": "user"})
    return {
        "sellers": shops_count,
        "products": products_count,
        "orders": orders_count,
        "customers": users_count
    }


@router.get("/states")
async def get_states(active_only: bool = False):
    """Get all states (public endpoint)"""
    query = {"is_active": True} if active_only else {}
    states = await db.states.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return states


@router.get("/shops")
async def get_public_shops():
    """Get all approved shops (public), verified first, then pro shops"""
    shops = await db.shops.find(
        {"status": "approved"},
        {"_id": 0, "user_id": 0, "stripe_customer_id": 0, "stripe_subscription_id": 0}
    ).to_list(1000)
    # Add product counts and active sale info
    now = datetime.now(timezone.utc).isoformat()
    for shop in shops:
        shop["products_count"] = await db.products.count_documents({"shop_id": shop["id"], "is_active": True})
        active_sale = await db.shop_sales.find_one(
            {"shop_id": shop["id"], "is_active": True, "end_date": {"$gt": now}},
            {"_id": 0, "discount_percent": 1, "title": 1}
        )
        shop["has_active_sale"] = bool(active_sale)
        if active_sale:
            shop["active_sale_percent"] = active_sale.get("discount_percent")
            shop["active_sale_title"] = active_sale.get("title")
    # Sort: verified first, then pro tier, then by created_at
    shops.sort(key=lambda s: (
        0 if s.get("is_verified") else 1,
        0 if s.get("tier") == "pro" else 1,
        s.get("created_at", "")
    ))
    return shops


@router.get("/shops/list")
async def get_shops_list(user: Dict = Depends(require_auth)):
    """Get list of all shops (for messaging) - admin sees all, others see approved only"""
    if user.get("role") == "admin":
        shops = await db.shops.find({"name": {"$exists": True}}, {"_id": 0, "id": 1, "name": 1, "logo": 1, "status": 1}).to_list(None)
    else:
        shops = await db.shops.find({"status": "approved"}, {"_id": 0, "id": 1, "name": 1, "logo": 1}).to_list(None)
    return {"shops": shops or []}


@router.get("/shops/by-state/{state}")
async def get_shops_by_state(state: str):
    """Get all approved shops in a specific state"""
    shops = await db.shops.find(
        {"status": "approved", "state": {"$regex": f"^{state}$", "$options": "i"}},
        {"_id": 0, "user_id": 0, "stripe_customer_id": 0, "stripe_subscription_id": 0}
    ).to_list(1000)
    for shop in shops:
        shop["products_count"] = await db.products.count_documents({"shop_id": shop["id"], "is_active": True})
    shops.sort(key=lambda s: (
        0 if s.get("is_verified") else 1,
        0 if s.get("tier") == "pro" else 1,
        s.get("created_at", "")
    ))
    return shops


@router.get("/shops/map")
async def get_shops_map():
    """Public: Get all shops with locations for the map"""
    shops = await db.shops.find(
        {"latitude": {"$exists": True, "$ne": None}, "longitude": {"$exists": True, "$ne": None}, "status": "approved", "subscription_status": {"$in": ["active", "trial"]}},
        {"_id": 0, "id": 1, "name": 1, "logo": 1, "description": 1, "latitude": 1, "longitude": 1, "location_address": 1, "state": 1}
    ).to_list(500)
    return shops


@router.get("/shops/{shop_id}")
async def get_public_shop(shop_id: str):
    """Get shop public profile"""
    shop = await db.shops.find_one(
        {"id": shop_id, "status": "approved"},
        {"_id": 0, "user_id": 0, "stripe_customer_id": 0, "stripe_subscription_id": 0}
    )
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: Optional[Dict] = Depends(get_current_user)):
    """Upload a file - saves with optional compression for speed"""
    from PIL import Image
    import io
    
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'}
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}")
    
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 20MB limit")
    
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOADS_DIR / unique_filename
    
    try:
        # Optimize images (compress and resize if needed)
        if file_ext in {'.jpg', '.jpeg', '.png', '.webp'}:
            try:
                img = Image.open(io.BytesIO(contents))
                # Resize if larger than 1200px on longest side
                max_dim = 1200
                if max(img.size) > max_dim:
                    ratio = max_dim / max(img.size)
                    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                    img = img.resize(new_size, Image.LANCZOS)
                # Convert RGBA to RGB for JPEG
                if file_ext in {'.jpg', '.jpeg'} and img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                # Save with compression
                if file_ext in {'.jpg', '.jpeg'}:
                    img.save(str(file_path), 'JPEG', quality=80, optimize=True)
                elif file_ext == '.png':
                    img.save(str(file_path), 'PNG', optimize=True)
                elif file_ext == '.webp':
                    img.save(str(file_path), 'WEBP', quality=80)
                else:
                    with open(file_path, "wb") as buffer:
                        buffer.write(contents)
            except Exception:
                # Fallback: save original file if optimization fails
                with open(file_path, "wb") as buffer:
                    buffer.write(contents)
        else:
            with open(file_path, "wb") as buffer:
                buffer.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    return {"url": f"/api/uploads/{unique_filename}", "filename": unique_filename}


@router.post("/upload/multiple")
async def upload_multiple_files(files: List[UploadFile] = File(...), user: Optional[Dict] = Depends(get_current_user)):
    """Upload multiple files and return their URLs"""
    from PIL import Image
    import io
    
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'}
    urls = []
    
    for file in files:
        file_ext = Path(file.filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            continue
        
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            continue
        
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOADS_DIR / unique_filename
        
        try:
            # Optimize images
            if file_ext in {'.jpg', '.jpeg', '.png', '.webp'}:
                try:
                    img = Image.open(io.BytesIO(contents))
                    max_dim = 1200
                    if max(img.size) > max_dim:
                        ratio = max_dim / max(img.size)
                        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                        img = img.resize(new_size, Image.LANCZOS)
                    if file_ext in {'.jpg', '.jpeg'} and img.mode in ('RGBA', 'P'):
                        img = img.convert('RGB')
                    if file_ext in {'.jpg', '.jpeg'}:
                        img.save(str(file_path), 'JPEG', quality=80, optimize=True)
                    elif file_ext == '.png':
                        img.save(str(file_path), 'PNG', optimize=True)
                    elif file_ext == '.webp':
                        img.save(str(file_path), 'WEBP', quality=80)
                    else:
                        with open(file_path, "wb") as buffer:
                            buffer.write(contents)
                except Exception:
                    with open(file_path, "wb") as buffer:
                        buffer.write(contents)
            else:
                with open(file_path, "wb") as buffer:
                    buffer.write(contents)
            urls.append(f"/api/uploads/{unique_filename}")
        except Exception:
            continue
    
    return {"urls": urls}


@router.post("/upload/attachment")
async def upload_attachment(file: UploadFile = File(...), user: Dict = Depends(require_auth)):
    """Upload a message attachment - supports images AND documents (pdf/doc/xls/etc)."""
    from PIL import Image
    import io

    image_exts = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    doc_exts = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip'}
    allowed = image_exts | doc_exts
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(sorted(allowed))}")

    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 25MB limit")

    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOADS_DIR / unique_filename
    attach_type = "image" if file_ext in image_exts else "document"

    try:
        if attach_type == "image" and file_ext in {'.jpg', '.jpeg', '.png', '.webp'}:
            try:
                img = Image.open(io.BytesIO(contents))
                max_dim = 1400
                if max(img.size) > max_dim:
                    ratio = max_dim / max(img.size)
                    img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)), Image.LANCZOS)
                if file_ext in {'.jpg', '.jpeg'} and img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                if file_ext in {'.jpg', '.jpeg'}:
                    img.save(str(file_path), 'JPEG', quality=82, optimize=True)
                elif file_ext == '.png':
                    img.save(str(file_path), 'PNG', optimize=True)
                else:
                    img.save(str(file_path), 'WEBP', quality=82)
            except Exception:
                with open(file_path, "wb") as buffer:
                    buffer.write(contents)
        else:
            with open(file_path, "wb") as buffer:
                buffer.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return {
        "url": f"/api/uploads/{unique_filename}",
        "filename": file.filename,
        "type": attach_type,
        "size": len(contents),
    }


@router.post("/heartbeat")
async def heartbeat(user: Dict = Depends(require_auth)):
    """Update the current user's last_seen timestamp (used for online/last-seen tracking)."""
    user_id = user.get("id") or user.get("user_id")
    if not user_id:
        return {"ok": False}
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"last_seen": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}


@router.get("/users/list")
async def get_users_list_for_messaging(user: Dict = Depends(require_auth)):
    """Admin: list all customers (role='user') for messaging compose."""
    if user.get("role") not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find(
        {"role": "user"},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "state": 1, "last_seen": 1}
    ).sort("name", 1).to_list(None)
    return {"users": users or []}



@router.post("/messages/send")
async def send_message(msg: MessageCreate, user: Dict = Depends(require_auth)):
    """Send a message to one or more recipients (supports photo/document/product attachments)."""
    messages_created = []
    sender_type = user.get("role", "customer")
    sender_id = user.get("id") or user.get("user_id")

    if not sender_id:
        raise HTTPException(status_code=400, detail="Invalid user session")

    # Get sender name. The JWT only carries id/email/role (no name), so resolve the
    # real display name from the database to avoid showing "Unknown" to recipients.
    sender_name = user.get("name")
    if sender_type == "shop":
        shop = await db.shops.find_one({"user_id": sender_id}, {"_id": 0})
        if shop:
            sender_name = shop.get("name") or sender_name
            sender_id = shop.get("id")  # Use shop ID as sender_id for shops
    else:
        if not sender_name or sender_name == "Unknown":
            db_user = await db.users.find_one({"id": sender_id}, {"_id": 0, "name": 1, "email": 1})
            if db_user:
                sender_name = db_user.get("name") or db_user.get("email") or sender_name
    if not sender_name:
        sender_name = user.get("email") or "Customer"

    # Block enforcement: admins can never be blocked; block customers & shops.
    if sender_type in ("customer", "user", "shop"):
        if await is_messaging_blocked(sender_type, sender_id):
            raise HTTPException(status_code=403, detail="You have been blocked from messaging. Please contact support.")

    # Validate there is something to send
    if not (msg.message or "").strip() and not msg.image_url and not msg.attachment_url and not msg.product_id:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Determine recipients
    recipient_list = []

    # Handle "admin" as recipient_id (get first admin user)
    if msg.recipient_id == "admin" or msg.recipient_type == "admin":
        admin_user = await db.users.find_one({"role": "admin"}, {"_id": 0})
        if admin_user:
            recipient_list.append((admin_user["id"], "admin", admin_user.get("name", "Admin")))
        else:
            raise HTTPException(status_code=404, detail="No admin user found")
    elif msg.send_to_all_shops and sender_type == "admin":
        # Admin sending to all shops
        shops = await db.shops.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(None)
        recipient_list = [(shop["id"], "shop", shop.get("name", "Shop")) for shop in shops]
    elif msg.send_to_all_users and sender_type == "admin":
        # Admin sending to all customers (use 'user' type to match customer self-type)
        users = await db.users.find({"role": "user"}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(None)
        recipient_list = [(u["id"], "user", u.get("name") or u.get("email", "Customer")) for u in users]
    elif msg.recipient_ids and len(msg.recipient_ids) > 0:
        # Multiple specific recipients
        for recipient_id in msg.recipient_ids:
            recipient_name = await get_recipient_name(recipient_id, msg.recipient_type)
            recipient_list.append((recipient_id, msg.recipient_type, recipient_name))
    elif msg.recipient_id:
        # Single recipient
        recipient_name = await get_recipient_name(msg.recipient_id, msg.recipient_type)
        recipient_list.append((msg.recipient_id, msg.recipient_type, recipient_name))
    else:
        raise HTTPException(status_code=400, detail="No recipients specified")

    # Resolve attachment metadata
    attachment_type = msg.attachment_type
    attachment_url = msg.attachment_url
    attachment_name = msg.attachment_name
    product_snapshot = None
    if msg.product_id:
        product_snapshot = await build_product_snapshot(msg.product_id)
        if product_snapshot:
            attachment_type = "product"
            # Customers may only attach products from the shop they are messaging
            if sender_type in ("customer", "user"):
                allowed_shop_ids = [r[0] for r in recipient_list if r[1] == "shop"]
                if allowed_shop_ids and product_snapshot.get("shop_id") not in allowed_shop_ids:
                    raise HTTPException(status_code=400, detail="You can only share products from the shop you are messaging.")
    elif msg.image_url and not attachment_type:
        attachment_type = "image"
        attachment_url = attachment_url or msg.image_url

    # Create messages for each recipient
    for recipient_id, recipient_type, recipient_name in recipient_list:
        # Skip blocked recipients (customers / shops)
        if recipient_type in ("customer", "user", "shop") and await is_messaging_blocked(recipient_type, recipient_id):
            continue
        # Generate conversation ID (consistent between sender and recipient)
        conversation_id = generate_conversation_id(sender_id, sender_type, recipient_id, recipient_type)

        message_doc = {
            "id": str(uuid.uuid4()),
            "sender_id": sender_id,
            "sender_type": sender_type,
            "sender_name": sender_name,
            "recipient_id": recipient_id,
            "recipient_type": recipient_type,
            "recipient_name": recipient_name,
            "subject": msg.subject,
            "message": msg.message or "",
            "image_url": msg.image_url,
            "attachment_type": attachment_type,
            "attachment_url": attachment_url,
            "attachment_name": attachment_name,
            "product_id": msg.product_id,
            "product_snapshot": product_snapshot,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
            "conversation_id": conversation_id
        }

        await db.messages.insert_one(message_doc)

        # Surface message in notifications for admin & shop recipients
        try:
            preview = (msg.message or "").strip()
            if not preview:
                preview = {"image": "📷 Photo", "document": "📎 Document", "product": "🛍️ Product"}.get(attachment_type, "New message")
            preview = preview[:80]
            if recipient_type == "admin":
                await create_notification(
                    recipient_type="admin",
                    title=f"New message from {sender_name}",
                    message=preview,
                    notification_type="message",
                    link="/admin/messages",
                )
            elif recipient_type == "shop":
                await create_notification(
                    recipient_type="shop",
                    title=f"New message from {sender_name}",
                    message=preview,
                    notification_type="message",
                    link="/shop/messages",
                    recipient_id=recipient_id,
                )
            elif recipient_type == "agent":
                await create_notification(
                    recipient_type="agent",
                    title=f"New message from {sender_name}",
                    message=preview,
                    notification_type="message",
                    link="/agent/messages",
                    recipient_id=recipient_id,
                )
        except Exception as _e:
            logger.error(f"Failed to create message notification: {_e}")

        # Convert datetime to string for JSON response
        message_doc["created_at"] = message_doc["created_at"].isoformat()
        message_doc.pop("_id", None)
        messages_created.append(message_doc)

    return {"success": True, "messages_sent": len(messages_created)}


@router.get("/messages/conversations")
async def get_conversations(user: Dict = Depends(require_auth)):
    """Get all conversations for the current user"""
    user_id = user.get("id") or user.get("user_id")
    user_type = user.get("role", "customer")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user session")
    
    # For shop users, get shop_id
    if user_type == "shop":
        shop = await db.shops.find_one({"user_id": user_id}, {"_id": 0})
        if shop:
            user_id = shop["id"]
    
    # Get all messages where user is sender or recipient
    messages = await db.messages.find({
        "$or": [
            {"sender_id": user_id},
            {"recipient_id": user_id}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(None)
    
    # Group by conversation_id. Messages are sorted newest-first. A conversation is only
    # listed if it has at least one NON-deleted message — this hides phantom conversations
    # whose messages were all deleted (e.g. an "Admin" chat you cleared out).
    conversations = {}
    for msg in messages:
        conv_id = msg["conversation_id"]
        if conv_id not in conversations:
            # Determine the "other party" in the conversation
            if msg["sender_id"] == user_id:
                other_party = {
                    "id": msg["recipient_id"],
                    "name": msg.get("recipient_name", "Unknown"),
                    "type": msg["recipient_type"]
                }
            else:
                other_party = {
                    "id": msg["sender_id"],
                    "name": msg.get("sender_name", "Unknown"),
                    "type": msg["sender_type"]
                }

            conversations[conv_id] = {
                "conversation_id": conv_id,
                "other_party": other_party,
                "last_message": None,
                "last_message_time": msg["created_at"],
                "subject": msg.get("subject"),
                "unread_count": 0,
                "messages": [],
                "_has_visible": False,
            }

        conv = conversations[conv_id]
        if not msg.get("is_deleted"):
            conv["_has_visible"] = True
            # First non-deleted message encountered = latest (list is newest-first)
            if conv["last_message"] is None:
                conv["last_message"] = msg["message"]
                conv["last_message_time"] = msg["created_at"]
            # Count unread messages (recipient == user, not read)
            if msg["recipient_id"] == user_id and not msg.get("is_read", False):
                conv["unread_count"] += 1

    result = []
    for conv in conversations.values():
        if conv.pop("_has_visible", False):
            if conv["last_message"] is None:
                conv["last_message"] = ""
            result.append(conv)

    return {"conversations": result}


@router.get("/messages/conversation/{conversation_id}")
async def get_conversation_messages(conversation_id: str, user: Dict = Depends(require_auth)):
    """Get all messages in a specific conversation"""
    user_id = user.get("id") or user.get("user_id")
    user_type = user.get("role", "customer")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user session")
    
    # For shop users, get shop_id
    if user_type == "shop":
        shop = await db.shops.find_one({"user_id": user_id}, {"_id": 0})
        if shop:
            user_id = shop["id"]
    
    # Get all messages in this conversation
    messages = await db.messages.find({
        "conversation_id": conversation_id,
        "$or": [
            {"sender_id": user_id},
            {"recipient_id": user_id}
        ]
    }, {"_id": 0, "deleted_original": 0, "deleted_attachment_url": 0}).sort("created_at", 1).to_list(None)

    # Mark messages as read (where user is recipient)
    await db.messages.update_many(
        {
            "conversation_id": conversation_id,
            "recipient_id": user_id,
            "is_read": False
        },
        {"$set": {"is_read": True}}
    )
    
    return {"messages": messages}


@router.get("/messages/unread-count")
async def get_unread_count(user: Dict = Depends(require_auth)):
    """Get total unread message count for current user"""
    user_id = user.get("id") or user.get("user_id")
    user_type = user.get("role", "customer")
    
    if not user_id:
        return {"unread_count": 0}
    
    # For shop users, get shop_id
    if user_type == "shop":
        shop = await db.shops.find_one({"user_id": user_id}, {"_id": 0})
        if shop:
            user_id = shop["id"]
    
    # Exclude deleted messages so the badge matches the conversation list, which hides
    # conversations whose messages were all deleted. Otherwise a deleted-but-unread
    # message leaves a phantom count with no conversation to open (can never be cleared).
    count = await db.messages.count_documents({
        "recipient_id": user_id,
        "is_read": False,
        "is_deleted": {"$ne": True}
    })

    return {"unread_count": count}


@router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, user: Dict = Depends(require_auth)):
    """Mark a specific message as read"""
    user_id = user.get("id") or user.get("user_id")
    user_type = user.get("role", "customer")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user session")
    
    # For shop users, get shop_id
    if user_type == "shop":
        shop = await db.shops.find_one({"user_id": user_id}, {"_id": 0})
        if shop:
            user_id = shop["id"]
    
    result = await db.messages.update_one(
        {"id": message_id, "recipient_id": user_id},
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")

    return {"success": True}


async def _effective_sender_id(user: Dict) -> str:
    """The id used as sender_id in messages for this user (shop users send as their shop id)."""
    uid = user.get("id") or user.get("user_id")
    if user.get("role") == "shop":
        shop = await db.shops.find_one({"user_id": uid}, {"_id": 0, "id": 1})
        if shop:
            return shop["id"]
    return uid


@router.put("/messages/{message_id}")
async def edit_message(message_id: str, request: Request, user: Dict = Depends(require_auth)):
    """Edit one of your own messages (marks it as edited)."""
    body = await request.json()
    new_text = (body.get("message") or "").strip()
    if not new_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("sender_id") != await _effective_sender_id(user):
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    if msg.get("is_deleted"):
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"message": new_text, "is_edited": True, "edited_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "message": "Message updated"}


def _soft_delete_fields(msg: Dict, deleted_by: str) -> Dict:
    """Fields to soft-delete a message. Preserves the original content in
    `deleted_original` (admin-only) so admins can reveal what was deleted."""
    return {
        "is_deleted": True,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "deleted_by": deleted_by,
        # keep the very first original if it was already deleted before
        "deleted_original": msg.get("deleted_original") if msg.get("is_deleted") else (msg.get("message") or ""),
        "deleted_attachment_url": msg.get("deleted_attachment_url") if msg.get("is_deleted") else (msg.get("attachment_url") or msg.get("image_url")),
        "message": "",
        "attachment_type": None, "attachment_url": None, "attachment_name": None,
        "image_url": None, "product_id": None, "product": None,
    }


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user: Dict = Depends(require_auth)):
    """Delete one of your own messages (soft-delete — shown as 'message deleted')."""
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("sender_id") != await _effective_sender_id(user):
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    await db.messages.update_one(
        {"id": message_id},
        {"$set": _soft_delete_fields(msg, msg.get("sender_type") or "user")},
    )
    return {"success": True, "message": "Message deleted"}


@router.delete("/admin/messages/{message_id}")
async def admin_delete_message(message_id: str, admin: Dict = Depends(require_admin)):
    """Admin oversight: delete ANY message (shown as 'Deleted by admin')."""
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    await db.messages.update_one(
        {"id": message_id},
        {"$set": _soft_delete_fields(msg, "admin")},
    )
    return {"success": True, "message": "Message deleted by admin"}


@router.post("/ai/smart-search")
async def ai_smart_search(body: Dict):
    """AI-powered natural language product search"""
    query = body.get("query", "")
    if not query:
        return {"products": [], "interpretation": ""}
    
    # Get all products and categories for context
    products = await db.products.find({"is_active": True}, {"_id": 0}).to_list(500)
    categories = await db.categories.find({"is_active": True}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    
    cat_names = [c["name"] for c in categories]
    product_summaries = []
    for p in products[:100]:
        summary = f"ID:{p['id']}|{p['name']}|${p.get('price',0)}|type:{p.get('type','none')}|cats:{','.join(p.get('category_ids',[]))}"
        if p.get('discount_price'):
            summary += f"|sale:${p['discount_price']}"
        if p.get('colors'):
            summary += f"|colors:{','.join([c.get('color_name','') for c in p['colors']])}"
        product_summaries.append(summary)
    
    system_msg = f"""You are a smart product search engine for OpenMarketlb marketplace.
Categories available: {', '.join(cat_names)}
Products (format - ID|name|price|type|categories|sale|colors):
{chr(10).join(product_summaries)}

Given a natural language search query, return a JSON object with:
- "product_ids": list of matching product IDs (most relevant first, max 20)
- "interpretation": short human-readable description of what you understood (e.g. "Showing affordable electronics under $200")
- "filters_applied": object with any filters you extracted (price_max, price_min, type, color, category, etc.)

Be smart about understanding intent: "cheap laptops" means low price electronics, "something for my daughter" means kids/women items, "red shoes under 50" means footwear with red color under $50.
Always respond with valid JSON only, no markdown."""

    try:
        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": query}
            ],
            temperature=0.3,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        
        import json as json_module
        result = json_module.loads(response.choices[0].message.content)
        matched_ids = result.get("product_ids", [])
        
        # Fetch full product details for matched IDs
        matched_products = []
        for pid in matched_ids:
            prod = next((p for p in products if p["id"] == pid), None)
            if prod:
                matched_products.append(prod)
        
        return {
            "products": matched_products,
            "interpretation": result.get("interpretation", ""),
            "filters_applied": result.get("filters_applied", {}),
            "total": len(matched_products)
        }
    except Exception as e:
        # Fallback to basic text search
        query_lower = query.lower()
        basic_results = [p for p in products if query_lower in p.get("name", "").lower() or query_lower in p.get("description", "").lower()]
        return {
            "products": basic_results[:20],
            "interpretation": f"Showing results for '{query}'",
            "filters_applied": {},
            "total": len(basic_results[:20]),
            "fallback": True
        }


@router.post("/ai/chat")
async def ai_chat(body: Dict, user: Optional[Dict] = Depends(get_current_user)):
    """AI Shopping Assistant chatbot"""
    message = body.get("message", "")
    session_id = body.get("session_id", str(uuid.uuid4()))
    
    if not message:
        return {"reply": "How can I help you today?", "session_id": session_id}
    
    # Load chat history from DB
    chat_history = await db.chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
    messages_history = chat_history.get("messages", []) if chat_history else []
    
    # Build context about the store
    products_count = await db.products.count_documents({"is_active": True})
    shops_count = await db.shops.count_documents({"status": "approved"})
    categories = await db.categories.find({"is_active": True, "level": 1}, {"_id": 0, "name": 1}).to_list(50)
    cat_names = [c["name"] for c in categories]
    
    # If user is logged in, get their orders
    user_context = ""
    if user:
        orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0, "id": 1, "status": 1, "total_amount": 1, "created_at": 1}).sort("created_at", -1).to_list(5)
        if orders:
            order_summaries = [f"Order {o['id'][:8]}... - ${o.get('total_amount',0):.2f} - Status: {o.get('status','unknown')}" for o in orders]
            user_context = f"\nUser's recent orders:\n" + "\n".join(order_summaries)
    
    # Get some featured products for recommendations
    featured = await db.products.find({"is_active": True}, {"_id": 0, "id": 1, "name": 1, "price": 1, "discount_price": 1}).to_list(30)
    product_list = ", ".join([f"{p['name']} (${p.get('discount_price') or p['price']})" for p in featured[:15]])
    
    system_msg = f"""You are OpenMarketlb Assistant, a friendly and helpful AI shopping assistant for the OpenMarketlb marketplace.

Store info:
- {products_count} products across {len(cat_names)} categories: {', '.join(cat_names)}
- {shops_count} verified shops
- Some products: {product_list}
{user_context}

Your capabilities:
1. Help customers find products and recommend items
2. Answer questions about orders, shipping, returns
3. Explain how the marketplace works
4. Help with account-related questions
5. Suggest deals and discounts

Guidelines:
- Be concise, warm, and helpful (2-3 sentences max per response)
- When recommending products, mention specific names and prices
- If asked about order status, use the user's order data if available
- For questions you can't answer, suggest contacting support
- Use a friendly tone with occasional emojis"""

    # Build messages for API
    api_messages = [{"role": "system", "content": system_msg}]
    for msg in messages_history[-10:]:  # Last 10 messages for context
        api_messages.append({"role": msg["role"], "content": msg["content"]})
    api_messages.append({"role": "user", "content": message})
    
    try:
        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL or "gpt-4o-mini",
            messages=api_messages,
            temperature=0.7,
            max_tokens=300
        )
        
        reply = response.choices[0].message.content
        
        # Save to chat history
        new_messages = messages_history + [
            {"role": "user", "content": message, "timestamp": datetime.now(timezone.utc).isoformat()},
            {"role": "assistant", "content": reply, "timestamp": datetime.now(timezone.utc).isoformat()}
        ]
        
        await db.chat_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "session_id": session_id,
                "messages": new_messages[-30:],  # Keep last 30 messages
                "user_id": user["id"] if user else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        return {"reply": reply, "session_id": session_id}
    except Exception as e:
        return {
            "reply": "I'm having trouble connecting right now. Please try again in a moment, or contact our support team for help!",
            "session_id": session_id,
            "error": True
        }


@router.get("/notifications")
async def get_notifications(user: Dict = Depends(require_auth)):
    """Get notifications for current user (admin sees admin notifications, shop sees shop notifications)"""
    if user["role"] == "admin":
        notifications = await db.notifications.find(
            {"recipient_type": "admin"},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    elif user["role"] == "shop":
        shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "id": 1})
        if shop:
            notifications = await db.notifications.find(
                {"$or": [
                    {"recipient_type": "shop", "recipient_id": shop["id"]},
                    {"recipient_type": "shop", "recipient_id": None}  # Broadcast to all shops
                ]},
                {"_id": 0}
            ).sort("created_at", -1).to_list(100)
        else:
            notifications = []
    elif user["role"] == "agent":
        notifications = await db.notifications.find(
            {"$or": [
                {"recipient_type": "agent", "recipient_id": user.get("user_id") or user.get("id")},
                {"recipient_type": "agent", "recipient_id": None}
            ]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    else:
        notifications = []
    
    return notifications


@router.get("/notifications/unread-count")
async def get_unread_notifications_count(user: Dict = Depends(require_auth)):
    """Get unread notification count"""
    if user["role"] == "admin":
        count = await db.notifications.count_documents({"recipient_type": "admin", "is_read": False})
    elif user["role"] == "shop":
        shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "id": 1})
        if shop:
            count = await db.notifications.count_documents({
                "$or": [
                    {"recipient_type": "shop", "recipient_id": shop["id"], "is_read": False},
                    {"recipient_type": "shop", "recipient_id": None, "is_read": False}
                ]
            })
        else:
            count = 0
    elif user["role"] == "agent":
        count = await db.notifications.count_documents({
            "$or": [
                {"recipient_type": "agent", "recipient_id": user.get("user_id") or user.get("id"), "is_read": False},
                {"recipient_type": "agent", "recipient_id": None, "is_read": False}
            ]
        })
    else:
        count = 0
    
    return {"count": count}


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: Dict = Depends(require_auth)):
    """Mark a notification as read"""
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}


@router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(user: Dict = Depends(require_auth)):
    """Mark all notifications as read for current user"""
    if user["role"] == "admin":
        await db.notifications.update_many(
            {"recipient_type": "admin"},
            {"$set": {"is_read": True}}
        )
    elif user["role"] == "shop":
        shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "id": 1})
        if shop:
            await db.notifications.update_many(
                {"$or": [
                    {"recipient_type": "shop", "recipient_id": shop["id"]},
                    {"recipient_type": "shop", "recipient_id": None}
                ]},
                {"$set": {"is_read": True}}
            )
    return {"message": "All notifications marked as read"}


@router.get("/team-members")
async def get_team_members():
    """Public: Get team members for About page"""
    members = await db.team_members.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return members


@router.get("/testimonials")
async def get_testimonials():
    """Public: Get testimonials for About page"""
    testimonials = await db.testimonials.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return testimonials


@router.get("/loyalty/me")
async def get_loyalty_status(user: Dict = Depends(require_auth)):
    """Get current user's loyalty status"""
    settings = await get_loyalty_settings()
    if not settings.get("loyalty_enabled"):
        return {"enabled": False}
    
    user_data = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    balance = user_data.get("loyalty_points_balance", 0)
    lifetime = user_data.get("loyalty_points_lifetime", 0)
    tiers = settings.get("tiers", get_default_loyalty_settings()["tiers"])
    
    current_tier = calc_tier(lifetime, tiers)
    next_tier = calc_next_tier(lifetime, tiers)
    
    redeem_rate = settings.get("redeem_points_per_dollar", 100)
    redeem_value = calc_redemption_value(balance, redeem_rate)
    
    progress = 0
    if next_tier:
        tier_range = next_tier["min_points"] - current_tier["min_points"]
        if tier_range > 0:
            progress = min(100, int(((lifetime - current_tier["min_points"]) / tier_range) * 100))
    else:
        progress = 100
    
    return {
        "enabled": True,
        "points_balance": balance,
        "points_lifetime": lifetime,
        "tier": current_tier,
        "next_tier": next_tier,
        "progress_to_next_tier": progress,
        "redeem_value": redeem_value,
        "redeem_rate": redeem_rate,
        "points_per_dollar": settings.get("points_per_dollar", 1),
    }


@router.post("/loyalty/redeem/preview")
async def loyalty_redeem_preview(data: LoyaltyRedeemPreview, user: Dict = Depends(require_auth)):
    """Preview how much discount the user gets for redeeming points"""
    settings = await get_loyalty_settings()
    if not settings.get("loyalty_enabled"):
        raise HTTPException(status_code=400, detail="Loyalty program is not active")
    
    user_data = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    balance = user_data.get("loyalty_points_balance", 0)
    if data.points_to_redeem > balance:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    if data.points_to_redeem < 0:
        raise HTTPException(status_code=400, detail="Invalid points amount")
    
    redeem_rate = settings.get("redeem_points_per_dollar", 100)
    raw_discount = calc_redemption_value(data.points_to_redeem, redeem_rate)
    
    # Cap discount at cart_total (items only, excludes delivery) - user can get items free but must pay delivery
    capped_discount = min(raw_discount, data.cart_total)
    
    # Calculate commission for info
    commission_rate = await get_commission_rate()
    commission_amount = round(data.cart_total * commission_rate, 2)
    
    # Admin owes shop if capped discount > commission
    admin_owes = max(0, round(capped_discount - commission_amount, 2))
    
    return {
        "points_to_redeem": data.points_to_redeem,
        "raw_discount": raw_discount,
        "capped_discount": capped_discount,
        "commission_amount": commission_amount,
        "admin_owes_shop": admin_owes,
        "remaining_balance": balance - data.points_to_redeem
    }


@router.get("/loyalty/history")
async def get_loyalty_history(user: Dict = Depends(require_auth)):
    """Get user's loyalty points history"""
    entries = await db.loyalty_ledger.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return entries


@router.get("/loyalty/active-bonus")
async def get_active_bonus_events(request: Request):
    """Get currently active bonus events (public - for popup) + first purchase bonus info.
    Optionally checks claimed status if Authorization header is present."""
    settings = await get_loyalty_settings()
    if not settings.get("loyalty_enabled"):
        return {"events": [], "first_purchase_bonus": None, "loyalty_enabled": False}
    
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    active = []
    for event in settings.get("bonus_events", []):
        if event.get("is_active"):
            start = event.get("start_date", "")
            end = event.get("end_date", "")
            if (not start or start <= now) and (not end or end >= now):
                active.append(dict(event))
    
    # Check claimed status if user is authenticated
    claimed_event_ids = []
    user_id = None
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("user_id")
            if user_id and active:
                event_ids = [e["id"] for e in active if e.get("type") == "added_points"]
                if event_ids:
                    claimed_entries = await db.loyalty_ledger.find({
                        "user_id": user_id,
                        "type": "bonus_event",
                        "event_id": {"$in": event_ids}
                    }).to_list(100)
                    claimed_event_ids = [c["event_id"] for c in claimed_entries]
    except Exception:
        pass
    
    # Mark claimed status on events
    for event in active:
        if event.get("type") == "added_points":
            event["claimed"] = event["id"] in claimed_event_ids
    
    # Include first purchase bonus info if enabled
    first_purchase_bonus = None
    if settings.get("first_purchase_bonus_enabled"):
        display = settings.get("first_purchase_bonus_display", "none")
        if display and display != "none":
            first_purchase_bonus = {
                "enabled": True,
                "points": settings.get("first_purchase_bonus_points", 100),
                "display_mode": display,
            }
    
    return {
        "events": active, 
        "loyalty_enabled": True,
        "first_purchase_bonus": first_purchase_bonus,
        "claimed_event_ids": claimed_event_ids,
    }


@router.post("/loyalty/claim-bonus/{event_id}")
async def claim_bonus_points(event_id: str, user: Dict = Depends(require_auth)):
    """Claim added points from a bonus event (one-time per user per event)"""
    settings = await get_loyalty_settings()
    if not settings.get("loyalty_enabled"):
        raise HTTPException(status_code=400, detail="Loyalty program not active")
    
    # Find the event
    event = None
    for e in settings.get("bonus_events", []):
        if e.get("id") == event_id and e.get("type") == "added_points" and e.get("is_active"):
            event = e
            break
    
    if not event:
        raise HTTPException(status_code=404, detail="Bonus event not found or not active")
    
    # Check if already claimed
    existing = await db.loyalty_ledger.find_one({
        "user_id": user["user_id"],
        "type": "bonus_event",
        "event_id": event_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already claimed this bonus")
    
    points = event.get("added_points", 100)
    
    # Credit points
    await db.users.update_one(
        {"id": user["user_id"]},
        {"$inc": {"loyalty_points_balance": points, "loyalty_points_lifetime": points}}
    )
    
    # Update tier
    updated_u = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "loyalty_points_lifetime": 1})
    tiers = settings.get("tiers", get_default_loyalty_settings()["tiers"])
    new_tier = calc_tier(updated_u.get("loyalty_points_lifetime", 0) if updated_u else 0, tiers)
    await db.users.update_one({"id": user["user_id"]}, {"$set": {"loyalty_tier": new_tier["name"]}})
    
    # Ledger entry
    await db.loyalty_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "event_id": event_id,
        "type": "bonus_event",
        "points": points,
        "description": f"Bonus: {event.get('name', 'Bonus Event')} (+{points} pts)",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Claimed {points} bonus points!", "points": points}


@router.get("/events/active")
async def get_active_events():
    """Public: Get currently active events for display"""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    events = await db.admin_events.find({"is_active": True}, {"_id": 0}).to_list(50)
    active = []
    for e in events:
        start = e.get("start_date", "")
        end = e.get("end_date", "")
        if (not start or start <= now) and (not end or end >= now):
            active.append(e)
    return {"events": active}


@router.get("/user/wallet-info")
async def get_user_wallet_info(user: Dict = Depends(require_auth)):
    """Get wallet info for logged-in user (returns balance if shop, null if not shop)"""
    user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    if not user_doc or not user_doc.get("shop_id"):
        return {"has_wallet": False, "balance": 0, "is_shop": False}
    
    shop = await db.shops.find_one({"id": user_doc["shop_id"]}, {"_id": 0, "wallet_balance": 1, "name": 1})
    if not shop:
        return {"has_wallet": False, "balance": 0, "is_shop": False}
    
    return {"has_wallet": True, "balance": shop.get("wallet_balance", 0), "is_shop": True, "shop_name": shop.get("name", "")}


@router.get("/promotions/active")
async def get_active_promotions(category_id: Optional[str] = None, limit: Optional[int] = None):
    """Get active promoted products for display"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if not settings or not settings.get("promotion_enabled", False):
        return {"promotions": [], "products": []}
    
    now = datetime.now(timezone.utc).isoformat()
    query = {"status": "active", "start_date": {"$lte": now}, "end_date": {"$gt": now}}
    
    promotions = await db.promotions.find(query, {"_id": 0}).sort("start_date", 1).to_list(100)
    
    product_ids = [p["product_id"] for p in promotions]
    products = await db.products.find({"id": {"$in": product_ids}, "is_active": True}, {"_id": 0}).to_list(100)
    product_map = {p["id"]: p for p in products}
    
    result_products = []
    # Fetch free gift info for all promoted product IDs
    gifted_product_ids = set()
    gift_cursor = db.product_gifts.find({"product_id": {"$in": product_ids}, "is_active": True}, {"product_id": 1, "_id": 0})
    async for g in gift_cursor:
        gifted_product_ids.add(g["product_id"])
    
    commission_rate = await get_commission_rate()
    for promo in promotions:
        prod = product_map.get(promo["product_id"])
        if not prod:
            continue
        if category_id:
            if category_id not in (prod.get("category_ids") or []) and prod.get("category_id") != category_id:
                continue
        # Use per-shop commission rate and type
        shop_id = prod.get("shop_id")
        info = await get_shop_commission_info(shop_id) if shop_id else {"rate": commission_rate, "type": "on_customer"}
        prod = apply_commission_to_product(prod, info["rate"], info["type"])
        prod["is_promoted"] = True
        prod["promotion_id"] = promo["id"]
        prod["has_free_gift"] = prod["id"] in gifted_product_ids
        result_products.append(prod)
    
    # Order "suggested" sponsored products first: rank by engagement so the most
    # relevant/popular promoted items lead on every surface that consumes this list.
    def _suggested_score(p):
        sold = p.get("sold_count") or 0
        views = p.get("view_count") or 0
        rating = p.get("average_rating") or p.get("rating") or 0
        gift_boost = 25 if p.get("has_free_gift") else 0
        return (sold * 5) + views + (rating * 10) + gift_boost
    result_products.sort(key=_suggested_score, reverse=True)
    
    max_slots = limit or len(result_products)
    return {"promotions": promotions[:max_slots], "products": result_products[:max_slots]}


@router.post("/track/view")
async def track_product_view(request: Request, user: Optional[Dict] = Depends(get_current_user)):
    """Track product view for recommendation engine"""
    body = await request.json()
    product_id = body.get("product_id")
    session_id = body.get("session_id")
    
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id required")
    
    user_id = user["user_id"] if user else None
    
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_id": session_id,
        "product_id": product_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.browsing_history.insert_one(doc)
    
    # Increment product view_count
    await db.products.update_one(
        {"id": product_id},
        {"$inc": {"view_count": 1}}
    )
    
    # Increment promotion views if product is promoted
    await db.promotions.update_many(
        {"product_id": product_id, "status": "active"},
        {"$inc": {"views": 1}}
    )
    
    return {"status": "ok"}


@router.get("/recommendations/product/{product_id}")
async def get_product_recommendations(product_id: str):
    """Get 'Customers also bought' recommendations for a product"""
    # Get the product's details
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        return {"products": []}
    
    # Strategy 1: Co-purchase - find products bought together in the same order
    orders_with_product = await db.orders.find(
        {"items.product_id": product_id, "payment_status": "paid"},
        {"_id": 0, "items": 1}
    ).to_list(200)
    
    co_purchased = {}
    for order in orders_with_product:
        other_ids = [item["product_id"] for item in order.get("items", []) if item["product_id"] != product_id]
        for pid in other_ids:
            co_purchased[pid] = co_purchased.get(pid, 0) + 1
    
    # Strategy 2: Same category products
    cat_ids = product.get("category_ids") or []
    if product.get("category_id"):
        cat_ids = list(set(cat_ids + [product["category_id"]]))
    
    same_category = []
    if cat_ids:
        same_category = await db.products.find(
            {"category_ids": {"$elemMatch": {"$in": cat_ids}}, "id": {"$ne": product_id}, "is_active": True},
            {"_id": 0}
        ).to_list(20)
    
    # Strategy 3: Same shop products
    same_shop = []
    if product.get("shop_id"):
        same_shop = await db.products.find(
            {"shop_id": product["shop_id"], "id": {"$ne": product_id}, "is_active": True},
            {"_id": 0}
        ).to_list(10)
    
    # Merge and rank
    all_candidates = {}
    for pid, count in co_purchased.items():
        all_candidates[pid] = {"score": count * 3}  # Co-purchase weight
    
    for p in same_category:
        pid = p["id"]
        if pid not in all_candidates:
            all_candidates[pid] = {"score": 0, "product": p}
        all_candidates[pid]["score"] = all_candidates[pid].get("score", 0) + 1
        all_candidates[pid]["product"] = p
    
    for p in same_shop:
        pid = p["id"]
        if pid not in all_candidates:
            all_candidates[pid] = {"score": 0, "product": p}
        all_candidates[pid]["score"] = all_candidates[pid].get("score", 0) + 0.5
        all_candidates[pid]["product"] = p
    
    # Get full product data for co-purchased items
    co_purchased_ids = [pid for pid in co_purchased if pid not in {p["id"] for p in same_category + same_shop}]
    if co_purchased_ids:
        co_products = await db.products.find({"id": {"$in": co_purchased_ids}, "is_active": True}, {"_id": 0}).to_list(20)
        for p in co_products:
            if p["id"] in all_candidates:
                all_candidates[p["id"]]["product"] = p
    
    # Sort by score and return top 8
    ranked = sorted(all_candidates.items(), key=lambda x: x[1].get("score", 0), reverse=True)
    
    commission_rate = await get_commission_rate()
    result = []
    for pid, data in ranked[:8]:
        prod = data.get("product")
        if prod:
            shop_id = prod.get("shop_id")
            info = await get_shop_commission_info(shop_id) if shop_id else {"rate": commission_rate, "type": "on_customer"}
            prod = apply_commission_to_product(prod, info["rate"], info["type"])
            result.append(prod)
    
    return {"products": result}


@router.get("/recommendations/personalized")
async def get_personalized_recommendations(session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    """Get AI-powered personalized product recommendations based on browsing history, cart, wishlist, and purchases"""
    user_id = user["user_id"] if user else None
    
    # Get recent browsing history
    query = {}
    if user_id:
        query["user_id"] = user_id
    elif session_id:
        query["session_id"] = session_id
    else:
        # Return trending/popular products
        products = await db.products.find({"is_active": True}, {"_id": 0}).sort("view_count", -1).to_list(12)
        out = []
        for p in products:
            sid = p.get("shop_id")
            info = await get_shop_commission_info(sid) if sid else {"rate": await get_commission_rate(), "type": "on_customer"}
            out.append(apply_commission_to_product(p, info["rate"], info["type"]))
        return {"products": out, "type": "trending"}
    
    history = await db.browsing_history.find(query, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    # Also get user's wishlist items for stronger interest signal
    wishlist_product_ids = []
    if user_id:
        wishlist = await db.wishlists.find_one({"user_id": user_id}, {"_id": 0})
        if wishlist:
            wishlist_product_ids = wishlist.get("product_ids", [])
    
    # Get user's past orders for "bought" signal
    purchased_ids = []
    if user_id:
        orders = await db.orders.find({"user_id": user_id}, {"_id": 0, "items": 1}).to_list(50)
        for order in orders:
            for item in order.get("items", []):
                purchased_ids.append(item.get("product_id"))
    
    # Get cart items
    cart_product_ids = []
    if user_id:
        cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
        if cart:
            cart_product_ids = [item.get("product_id") for item in cart.get("items", [])]
    
    if not history and not wishlist_product_ids and not purchased_ids:
        # Return popular products sorted by view_count
        products = await db.products.find({"is_active": True}, {"_id": 0}).sort("view_count", -1).to_list(12)
        out = []
        for p in products:
            sid = p.get("shop_id")
            info = await get_shop_commission_info(sid) if sid else {"rate": await get_commission_rate(), "type": "on_customer"}
            out.append(apply_commission_to_product(p, info["rate"], info["type"]))
        return {"products": out, "type": "trending"}
    
    # Count views per product (frequency = stronger interest)
    view_counts = {}
    for h in history:
        pid = h["product_id"]
        view_counts[pid] = view_counts.get(pid, 0) + 1
    
    # Combine all interest signals into product IDs with weights
    interest_product_ids = list(dict.fromkeys(
        [h["product_id"] for h in history] + wishlist_product_ids + purchased_ids + cart_product_ids
    ))
    
    # Get product details to extract categories and price ranges
    interest_products = await db.products.find({"id": {"$in": interest_product_ids[:30]}}, {"_id": 0}).to_list(30)
    
    # Score categories based on user behavior
    category_scores = {}
    price_points = []
    shop_scores = {}
    type_scores = {}
    
    for p in interest_products:
        pid = p["id"]
        # Weight: wishlist=5, cart=4, purchased=3, views=frequency
        weight = view_counts.get(pid, 0)
        if pid in wishlist_product_ids:
            weight += 5
        if pid in cart_product_ids:
            weight += 4
        if pid in purchased_ids:
            weight += 3
        
        for cid in (p.get("category_ids") or []):
            category_scores[cid] = category_scores.get(cid, 0) + weight
        
        price = p.get("discount_price") or p.get("price", 0)
        if price > 0:
            price_points.append(price)
        
        sid = p.get("shop_id")
        if sid:
            shop_scores[sid] = shop_scores.get(sid, 0) + weight
        
        ptype = p.get("type")
        if ptype and ptype != 'none':
            type_scores[ptype] = type_scores.get(ptype, 0) + weight
    
    # Get top categories, shops, types
    top_categories = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)[:8]
    top_cat_ids = [c[0] for c in top_categories]
    top_shops = sorted(shop_scores.items(), key=lambda x: x[1], reverse=True)[:5]
    top_shop_ids = [s[0] for s in top_shops]
    
    # Determine price range preference
    avg_price = sum(price_points) / len(price_points) if price_points else 50
    price_min = avg_price * 0.3
    price_max = avg_price * 3.0
    
    # Exclude already viewed/purchased/carted
    exclude_ids = list(set(interest_product_ids))
    
    # Strategy 1: Same categories, different products
    cat_recs = []
    if top_cat_ids:
        cat_recs = await db.products.find(
            {"category_ids": {"$elemMatch": {"$in": top_cat_ids}}, "id": {"$nin": exclude_ids}, "is_active": True},
            {"_id": 0}
        ).sort("view_count", -1).to_list(20)
    
    # Strategy 2: Same shops user likes
    shop_recs = []
    if top_shop_ids:
        shop_recs = await db.products.find(
            {"shop_id": {"$in": top_shop_ids}, "id": {"$nin": exclude_ids + [p["id"] for p in cat_recs]}, "is_active": True},
            {"_id": 0}
        ).to_list(10)
    
    # Strategy 3: Popular in price range
    price_recs = await db.products.find(
        {"price": {"$gte": price_min, "$lte": price_max}, "id": {"$nin": exclude_ids + [p["id"] for p in cat_recs + shop_recs]}, "is_active": True},
        {"_id": 0}
    ).sort("view_count", -1).to_list(8)
    
    # Merge and score all candidates
    all_candidates = {}
    for p in cat_recs:
        score = 0
        for cid in (p.get("category_ids") or []):
            score += category_scores.get(cid, 0)
        score += (p.get("view_count", 0) or 0) * 0.01  # Popularity bonus
        all_candidates[p["id"]] = {"product": p, "score": score}
    
    for p in shop_recs:
        pid = p["id"]
        if pid not in all_candidates:
            all_candidates[pid] = {"product": p, "score": 0}
        all_candidates[pid]["score"] += shop_scores.get(p.get("shop_id"), 0) * 0.5
    
    for p in price_recs:
        pid = p["id"]
        if pid not in all_candidates:
            all_candidates[pid] = {"product": p, "score": 0}
        all_candidates[pid]["score"] += 1  # Price range match
    
    # Sort by score
    ranked = sorted(all_candidates.items(), key=lambda x: x[1]["score"], reverse=True)
    
    commission_rate = await get_commission_rate()
    result = []
    for pid, data in ranked[:12]:
        prod = data.get("product")
        if prod:
            shop_id = prod.get("shop_id")
            info = await get_shop_commission_info(shop_id) if shop_id else {"rate": commission_rate, "type": "on_customer"}
            prod = apply_commission_to_product(prod, info["rate"], info["type"])
            result.append(prod)
    
    return {
        "products": result,
        "type": "personalized",
        "based_on_categories": top_cat_ids,
        "signals": {
            "views": len(history),
            "wishlist": len(wishlist_product_ids),
            "purchases": len(purchased_ids),
            "cart": len(cart_product_ids)
        }
    }


@router.get("/tos")
async def get_tos():
    """Get Terms of Service content"""
    tos = await db.tos.find_one({"id": "tos"}, {"_id": 0})
    if not tos:
        return {"id": "tos", "content": "<h2>Terms of Service</h2><p>Terms of service content will be added by the administrator.</p>", "updated_at": None}
    return tos


@router.post("/user/redeem-points-to-wallet")
async def redeem_points_to_wallet(request: Request, user: Dict = Depends(require_auth)):
    """User redeems loyalty points as wallet money when becoming a seller"""
    body = await request.json()
    points_to_redeem = body.get("points", 0)
    
    if points_to_redeem <= 0:
        raise HTTPException(status_code=400, detail="Points must be positive")
    
    user_data = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    available_points = user_data.get("loyalty_points", 0)
    if points_to_redeem > available_points:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Available: {available_points}")
    
    # Get loyalty settings for conversion rate
    settings = await get_loyalty_settings()
    redeem_rate = settings.get("redeem_points_per_dollar", 100)
    if redeem_rate <= 0:
        redeem_rate = 100
    
    money_value = round(points_to_redeem / redeem_rate, 2)
    
    # Find user's shop
    shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=400, detail="You must have a shop to redeem points to wallet")
    
    now = datetime.now(timezone.utc)
    
    # Deduct points from user
    new_points = available_points - points_to_redeem
    await db.users.update_one({"id": user["user_id"]}, {"$set": {"loyalty_points": new_points}})
    
    # Add money to shop wallet
    current_balance = shop.get("wallet_balance", 0) or 0
    new_balance = round(current_balance + money_value, 2)
    await db.shops.update_one({"id": shop["id"]}, {"$set": {"wallet_balance": new_balance}})
    
    # Create wallet transaction
    txn = {
        "id": str(uuid.uuid4()),
        "shop_id": shop["id"],
        "shop_name": shop.get("name", ""),
        "type": "points_redeem",
        "amount": money_value,
        "balance_after": new_balance,
        "status": "completed",
        "note": f"Redeemed {points_to_redeem} loyalty points → ${money_value:.2f}",
        "created_at": now.isoformat()
    }
    await db.wallet_transactions.insert_one(txn)
    
    return {
        "message": f"Redeemed {points_to_redeem} points for ${money_value:.2f}",
        "points_redeemed": points_to_redeem,
        "money_value": money_value,
        "remaining_points": new_points,
        "new_wallet_balance": new_balance
    }


@router.get("/user/points-to-wallet-preview")
async def preview_points_to_wallet(points: int = 0, user: Dict = Depends(require_auth)):
    """Preview how many dollars points will convert to"""
    user_data = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    available_points = user_data.get("loyalty_points", 0) if user_data else 0
    
    settings = await get_loyalty_settings()
    redeem_rate = settings.get("redeem_points_per_dollar", 100)
    if redeem_rate <= 0:
        redeem_rate = 100
    
    money_value = round(points / redeem_rate, 2) if points > 0 else 0
    
    return {
        "available_points": available_points,
        "points_to_redeem": min(points, available_points),
        "money_value": money_value,
        "redeem_rate": redeem_rate,
        "rate_description": f"{redeem_rate} points = $1.00"
    }


@router.get("/public/seller-settings")
async def get_public_seller_settings():
    """Public: Get seller-facing settings (tier descriptions, yearly discount, sale badge)"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if not settings:
        return {"tiers": {}, "yearly_discount_percent": 0, "seller_cta_sale_badge_enabled": False}
    
    tiers = settings.get("tiers", {})
    return {
        "tiers": {
            "starter": {
                "name": tiers.get("starter", {}).get("name", "Starter"),
                "monthly_price": tiers.get("starter", {}).get("monthly_price", 19),
                "yearly_price": tiers.get("starter", {}).get("yearly_price", 0),
                "product_limit": tiers.get("starter", {}).get("product_limit", 50),
                "commission_rate": tiers.get("starter", {}).get("commission_rate", 12),
                "analytics_level": tiers.get("starter", {}).get("analytics_level", "basic"),
                "monthly_wallet_credit": tiers.get("starter", {}).get("monthly_wallet_credit", 1),
                "search_priority": tiers.get("starter", {}).get("search_priority", "normal"),
                "badge": tiers.get("starter", {}).get("badge", ""),
                "report_download": tiers.get("starter", {}).get("report_download", False),
                "description": tiers.get("starter", {}).get("description", ""),
                "trial_days": tiers.get("starter", {}).get("trial_days", 7),
                "yearly_sale_percent": tiers.get("starter", {}).get("yearly_sale_percent", 0),
            },
            "pro": {
                "name": tiers.get("pro", {}).get("name", "Pro"),
                "monthly_price": tiers.get("pro", {}).get("monthly_price", 39),
                "yearly_price": tiers.get("pro", {}).get("yearly_price", 0),
                "product_limit": tiers.get("pro", {}).get("product_limit", 0),
                "commission_rate": tiers.get("pro", {}).get("commission_rate", 6),
                "analytics_level": tiers.get("pro", {}).get("analytics_level", "full"),
                "monthly_wallet_credit": tiers.get("pro", {}).get("monthly_wallet_credit", 3),
                "search_priority": tiers.get("pro", {}).get("search_priority", "higher"),
                "badge": tiers.get("pro", {}).get("badge", "Pro Seller"),
                "report_download": tiers.get("pro", {}).get("report_download", True),
                "description": tiers.get("pro", {}).get("description", ""),
                "trial_days": tiers.get("pro", {}).get("trial_days", 7),
                "yearly_sale_percent": tiers.get("pro", {}).get("yearly_sale_percent", 0),
            }
        },
        "yearly_discount_percent": settings.get("yearly_discount_percent", 0),
        "seller_cta_sale_badge_enabled": settings.get("seller_cta_sale_badge_enabled", False),
    }


@router.get("/storefront/themes")
async def get_public_themes():
    """Public: List all enabled storefront themes"""
    themes = await db.storefront_themes.find({"enabled": True}, {"_id": 0}).to_list(100)
    if not themes:
        # Seed themes if not present
        await seed_storefront_themes()
        themes = await db.storefront_themes.find({"enabled": True}, {"_id": 0}).to_list(100)
    return {"themes": themes}


@router.get("/theme-sale-info")
async def get_theme_sale_info():
    """Public: Get theme sale percent"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0, "theme_sale_percent": 1})
    return {"theme_sale_percent": (settings or {}).get("theme_sale_percent", 0)}


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "OpenMarketlb API"}



# ============ PUBLIC: SHOP SALE INFO ============

@router.get("/shops/{shop_id}/active-sale")
async def get_public_shop_active_sale(shop_id: str):
    """Public: Get active sale for a shop"""
    now = datetime.now(timezone.utc).isoformat()
    sale = await db.shop_sales.find_one(
        {"shop_id": shop_id, "is_active": True, "end_date": {"$gt": now}},
        {"_id": 0, "original_prices": 0}
    )
    return sale


@router.get("/shops/{shop_id}/gallery")
async def get_public_shop_gallery(shop_id: str):
    """Public: Get a shop's APPROVED gallery photos (pending/suspended are hidden from public)"""
    shop = await db.shops.find_one(
        {"id": shop_id},
        {"_id": 0, "id": 1, "name": 1, "gallery": 1}
    )
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    all_photos = shop.get("gallery", []) or []
    # Show only approved photos publicly; treat legacy items without status as approved
    approved = [p for p in all_photos if p.get("status", "approved") == "approved"]
    return {"shop_id": shop["id"], "shop_name": shop.get("name"), "gallery": approved}


# ============ SAVED LOCATIONS ============

@router.get("/user/saved-locations")
async def get_saved_locations(user: Dict = Depends(require_auth)):
    """Get user's saved delivery locations"""
    locations = await db.saved_locations.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("last_used", -1).to_list(10)
    return locations


@router.post("/user/saved-locations")
async def save_location(request: Request, user: Dict = Depends(require_auth)):
    """Save a delivery location"""
    body = await request.json()
    loc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "label": body.get("label", ""),
        "address": body.get("address", ""),
        "city": body.get("city", ""),
        "state": body.get("state", ""),
        "zip": body.get("zip", ""),
        "lat": body.get("lat"),
        "lng": body.get("lng"),
        "last_used": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Upsert based on lat/lng combo to avoid duplicates
    if loc["lat"] and loc["lng"]:
        existing = await db.saved_locations.find_one({
            "user_id": user["user_id"],
            "lat": loc["lat"], "lng": loc["lng"]
        })
        if existing:
            await db.saved_locations.update_one(
                {"id": existing["id"]},
                {"$set": {"last_used": loc["last_used"], "address": loc["address"], "label": loc.get("label", "")}}
            )
            return {**existing, "last_used": loc["last_used"]}
    await db.saved_locations.insert_one(loc)
    return {k: v for k, v in loc.items() if k != "_id"}


# ============ DELIVERY TRACKING ============

@router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str):
    """Public: Get delivery tracking info for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    tracking = await db.delivery_tracking.find(
        {"order_id": order_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    
    # Get driver info if assigned
    driver_info = None
    if order.get("delivery_user_id"):
        driver = await db.users.find_one({"id": order["delivery_user_id"]}, {"_id": 0, "password": 0})
        if driver:
            driver_info = {"name": driver.get("name", "Driver"), "phone": driver.get("phone")}
    
    return {
        "order_id": order_id,
        "delivery_status": order.get("delivery_status", "pending"),
        "order_status": order.get("order_status", "pending"),
        "driver": driver_info,
        "customer_location": order.get("customer_location"),
        "tracking_updates": tracking,
        "current_driver_location": tracking[0].get("location") if tracking else None,
    }


@router.post("/delivery/update-location")
async def update_driver_location(request: Request, user: Dict = Depends(require_delivery)):
    """Driver: Update current location for live tracking"""
    body = await request.json()
    order_id = body.get("order_id")
    lat = body.get("lat")
    lng = body.get("lng")
    
    if not order_id or lat is None or lng is None:
        raise HTTPException(status_code=400, detail="order_id, lat, lng required")
    
    tracking_doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "driver_id": user["user_id"],
        "location": {"lat": lat, "lng": lng},
        "status": body.get("status", "in_transit"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.delivery_tracking.insert_one(tracking_doc)
    
    # Also update on the order itself for quick access
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"driver_current_location": {"lat": lat, "lng": lng}, "driver_location_updated": tracking_doc["timestamp"]}}
    )
    
    return {"status": "ok"}
