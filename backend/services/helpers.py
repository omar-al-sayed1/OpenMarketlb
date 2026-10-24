"""
Shared helper functions used across multiple routers.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict
import uuid
import asyncio
import math

from config import db, logger


async def auto_credit_bonus_events(user_id: str):
    """Auto-credit active 'added_points' bonus events to user on login (one-time per user per event)"""
    try:
        settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
        if not settings or not settings.get("loyalty_enabled"):
            return
        
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        bonus_events = settings.get("bonus_events", [])
        
        for event in bonus_events:
            if not event.get("is_active") or event.get("type") != "added_points":
                continue
            
            start = event.get("start_date", "")
            end = event.get("end_date", "")
            if start and start > now:
                continue
            if end and end < now:
                continue
            
            event_id = event.get("id")
            if not event_id:
                continue
            
            existing = await db.loyalty_ledger.find_one({
                "user_id": user_id,
                "type": "bonus_event",
                "event_id": event_id
            })
            if existing:
                continue
            
            points = event.get("added_points", 100)
            await db.users.update_one(
                {"id": user_id},
                {"$inc": {"loyalty_points_balance": points, "loyalty_points_lifetime": points}}
            )
            
            await db.loyalty_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "event_id": event_id,
                "type": "bonus_event",
                "points": points,
                "description": f"Bonus: {event.get('name', 'Bonus Event')} (+{points} pts) - auto-credited on login",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"Auto-credited {points} bonus points to user {user_id} for event '{event.get('name')}'")
    except Exception as e:
        logger.error(f"Error auto-crediting bonus events: {e}")


async def create_notification(recipient_type: str, title: str, message: str, notification_type: str, link: Optional[str] = None, recipient_id: Optional[str] = None):
    """Create a notification for admin or shop"""
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": recipient_type,
        "recipient_id": recipient_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "link": link,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification


async def get_commission_rate(shop_id: str = None) -> float:
    """Get the commission rate from platform settings or shop tier (returns decimal, e.g. 0.10 for 10%)"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    # Default base rate from platform settings (if commission_enabled flag is True OR set explicitly)
    base_rate = 0.0
    if settings:
        # If commission is explicitly enabled, take the platform default
        if settings.get("commission_enabled"):
            base_rate = settings.get("commission_percentage", 0) / 100
        # Even if global flag is False/missing, fall back to a sensible default based on tier
    
    if shop_id:
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "tier": 1, "commission_percentage": 1})
        if shop:
            # Per-shop commission_percentage overrides everything
            if shop.get("commission_percentage") is not None:
                base_rate = shop["commission_percentage"] / 100
            else:
                # Otherwise, use tier commission_rate from platform settings
                tier = shop.get("tier", "pro")
                tiers = (settings or {}).get("tiers", {})
                tier_config = tiers.get(tier, {})
                if tier_config.get("commission_rate") is not None:
                    base_rate = tier_config["commission_rate"] / 100
        
        now = datetime.now(timezone.utc).isoformat()
        active_promos = await db.shop_commission_promos.find({
            "shop_id": shop_id,
            "is_active": True,
            "expires_at": {"$gt": now}
        }, {"_id": 0}).to_list(10)
        
        total_reduction = sum(p.get("reduction_percent", 0) for p in active_promos)
        if total_reduction > 0:
            base_rate = max(0, base_rate - (total_reduction / 100))
    
    return base_rate


async def get_shop_commission_info(shop_id: str = None) -> dict:
    """Return both commission_rate (decimal) and commission_type for a given shop."""
    rate = await get_commission_rate(shop_id)
    commission_type = "on_customer"
    if shop_id:
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "commission_type": 1})
        if shop and shop.get("commission_type") in ("on_shop", "on_customer", "half_half"):
            commission_type = shop["commission_type"]
    return {"rate": rate, "type": commission_type}


def get_customer_markup_factor(commission_rate: float, commission_type: str) -> float:
    """Calculate the markup factor applied to the shop's listed price for the customer-facing price."""
    if commission_rate <= 0:
        return 1.0
    if commission_type == "on_shop":
        return 1.0
    if commission_type == "half_half":
        return 1.0 + (commission_rate / 2.0)
    return 1.0 + commission_rate


def get_shop_revenue_factor(commission_rate: float, commission_type: str) -> float:
    """Calculate the factor applied to the shop's listed price to determine the shop's actual revenue."""
    if commission_rate <= 0:
        return 1.0
    if commission_type == "on_customer":
        return 1.0
    if commission_type == "half_half":
        return 1.0 - (commission_rate / 2.0)
    return 1.0 - commission_rate


def apply_commission_to_product(product: dict, commission_rate: float, commission_type: str = "on_customer") -> dict:
    """Apply commission to product prices for customer view based on commission_type.

    - on_customer: customer sees price * (1 + rate)   (markup added on top)
    - on_shop:     customer sees price (no markup)    (commission deducted from shop revenue later)
    - half_half:   customer sees price * (1 + rate/2) (half markup; other half deducted from shop)
    """
    result = product.copy()
    original_price = product.get('price', 0)
    original_discount = product.get('discount_price')
    
    # Store original prices
    result['original_price'] = original_price
    result['original_discount_price'] = original_discount
    
    factor = get_customer_markup_factor(commission_rate, commission_type)
    
    # Apply commission markup based on factor
    if factor != 1.0:
        result['price'] = round(original_price * factor, 2)
        if original_discount:
            result['discount_price'] = round(original_discount * factor, 2)
        
        # Apply commission to variant prices
        for variant_type in ['colors', 'sizes', 'shapes', 'types']:
            variants = result.get(variant_type, [])
            if variants:
                for v in variants:
                    if v.get('price') is not None:
                        v['original_price'] = v['price']
                        v['price'] = round(v['price'] * factor, 2)
                    if v.get('discount_price') is not None:
                        v['original_discount_price'] = v['discount_price']
                        v['discount_price'] = round(v['discount_price'] * factor, 2)
    
    return result



def get_default_loyalty_settings():
    return {
        "loyalty_enabled": True,
        "points_per_dollar": 1,
        "redeem_points_per_dollar": 100,
        "tiers": [
            {"name": "Bronze", "min_points": 0, "multiplier": 1.0, "benefits": ["1x points on every purchase", "Access to member-only deals", "Order tracking updates"]},
            {"name": "Silver", "min_points": 500, "multiplier": 1.5, "benefits": ["1.5x points on every purchase", "Early access to sales", "Priority customer support"]},
            {"name": "Gold", "min_points": 2000, "multiplier": 2.0, "benefits": ["2x points on every purchase", "Exclusive VIP deals & discounts", "Birthday bonus points", "Priority customer support"]}
        ],
        "bonus_events": [],
        "double_points_weekend_enabled": False,
        "birthday_bonus_enabled": False,
        "birthday_bonus_points": 50,
        "first_purchase_bonus_enabled": False,
        "first_purchase_bonus_points": 100,
    }



async def get_loyalty_settings():
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    defaults = get_default_loyalty_settings()
    if not settings:
        return defaults
    # Build loyalty-specific settings, avoid subscription tier conflict
    result = {}
    for key, val in defaults.items():
        if key == "tiers":
            # Loyalty tiers are a list; subscription tiers are a dict
            # Priority: loyalty_tiers field > tiers field (if list) > defaults
            stored = settings.get("loyalty_tiers")
            if isinstance(stored, list) and len(stored) > 0:
                result["tiers"] = stored
            else:
                fallback = settings.get("tiers")
                if isinstance(fallback, list) and len(fallback) > 0:
                    result["tiers"] = fallback
                else:
                    result["tiers"] = val  # Use default loyalty tiers (Bronze/Silver/Gold)
        else:
            result[key] = settings.get(key, val)
    return result



def calc_tier(lifetime_points: float, tiers: list) -> dict:
    """Calculate user's tier based on lifetime points"""
    sorted_tiers = sorted(tiers, key=lambda t: t["min_points"], reverse=True)
    for tier in sorted_tiers:
        if lifetime_points >= tier["min_points"]:
            return tier
    return tiers[0] if tiers else {"name": "Bronze", "min_points": 0, "multiplier": 1.0, "benefits": []}



def calc_redemption_value(points: int, redeem_rate: int) -> float:
    """Convert points to dollar value"""
    if redeem_rate <= 0:
        return 0
    return round(points / redeem_rate, 2)



THEME_DEFINITIONS = [
    {"key": "classic", "name": "Classic Grid", "description": "Clean, minimal product grid - perfect for any shop", "is_default": True, "preview_color": "#6366f1", "best_for": "All shops", "pro_only": False},
    {"key": "magazine", "name": "Magazine", "description": "Editorial style with large product images", "preview_color": "#ec4899", "best_for": "Fashion, Lifestyle", "pro_only": True},
    {"key": "luxury", "name": "Luxury", "description": "Dark theme with gold accents - premium feel", "preview_color": "#d4a574", "best_for": "Jewelry, High-end", "pro_only": True},
    {"key": "minimal", "name": "Minimal", "description": "Less is more - clean list view", "preview_color": "#94a3b8", "best_for": "Boutique, Artisan", "pro_only": True},
    {"key": "catalog", "name": "Catalog", "description": "Dense product grid - many products at once", "preview_color": "#0ea5e9", "best_for": "Electronics, Wholesale", "pro_only": True},
    {"key": "showcase", "name": "Showcase", "description": "Large cards with hover reveal - highlight products", "preview_color": "#a855f7", "best_for": "Premium, Featured", "pro_only": True},
    {"key": "marketplace", "name": "Marketplace", "description": "Emerald style marketplace look", "preview_color": "#10b981", "best_for": "General, Marketplace", "pro_only": True},
    {"key": "social", "name": "Social", "description": "Instagram-style product cards", "preview_color": "#ec4899", "best_for": "Lifestyle, Trending", "pro_only": True},
    {"key": "professional", "name": "Professional", "description": "Corporate blue, business-friendly", "preview_color": "#2563eb", "best_for": "B2B, Services", "pro_only": True},
    {"key": "seasonal", "name": "Seasonal", "description": "Warm amber-orange theme for special seasons", "preview_color": "#f59e0b", "best_for": "Holiday, Promotions", "pro_only": True},
    {"key": "video", "name": "Video", "description": "Dark TikTok-style portrait product cards", "preview_color": "#ef4444", "best_for": "Trends, Reels", "pro_only": True},
    {"key": "arabic_heritage", "name": "Arabic Heritage", "description": "RTL-friendly with amber/stone heritage palette", "preview_color": "#92400e", "best_for": "Heritage, Crafts", "pro_only": True},
    {"key": "fashion_boutique", "name": "Fashion Boutique", "description": "Pink/fuchsia chic boutique aesthetic", "preview_color": "#d946ef", "best_for": "Fashion, Beauty", "pro_only": True},
    {"key": "neon_night", "name": "Neon Night", "description": "Dark neon cyan/violet futuristic vibe", "preview_color": "#06b6d4", "best_for": "Gaming, Tech", "pro_only": True},
    {"key": "earth_organic", "name": "Earth & Organic", "description": "Natural stone & amber - organic feel", "preview_color": "#78716c", "best_for": "Organic, Natural goods", "pro_only": True},
]


async def seed_storefront_themes():
    """Seed storefront themes; upsert by key for migrations."""
    now_iso = datetime.now(timezone.utc).isoformat()
    valid_keys = {t["key"] for t in THEME_DEFINITIONS}
    # Remove any obsolete themes that no longer exist in THEME_DEFINITIONS
    await db.storefront_themes.delete_many({"key": {"$nin": list(valid_keys)}})
    for t in THEME_DEFINITIONS:
        existing = await db.storefront_themes.find_one({"key": t["key"]}, {"_id": 0})
        if not existing:
            await db.storefront_themes.insert_one({
                **t,
                "enabled": True,
                "price_usd": 0.0 if t.get("is_default") else 6.0,
                "created_at": now_iso
            })
        else:
            # Update metadata (name, description, best_for, pro_only, preview_color)
            update_fields = {
                "name": t["name"],
                "description": t["description"],
                "preview_color": t.get("preview_color", existing.get("preview_color", "#6366f1")),
                "best_for": t.get("best_for", existing.get("best_for", "")),
                "pro_only": t.get("pro_only", existing.get("pro_only", False)),
                "is_default": t.get("is_default", existing.get("is_default", False)),
            }
            await db.storefront_themes.update_one(
                {"key": t["key"]},
                {"$set": update_fields}
            )
    # Reset any shop currently using an obsolete theme to "classic"
    await db.shops.update_many(
        {"theme": {"$nin": list(valid_keys)}, "theme": {"$exists": True}},
        {"$set": {"theme": "classic"}}
    )


def apply_commission_to_product(product: dict, commission_rate: float, commission_type: str = "on_customer") -> dict:
    """Apply commission to product prices for customer view based on commission_type.

    - on_customer: customer sees price * (1 + rate)   (markup added on top)
    - on_shop:     customer sees price (no markup)    (commission deducted from shop revenue later)
    - half_half:   customer sees price * (1 + rate/2) (half markup; other half deducted from shop)
    """
    result = product.copy()
    original_price = product.get('price', 0)
    original_discount = product.get('discount_price')
    
    # Store original prices
    result['original_price'] = original_price
    result['original_discount_price'] = original_discount
    
    factor = get_customer_markup_factor(commission_rate, commission_type)
    
    # Apply commission markup based on factor
    if factor != 1.0:
        result['price'] = round(original_price * factor, 2)
        if original_discount:
            result['discount_price'] = round(original_discount * factor, 2)
        
        # Apply commission to variant prices
        for variant_type in ['colors', 'sizes', 'shapes', 'types']:
            variants = result.get(variant_type, [])
            if variants:
                for v in variants:
                    if v.get('price') is not None:
                        v['original_price'] = v['price']
                        v['price'] = round(v['price'] * factor, 2)
                    if v.get('discount_price') is not None:
                        v['original_discount_price'] = v['discount_price']
                        v['discount_price'] = round(v['discount_price'] * factor, 2)
    
    return result



def get_default_loyalty_settings():
    return {
        "loyalty_enabled": True,
        "points_per_dollar": 1,
        "redeem_points_per_dollar": 100,
        "tiers": [
            {"name": "Bronze", "min_points": 0, "multiplier": 1.0, "benefits": ["1x points on every purchase", "Access to member-only deals", "Order tracking updates"]},
            {"name": "Silver", "min_points": 500, "multiplier": 1.5, "benefits": ["1.5x points on every purchase", "Early access to sales", "Priority customer support"]},
            {"name": "Gold", "min_points": 2000, "multiplier": 2.0, "benefits": ["2x points on every purchase", "Exclusive VIP deals & discounts", "Birthday bonus points", "Priority customer support"]}
        ],
        "bonus_events": [],
        "double_points_weekend_enabled": False,
        "birthday_bonus_enabled": False,
        "birthday_bonus_points": 50,
        "first_purchase_bonus_enabled": False,
        "first_purchase_bonus_points": 100,
    }



async def get_loyalty_settings():
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    defaults = get_default_loyalty_settings()
    if not settings:
        return defaults
    # Build loyalty-specific settings, avoid subscription tier conflict
    result = {}
    for key, val in defaults.items():
        if key == "tiers":
            # Loyalty tiers are a list; subscription tiers are a dict
            # Priority: loyalty_tiers field > tiers field (if list) > defaults
            stored = settings.get("loyalty_tiers")
            if isinstance(stored, list) and len(stored) > 0:
                result["tiers"] = stored
            else:
                fallback = settings.get("tiers")
                if isinstance(fallback, list) and len(fallback) > 0:
                    result["tiers"] = fallback
                else:
                    result["tiers"] = val  # Use default loyalty tiers (Bronze/Silver/Gold)
        else:
            result[key] = settings.get(key, val)
    return result



def calc_tier(lifetime_points: float, tiers: list) -> dict:
    """Calculate user's tier based on lifetime points"""
    sorted_tiers = sorted(tiers, key=lambda t: t["min_points"], reverse=True)
    for tier in sorted_tiers:
        if lifetime_points >= tier["min_points"]:
            return tier
    return tiers[0] if tiers else {"name": "Bronze", "min_points": 0, "multiplier": 1.0, "benefits": []}



def calc_redemption_value(points: int, redeem_rate: int) -> float:
    """Convert points to dollar value"""
    if redeem_rate <= 0:
        return 0
    return round(points / redeem_rate, 2)



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


def calc_next_tier(lifetime_points: float, tiers: list) -> Optional[dict]:
    """Get the next tier info"""
    sorted_tiers = sorted(tiers, key=lambda t: t["min_points"])
    for tier in sorted_tiers:
        if tier["min_points"] > lifetime_points:
            return tier
    return None


def calc_points_earned(order_subtotal: float, multiplier: float, points_per_dollar: float, bonus_multiplier: float = 1.0) -> int:
    """Calculate points earned from an order"""
    return int(order_subtotal * points_per_dollar * multiplier * bonus_multiplier)


def cap_discount_to_commission(discount: float, commission_amount: float) -> float:
    """Cap the loyalty discount to the commission amount"""
    return min(discount, commission_amount)


def get_welcome_bonus(is_referred: bool, platform_settings: Optional[dict] = None) -> dict:
    """Return the welcome bonus a shop receives on approval.

    Rules (configurable via platform_settings, with sensible defaults):
      - Non-referred shop: $2 wallet credit + 1 free product sponsor
      - Referred shop:     $3 wallet credit + 2 free product sponsors

    platform_settings keys (all optional):
      - shop_welcome_wallet_bonus            (default 2.0)
      - shop_welcome_sponsor_count           (default 1)
      - shop_welcome_wallet_bonus_referred   (default 3.0)
      - shop_welcome_sponsor_count_referred  (default 2)
    """
    ps = platform_settings or {}

    def _f(key, default):
        try:
            v = ps.get(key)
            return float(v) if v is not None else float(default)
        except (TypeError, ValueError):
            return float(default)

    def _i(key, default):
        try:
            v = ps.get(key)
            return int(v) if v is not None else int(default)
        except (TypeError, ValueError):
            return int(default)

    if is_referred:
        wallet = _f("shop_welcome_wallet_bonus_referred", 3.0)
        sponsors = _i("shop_welcome_sponsor_count_referred", 2)
    else:
        wallet = _f("shop_welcome_wallet_bonus", 2.0)
        sponsors = _i("shop_welcome_sponsor_count", 1)

    parts = []
    if wallet > 0:
        parts.append(f"${wallet:.2f} wallet credit")
    if sponsors > 0:
        parts.append(f"{sponsors} free product sponsor{'s' if sponsors != 1 else ''}")
    summary = " + ".join(parts) or "welcome gifts"

    return {
        "wallet": round(wallet, 2),
        "sponsors": sponsors,
        "is_referred": bool(is_referred),
        "summary": summary,
    }




async def get_shop_tier_commission(shop: dict) -> float:
    """Get commission rate based on shop's tier"""
    # Per-shop override takes priority
    if shop.get("commission_percentage") is not None:
        return shop["commission_percentage"] / 100
    
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if not settings or not settings.get("commission_enabled"):
        return 0.0
    
    tier = shop.get("tier", "starter")
    tiers = settings.get("tiers", {})
    tier_config = tiers.get(tier, {})
    commission = tier_config.get("commission_rate", settings.get("commission_percentage", 10))
    return commission / 100


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


# Monthly subscription perks granted to subscribed shops (from their subscription date)
SUBSCRIPTION_MONTHLY_FREE_SPINS = 1
SUBSCRIPTION_MONTHLY_SPONSORS = 2


def is_shop_subscribed(shop: Dict) -> bool:
    """A shop is 'subscribed' (a paying subscriber) only if it actually requires a
    subscription AND that subscription is active/trial. Shops the admin marked as
    free (subscription_required=False) are NOT subscribers, even though their
    subscription_status may read 'active'."""
    if not shop:
        return False
    if shop.get("subscription_required") is False:
        return False
    if shop.get("status") != "approved":
        return False
    return (shop.get("subscription_status") or "").lower() in ("active", "trial")


async def grant_monthly_subscription_benefits(shop: Dict) -> Dict:
    """Lazily grant a subscribed shop its monthly perks — 1 free spin + 2 sponsor
    credits — on a monthly cadence measured from its subscription date. Idempotent:
    only grants once per ~30-day cycle. Returns the (possibly updated) shop dict.

    Called on shop dashboard / spin loads so it works without relying on background jobs.
    """
    try:
        if not is_shop_subscribed(shop):
            return shop  # free / non-subscribed shops get no monthly perks

        now = datetime.now(timezone.utc)

        def _parse(dt):
            if not dt:
                return None
            try:
                d = datetime.fromisoformat(dt) if isinstance(dt, str) else dt
                return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
            except Exception:
                return None

        last = shop.get("subscription_benefits_last_granted")
        if last:
            last_dt = _parse(last)
            if last_dt and (now - last_dt).days < 30:
                return shop  # already granted this cycle
        # else: never granted → grant now (they just subscribed)

        # +1 free spin (shop_spin_state), keeping last_monthly_grant_at in sync so the
        # spin endpoint doesn't double-grant.
        await db.shop_spin_state.update_one(
            {"shop_id": shop["id"]},
            {"$inc": {"free_spins_balance": SUBSCRIPTION_MONTHLY_FREE_SPINS},
             "$set": {"last_monthly_grant_at": now.isoformat(), "updated_at": now.isoformat()},
             "$setOnInsert": {"shop_id": shop["id"]}},
            upsert=True,
        )
        # +2 sponsor credits + stamp the grant date on the shop
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$inc": {"free_sponsor_credits": SUBSCRIPTION_MONTHLY_SPONSORS},
             "$set": {"subscription_benefits_last_granted": now.isoformat()}},
        )
        shop["free_sponsor_credits"] = int(shop.get("free_sponsor_credits", 0) or 0) + SUBSCRIPTION_MONTHLY_SPONSORS
        shop["subscription_benefits_last_granted"] = now.isoformat()
        logger.info(f"Granted monthly subscription perks to shop {shop.get('name','')} ({shop['id']})")
    except Exception as e:
        logger.error(f"grant_monthly_subscription_benefits error for shop {shop.get('id')}: {e}")
    return shop


async def mark_subscription_ended(shop: Dict, reason: str = "expired"):
    """Record that a shop's subscription just ended and notify admin.

    Called at the transition moment (active/trial → expired, or on cancel), so it
    fires once per ending. Stamps `subscription_ended_at` (used by the admin shops
    page to show a small 'ended N ago' badge that auto-disappears after 5 days) and
    `subscription_end_reason` ('expired' | 'cancelled').
    """
    try:
        now = datetime.now(timezone.utc)
        await db.shops.update_one(
            {"id": shop["id"]},
            {"$set": {
                "subscription_ended_at": now.isoformat(),
                "subscription_end_reason": reason,
            }},
        )
        label = "cancelled their subscription" if reason == "cancelled" else "subscription duration ended"
        await create_notification(
            "admin",
            "Subscription Ended",
            f"{shop.get('name', 'A shop')} — {label}.",
            "subscription",
            "/admin/shops",
        )
        logger.info(f"Subscription ended ({reason}) for shop {shop.get('name','')} ({shop.get('id')})")
    except Exception as e:
        logger.error(f"mark_subscription_ended error for shop {shop.get('id')}: {e}")


async def run_seller_model_migration():
    """Idempotent migration:
    - Force card_subscription_enabled = False (card subscription removed).
    - Drop the legacy 'starter' tier from platform_settings.tiers (only 'pro' remains).
    - Migrate any shops still on 'starter' tier to 'pro'.
    - Backfill commission_type ('on_customer') and subscription_required (True) on shops.
    - Initialise default subscription price ($19/month) if not configured.
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

        # Ensure the 'pro' (single subscription) tier exists and has a sensible default price
        settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
        tiers = (settings or {}).get("tiers", {}) or {}
        pro = tiers.get("pro", {}) or {}
        # Constrain monthly_price to $15-$20 range with $19 default
        try:
            current_price = float(pro.get("monthly_price", 0))
        except Exception:
            current_price = 0
        if not (15.0 <= current_price <= 20.0):
            pro["monthly_price"] = 19.0
        # Set sane defaults if missing
        pro.setdefault("yearly_price", round(pro["monthly_price"] * 10, 2))
        pro.setdefault("name", "Subscription")
        pro.setdefault("description", "Unlock the full seller experience for your shop. Get visibility, advanced tools and full marketplace access.")
        pro.setdefault("monthly_wallet_credit", 0)
        pro.setdefault("commission_rate", (settings or {}).get("commission_percentage", 10))
        pro.setdefault("features", [
            "List unlimited products",
            "Full storefront customisation",
            "Marketing & boost tools",
            "Advanced analytics & reports",
            "Priority customer support",
        ])
        await db.platform_settings.update_one(
            {"id": "platform"},
            {"$set": {"tiers.pro": pro, "subscription_price": pro["monthly_price"]}},
            upsert=True,
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


RENEWAL_REMINDER_DAYS = 3


async def check_and_send_renewal_reminders():
    """Notify shops whose subscription ends within ~3 days that they should renew.

    Two variants of the message depending on whether the shop can already afford a
    renewal from its wallet:
      - Not enough balance  → "add credits to your wallet so you can renew".
      - Enough balance      → friendly reminder that renewal is coming up.

    Sent once per subscription cycle: guarded by `renewal_reminder_sent_for` which
    stores the current subscription_end, so it re-arms automatically after a renewal
    (the end date changes) and never spams on repeated runs.
    """
    try:
        settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0}) or {}
        pro = (settings.get("tiers") or {}).get("pro") or {}
        price = settings.get("subscription_price")
        if price is None:
            price = pro.get("monthly_price", 19)
        try:
            price = round(float(price or 0), 2)
        except (TypeError, ValueError):
            price = 19.0

        now = datetime.now(timezone.utc)
        shops = await db.shops.find({
            "status": "approved",
            "subscription_required": {"$ne": False},
            "subscription_status": {"$in": ["active", "trial"]},
            "subscription_end": {"$exists": True, "$ne": None},
        }, {"_id": 0}).to_list(2000)

        for shop in shops:
            try:
                sub_end = shop.get("subscription_end")
                end_date = parse_datetime_aware(sub_end)
                if not end_date:
                    continue
                # Skip auto-renewing shops — they don't need to be reminded to add funds
                if shop.get("auto_renew_enabled"):
                    continue
                seconds_left = (end_date - now).total_seconds()
                if seconds_left <= 0:
                    continue  # already ended (handled by expiry logic)
                days_left = seconds_left / 86400.0
                if days_left > RENEWAL_REMINDER_DAYS:
                    continue  # not within the reminder window yet
                # Only once per cycle
                if shop.get("renewal_reminder_sent_for") == sub_end:
                    continue

                whole_days = max(1, int(round(days_left)))
                balance = float(shop.get("wallet_balance", 0) or 0)
                has_enough = balance >= price

                if has_enough:
                    title = "⏰ Subscription renews soon"
                    message = (
                        f"Your subscription ends in {whole_days} day{'s' if whole_days != 1 else ''}. "
                        f"You have enough wallet balance (${balance:.2f}) to renew for another 30 days from your dashboard."
                    )
                    link = "/shop/dashboard"
                else:
                    shortfall = round(price - balance, 2)
                    title = "⚠️ Add credits to renew your subscription"
                    message = (
                        f"Your subscription ends in {whole_days} day{'s' if whole_days != 1 else ''}. "
                        f"Renewal costs ${price:.2f} but your wallet has ${balance:.2f}. "
                        f"Add at least ${shortfall:.2f} to your wallet so you can renew and keep your shop active."
                    )
                    link = "/shop/wallet"

                await create_notification(
                    recipient_type="shop",
                    title=title,
                    message=message,
                    notification_type="subscription",
                    link=link,
                    recipient_id=shop["id"],
                )
                await db.shops.update_one(
                    {"id": shop["id"]},
                    {"$set": {"renewal_reminder_sent_for": sub_end, "renewal_reminder_sent_at": now.isoformat()}},
                )
                logger.info(f"Sent renewal reminder ({'enough' if has_enough else 'add-credits'}) to shop {shop.get('name','')} ({shop['id']})")
            except Exception as e:
                logger.error(f"Renewal reminder error for shop {shop.get('id')}: {e}")
    except Exception as e:
        logger.error(f"check_and_send_renewal_reminders error: {e}")


async def periodic_renewal_reminder_check():
    """Run the 3-days-left renewal reminder check every 6 hours."""
    while True:
        await asyncio.sleep(21600)  # 6 hours
        await check_and_send_renewal_reminders()
