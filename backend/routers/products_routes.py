"""
OpenMarket Lebanon - Products Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
import uuid, bcrypt, hashlib, random, os, asyncio, shutil, json, math
from pathlib import Path

from config import db, logger, UPLOADS_DIR, STRIPE_SECRET_KEY, ROOT_DIR, JWT_SECRET, JWT_ALGORITHM, client, SMTP_USER, SMTP_PASS
from auth import create_token, verify_token, get_current_user, require_auth, require_admin, require_shop, require_delivery, require_shop_or_admin, security
from models import *
from services.helpers import apply_commission_to_product, get_commission_rate, get_shop_commission_info

# ============================ Product ranking algorithm ============================
# A composite relevance score blending the signals we actually track, each transformed
# so no single one dominates:
#   • popularity  — log(views): heavy views help but with diminishing returns
#   • quality     — rating × log(reviews): a 5★ from 200 reviews outweighs 5★ from 1
#   • recency     — exponential freshness decay (half-life ~31 days)
#   • availability— out-of-stock is sunk so it never tops a list
#   • deal        — discount depth (capped so a 90% clearance can't dominate)
#   • trust       — verified / Pro shop boost
#   • promo       — free gift / active shop-sale nudge
# Two weight profiles: "recommended" (balanced default) and "popular"/"trending"
# (engagement-heavy, recency-light).
RANK_WEIGHTS = {
    'recommended': {'pop': 1.0, 'quality': 1.2, 'recency': 1.6, 'avail': 1.0, 'deal': 1.0, 'trust': 1.4, 'promo': 0.8},
    'popular':     {'pop': 2.6, 'quality': 1.5, 'recency': 0.4, 'avail': 0.8, 'deal': 0.5, 'trust': 0.6, 'promo': 0.3},
}

def _recency_score(created_at, now):
    """Exponential freshness decay — ~1.0 brand new, ~0.5 at 31d, ~0.25 at 62d."""
    try:
        if isinstance(created_at, str):
            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        elif isinstance(created_at, datetime):
            dt = created_at
        else:
            return 0.3
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        age_days = max(0.0, (now - dt).total_seconds() / 86400.0)
    except Exception:
        return 0.3
    return math.exp(-age_days / 45.0)

def _product_rank_score(p, verified_ids, pro_ids, now, w):
    views = p.get('view_count', 0) or 0
    rating = p.get('average_rating', 0) or 0
    reviews = p.get('review_count', 0) or 0
    stock = p.get('stock', 0) or 0
    price = p.get('price', 0) or 0
    disc = p.get('discount_price')
    shop_sale = p.get('shop_sale_discount', 0) or 0
    discount_pct = ((price - disc) / price) if (disc and price and disc < price) else 0.0

    popularity = math.log1p(views)
    quality = (rating / 5.0) * math.log1p(reviews) if reviews else 0.0
    recency = _recency_score(p.get('created_at'), now)
    availability = 1.0 if stock > 0 else 0.0
    deal = min(discount_pct, 0.7) + min(shop_sale / 100.0, 0.7)
    sid = p.get('shop_id')
    trust = (1.0 if sid in verified_ids else 0.0) + (0.5 if sid in pro_ids else 0.0)
    promo = (0.3 if p.get('has_free_gift') else 0.0) + (0.3 if shop_sale > 0 else 0.0)

    score = (
        w['pop'] * popularity + w['quality'] * quality + w['recency'] * recency +
        w['avail'] * availability + w['deal'] * deal + w['trust'] * trust + w['promo'] * promo
    )
    if stock <= 0:
        score *= 0.25  # sink (but don't drop) out-of-stock items
    return score

def _rank_products(products, verified_ids, pro_ids, profile):
    """Sort products in place by the composite score for the given weight profile."""
    now = datetime.now(timezone.utc)
    w = RANK_WEIGHTS.get(profile, RANK_WEIGHTS['recommended'])
    for p in products:
        p['_rank'] = _product_rank_score(p, verified_ids, pro_ids, now, w)
    products.sort(key=lambda p: p.get('_rank', 0.0), reverse=True)
    return products

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



@router.get("/categories", response_model=List[Category])
async def get_categories(active_only: bool = False):
    """Get all categories. If active_only=True, return only active categories for user filtering."""
    query = {"is_active": True} if active_only else {}
    categories = await db.categories.find(query, {"_id": 0}).to_list(1000)
    for cat in categories:
        if isinstance(cat.get('created_at'), str):
            cat['created_at'] = datetime.fromisoformat(cat['created_at'])
        # Ensure default values for new fields
        if 'parent_id' not in cat:
            cat['parent_id'] = None
        if 'level' not in cat:
            cat['level'] = 1
        if 'is_active' not in cat:
            cat['is_active'] = True
    return categories


@router.get("/categories/tree")
async def get_categories_tree(active_only: bool = False):
    """Get categories organized as a hierarchical tree structure."""
    query = {"is_active": True} if active_only else {}
    categories = await db.categories.find(query, {"_id": 0}).to_list(1000)
    
    # Ensure default values
    for cat in categories:
        if isinstance(cat.get('created_at'), str):
            cat['created_at'] = datetime.fromisoformat(cat['created_at']).isoformat()
        if 'parent_id' not in cat:
            cat['parent_id'] = None
        if 'level' not in cat:
            cat['level'] = 1
        if 'is_active' not in cat:
            cat['is_active'] = True
    
    # Build tree structure
    def build_tree(parent_id=None):
        children = []
        for cat in categories:
            if cat.get('parent_id') == parent_id:
                node = {**cat, 'children': build_tree(cat['id'])}
                children.append(node)
        return children
    
    return build_tree(None)


@router.get("/categories/top-level-with-preview")
async def get_top_level_categories_with_preview():
    """Public: Return top-level (level 1 / no parent) categories enriched with a sample
    product image and active product count. Used by the products page category cards
    when browsing ALL products (no category selected)."""
    cats = await db.categories.find({"is_active": True}, {"_id": 0}).sort(
        [("sort_order", 1), ("name", 1)]
    ).to_list(500)
    # Truly top-level categories only (no parent)
    top_cats = [c for c in cats if not c.get("parent_id")]

    all_cats = await db.categories.find({}, {"_id": 0, "id": 1, "parent_id": 1}).to_list(1000)

    def descendants_of(cat_id):
        result = {cat_id}
        stack = [cat_id]
        while stack:
            cur = stack.pop()
            for c in all_cats:
                if c.get("parent_id") == cur and c["id"] not in result:
                    result.add(c["id"])
                    stack.append(c["id"])
        return result

    enriched = []
    for cat in top_cats:
        desc_ids = list(descendants_of(cat["id"]))
        sample = await db.products.find_one(
            {
                "is_active": True,
                "$or": [
                    {"category_id": {"$in": desc_ids}},
                    {"category_ids": {"$in": desc_ids}},
                ],
                "images": {"$exists": True, "$ne": []},
            },
            {"_id": 0, "images": 1},
            sort=[("view_count", -1)],
        )
        product_count = await db.products.count_documents({
            "is_active": True,
            "$or": [
                {"category_id": {"$in": desc_ids}},
                {"category_ids": {"$in": desc_ids}},
            ],
        })
        cat_img = (cat.get("image_url") or "").strip()
        preview_image = cat_img if cat_img else (sample.get("images", [None])[0] if sample else None)
        enriched.append({
            "id": cat["id"],
            "name": cat["name"],
            "level": cat.get("level", 1),
            "preview_image": preview_image,
            "product_count": product_count,
            "has_children": any(c.get("parent_id") == cat["id"] for c in all_cats),
        })

    return {"categories": enriched}



@router.get("/categories/{category_id}/children-with-preview")
async def get_category_children_with_preview(category_id: str):
    """Public: Return immediate children categories enriched with a sample product image 
    (from the most popular product in each child category) plus the active product count.
    Used by the products page sub-category cards.
    """
    parent = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not parent:
        raise HTTPException(status_code=404, detail="Category not found")
    
    children = await db.categories.find(
        {"parent_id": category_id, "is_active": True}, {"_id": 0}
    ).sort([("sort_order", 1), ("name", 1)]).to_list(200)
    
    if not children:
        return {"parent": {"id": parent["id"], "name": parent["name"], "level": parent.get("level", 1)}, "children": []}
    
    # Build a quick lookup of all descendant category IDs per child (so products tagged in deeper subcats still count)
    all_cats = await db.categories.find({}, {"_id": 0, "id": 1, "parent_id": 1, "name": 1, "image_url": 1}).to_list(1000)
    cat_map = {c["id"]: c for c in all_cats}
    
    def descendants_of(cat_id):
        result = {cat_id}
        stack = [cat_id]
        while stack:
            cur = stack.pop()
            for c in all_cats:
                if c.get("parent_id") == cur and c["id"] not in result:
                    result.add(c["id"])
                    stack.append(c["id"])
        return result
    
    enriched = []
    for child in children:
        desc_ids = descendants_of(child["id"])
        # Get one popular product for image
        sample = await db.products.find_one(
            {
                "is_active": True,
                "$or": [
                    {"category_id": {"$in": list(desc_ids)}},
                    {"category_ids": {"$in": list(desc_ids)}},
                ],
                "images": {"$exists": True, "$ne": []},
            },
            {"_id": 0, "images": 1, "view_count": 1, "name": 1},
            sort=[("view_count", -1)],
        )
        # Count active products in the child (and descendants)
        product_count = await db.products.count_documents({
            "is_active": True,
            "$or": [
                {"category_id": {"$in": list(desc_ids)}},
                {"category_ids": {"$in": list(desc_ids)}},
            ],
        })
        # Resolve image URL: explicit category image_url wins; else sample product image
        cat_img = (child.get("image_url") or "").strip()
        preview_image = cat_img if cat_img else (sample.get("images", [None])[0] if sample else None)
        
        enriched.append({
            "id": child["id"],
            "name": child["name"],
            "level": child.get("level", 1),
            "parent_id": child.get("parent_id"),
            "preview_image": preview_image,
            "product_count": product_count,
            "has_children": any(c.get("parent_id") == child["id"] for c in all_cats),
        })
    
    return {
        "parent": {"id": parent["id"], "name": parent["name"], "level": parent.get("level", 1), "parent_id": parent.get("parent_id")},
        "children": enriched,
    }


@router.post("/categories", response_model=Category)
async def create_category(category: CategoryCreate, admin: Dict = Depends(require_admin)):
    # Calculate level based on parent
    level = 1
    if category.parent_id:
        parent = await db.categories.find_one({"id": category.parent_id}, {"_id": 0})
        if not parent:
            raise HTTPException(status_code=400, detail="Parent category not found")
        parent_level = parent.get('level', 1)
        if parent_level >= 3:
            raise HTTPException(status_code=400, detail="Maximum category depth (3 levels) reached")
        level = parent_level + 1
    
    cat_data = category.model_dump()
    cat_data['level'] = level
    cat = Category(**cat_data)
    doc = cat.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.categories.insert_one(doc)
    return cat


@router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category: CategoryCreate, admin: Dict = Depends(require_admin)):
    # Calculate level based on parent
    level = 1
    if category.parent_id:
        parent = await db.categories.find_one({"id": category.parent_id}, {"_id": 0})
        if not parent:
            raise HTTPException(status_code=400, detail="Parent category not found")
        parent_level = parent.get('level', 1)
        if parent_level >= 3:
            raise HTTPException(status_code=400, detail="Maximum category depth (3 levels) reached")
        level = parent_level + 1
    
    update_data = category.model_dump()
    update_data['level'] = level
    
    result = await db.categories.find_one_and_update(
        {"id": category_id},
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    if isinstance(result.get('created_at'), str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    return result


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: Dict = Depends(require_admin)):
    # Check if category has children
    children = await db.categories.find_one({"parent_id": category_id})
    if children:
        raise HTTPException(status_code=400, detail="Cannot delete category with subcategories. Delete children first.")
    
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


@router.get("/products")
async def get_products(
    category_id: Optional[str] = None,
    category_ids: Optional[str] = None,  # Comma-separated list
    search: Optional[str] = None,
    type: Optional[str] = None,  # men, women, kids (optional)
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_discount: Optional[int] = None,  # Minimum discount percentage (0-100)
    max_discount: Optional[int] = None,  # Maximum discount percentage (0-100)
    is_active: Optional[bool] = True,
    include_expired_shops: Optional[bool] = False,  # Admin use only
    sort_by: Optional[str] = None,  # newest, price_asc, price_desc, name_asc, popular, discount
    colors: Optional[str] = None,  # Comma-separated color names
    sizes: Optional[str] = None,  # Comma-separated size names
    shapes: Optional[str] = None,  # Comma-separated shape names
    in_stock_only: Optional[bool] = None,  # Only products with stock > 0
    has_gift: Optional[bool] = None,  # Only products with free gift
    page: Optional[int] = None,
    limit: Optional[int] = None,
    shop_id: Optional[str] = None  # Filter products by a specific shop
):
    query = {}

    if shop_id:
        query["shop_id"] = shop_id
    
    # Handle multiple categories - expand parent categories to include all descendants
    if category_ids or category_id:
        cat_list = [c.strip() for c in category_ids.split(',')] if category_ids else [category_id]
        
        # Expand: if any ID is a parent category, include all its descendant IDs
        all_cats = await db.categories.find({}, {"_id": 0, "id": 1, "parent_id": 1}).to_list(1000)
        expanded = set(cat_list)
        
        def add_descendants(parent_id):
            for c in all_cats:
                if c.get("parent_id") == parent_id:
                    expanded.add(c["id"])
                    add_descendants(c["id"])
        
        for cid in cat_list:
            add_descendants(cid)
        
        expanded_list = list(expanded)
        query["$or"] = [
            {"category_id": {"$in": expanded_list}},
            {"category_ids": {"$elemMatch": {"$in": expanded_list}}}
        ]
    
    if type and type != 'all':
        # Support both old 'gender' field and new 'type' field
        type_query = {"$or": [{"type": type}, {"gender": type}]}
        if "$and" in query:
            query["$and"].append(type_query)
        elif "$or" in query:
            query = {"$and": [{"$or": query["$or"]}, type_query]}
        else:
            query.update(type_query)
    
    if search:
        search_query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]}
        if "$and" in query:
            query["$and"].append(search_query)
        elif "$or" in query:
            query = {"$and": [{"$or": query["$or"]}, search_query]}
        else:
            query["$or"] = search_query["$or"]
    
    if is_active is not None:
        if "$and" in query:
            query["$and"].append({"is_active": is_active})
        else:
            query["is_active"] = is_active
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    
    # Get list of shops with active subscriptions (unless include_expired_shops is True)
    active_shop_ids = set()
    if not include_expired_shops:
        now = datetime.now(timezone.utc).isoformat()
        active_shops = await db.shops.find({
            "status": "approved",
            "$or": [
                {"subscription_status": {"$in": ["active", "trial"]}},
                {"shop_id": None}  # Admin products (no shop)
            ]
        }, {"_id": 0, "id": 1, "subscription_status": 1, "subscription_end": 1}).to_list(1000)
        
        for shop in active_shops:
            # Check if subscription is not expired
            sub_end = shop.get("subscription_end")
            if shop.get("subscription_status") in ["active", "trial"]:
                if sub_end:
                    if sub_end >= now:
                        active_shop_ids.add(shop["id"])
                else:
                    active_shop_ids.add(shop["id"])
    
    # Build a map of shop_id -> commission_rate for per-shop tier commission
    all_shop_ids_in_products = list(set(p.get("shop_id") for p in products if p.get("shop_id")))
    shop_commission_rates = {}
    shop_commission_types = {}
    for sid in all_shop_ids_in_products:
        info = await get_shop_commission_info(sid)
        shop_commission_rates[sid] = info["rate"]
        shop_commission_types[sid] = info["type"]
    default_commission_rate = await get_commission_rate()
    
    filtered_products = []
    for prod in products:
        if isinstance(prod.get('created_at'), str):
            prod['created_at'] = datetime.fromisoformat(prod['created_at'])
        
        # Apply commission to prices for customer view - use per-shop tier rate
        shop_id = prod.get("shop_id")
        commission_rate = shop_commission_rates.get(shop_id, default_commission_rate) if shop_id else default_commission_rate
        commission_type = shop_commission_types.get(shop_id, "on_customer") if shop_id else "on_customer"
        prod = apply_commission_to_product(prod, commission_rate, commission_type)
        
        price = prod.get('discount_price') or prod.get('price')
        if min_price is not None and price < min_price:
            continue
        if max_price is not None and price > max_price:
            continue
        
        # Calculate discount percentage for filtering
        original_price = prod.get('price', 0)
        discounted_price = prod.get('discount_price')
        if discounted_price and original_price > 0:
            discount_pct = int(((original_price - discounted_price) / original_price) * 100)
        else:
            discount_pct = 0
        
        if min_discount is not None and discount_pct < min_discount:
            continue
        if max_discount is not None and discount_pct > max_discount:
            continue
        
        # Filter out products from shops with expired subscriptions
        shop_id = prod.get('shop_id')
        if not include_expired_shops and shop_id:
            if shop_id not in active_shop_ids:
                continue
        
        filtered_products.append(prod)
    
    # Sort: Verified + Pro shop products get higher priority
    pro_shop_ids = set()
    verified_shop_ids = set()
    ranking_shops = await db.shops.find({"status": "approved"}, {"_id": 0, "id": 1, "tier": 1, "is_verified": 1}).to_list(500)
    for s in ranking_shops:
        if s.get("tier") == "pro":
            pro_shop_ids.add(s["id"])
        if s.get("is_verified"):
            verified_shop_ids.add(s["id"])
    
    # Add shop_name to products
    shop_ids = list(set(p.get("shop_id") for p in filtered_products if p.get("shop_id")))
    shop_names = {}
    if shop_ids:
        shops_data = await db.shops.find({"id": {"$in": shop_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        shop_names = {s["id"]: s["name"] for s in shops_data}
    
    # Check which products have gifts
    product_ids_in_list = [p["id"] for p in filtered_products]
    gift_docs = await db.product_gifts.find(
        {"product_id": {"$in": product_ids_in_list}, "is_active": True}, {"_id": 0, "product_id": 1}
    ).to_list(1000)
    gifted_product_ids = {g["product_id"] for g in gift_docs}
    
    for prod in filtered_products:
        if prod.get("shop_id") and prod["shop_id"] in shop_names:
            prod["shop_name"] = shop_names[prod["shop_id"]]
        prod["has_free_gift"] = prod["id"] in gifted_product_ids

    # Apply variant + stock + gift filters AFTER shop_name/has_free_gift enrichment
    color_list = [c.strip().lower() for c in colors.split(',') if c.strip()] if colors else []
    size_list = [s.strip().lower() for s in sizes.split(',') if s.strip()] if sizes else []
    shape_list = [s.strip().lower() for s in shapes.split(',') if s.strip()] if shapes else []

    def matches_variants(p):
        if color_list:
            prod_colors = [(c.get('color_name') or '').lower() for c in (p.get('colors') or [])]
            if not any(c in prod_colors for c in color_list):
                return False
        if size_list:
            prod_sizes = [(s.get('size_name') or '').lower() for s in (p.get('sizes') or [])]
            if not any(s in prod_sizes for s in size_list):
                return False
        if shape_list:
            prod_shapes = [(s.get('shape_name') or '').lower() for s in (p.get('shapes') or [])]
            if not any(s in prod_shapes for s in shape_list):
                return False
        return True

    if color_list or size_list or shape_list:
        filtered_products = [p for p in filtered_products if matches_variants(p)]

    if in_stock_only:
        filtered_products = [p for p in filtered_products if (p.get('stock', 0) or 0) > 0]

    if has_gift:
        filtered_products = [p for p in filtered_products if p.get('has_free_gift')]
    
    # Sort based on sort_by parameter, or use default (verified/pro/newest)
    if sort_by == 'newest':
        filtered_products.sort(key=lambda p: p.get("created_at", "") if isinstance(p.get("created_at"), str) else (p.get("created_at").isoformat() if isinstance(p.get("created_at"), datetime) else ""), reverse=True)
    elif sort_by == 'price_asc':
        filtered_products.sort(key=lambda p: p.get("discount_price") or p.get("price", 0))
    elif sort_by == 'price_desc':
        filtered_products.sort(key=lambda p: p.get("discount_price") or p.get("price", 0), reverse=True)
    elif sort_by == 'name_asc':
        filtered_products.sort(key=lambda p: (p.get("name") or "").lower())
    elif sort_by in ('popular', 'trending'):
        _rank_products(filtered_products, verified_shop_ids, pro_shop_ids, 'popular')
    elif sort_by == 'discount':
        def get_discount_pct(p):
            if p.get("discount_price") and p["discount_price"] < p.get("price", 0):
                return round(((p["price"] - p["discount_price"]) / p["price"]) * 100)
            return 0
        filtered_products.sort(key=get_discount_pct, reverse=True)
    else:
        # Recommended (default): strong composite score — popularity + quality + freshness
        # + deal depth + shop trust + availability. Replaces the old verified/pro/newest-only order.
        _rank_products(filtered_products, verified_shop_ids, pro_shop_ids, 'recommended')
    
    # If pagination requested, return paginated response
    if page is not None and limit is not None:
        total = len(filtered_products)
        start = (page - 1) * limit
        end = start + limit
        paginated = filtered_products[start:end]
        return {"products": paginated, "total": total, "page": page, "limit": limit, "has_more": end < total}
    
    return filtered_products


@router.get("/products/variant-summary")
async def get_variant_summary(
    category_ids: Optional[str] = None,
    type: Optional[str] = None,
    shop_id: Optional[str] = None,
):
    """Return aggregated variant options (colors, sizes, shapes) across active products.
    Used to populate creative variant filter UI.
    """
    query = {"is_active": True}
    if shop_id:
        query["shop_id"] = shop_id

    if type and type != 'all':
        query["$or"] = [{"type": type}, {"gender": type}]

    if category_ids:
        cat_list = [c.strip() for c in category_ids.split(',') if c.strip()]
        all_cats = await db.categories.find({}, {"_id": 0, "id": 1, "parent_id": 1}).to_list(1000)
        expanded = set(cat_list)
        def add_descendants(parent_id):
            for c in all_cats:
                if c.get("parent_id") == parent_id:
                    expanded.add(c["id"])
                    add_descendants(c["id"])
        for cid in cat_list:
            add_descendants(cid)
        expanded_list = list(expanded)
        cat_filter = {"$or": [
            {"category_id": {"$in": expanded_list}},
            {"category_ids": {"$elemMatch": {"$in": expanded_list}}}
        ]}
        if "$or" in query:
            existing_or = query.pop("$or")
            query["$and"] = [{"$or": existing_or}, cat_filter]
        else:
            query.update(cat_filter)

    products = await db.products.find(query, {"_id": 0, "colors": 1, "sizes": 1, "shapes": 1}).to_list(2000)

    # Aggregate colors with hex code occurrences  
    color_map = {}
    size_map = {}
    shape_map = {}

    for p in products:
        for c in (p.get('colors') or []):
            name = (c.get('color_name') or '').strip()
            if not name:
                continue
            key = name.lower()
            if key not in color_map:
                color_map[key] = {
                    "name": name,
                    "color_code": c.get('color_code') or "#CCCCCC",
                    "count": 0
                }
            color_map[key]["count"] += 1

        for s in (p.get('sizes') or []):
            name = (s.get('size_name') or '').strip()
            if not name:
                continue
            key = name.lower()
            if key not in size_map:
                size_map[key] = {"name": name, "count": 0}
            size_map[key]["count"] += 1

        for s in (p.get('shapes') or []):
            name = (s.get('shape_name') or '').strip()
            if not name:
                continue
            key = name.lower()
            if key not in shape_map:
                shape_map[key] = {"name": name, "count": 0}
            shape_map[key]["count"] += 1

    # Standard size ordering for clothing
    size_order = ['xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', 'xxl', '3xl', 'xxxl', '4xl']

    def size_sort_key(item):
        nm = item.get('name', '').lower()
        if nm in size_order:
            return (0, size_order.index(nm))
        # Numeric sizes like 38, 40, 42
        try:
            return (1, float(nm))
        except ValueError:
            return (2, nm)

    colors_list = sorted(color_map.values(), key=lambda x: (-x['count'], x['name'].lower()))
    sizes_list = sorted(size_map.values(), key=size_sort_key)
    shapes_list = sorted(shape_map.values(), key=lambda x: (-x['count'], x['name'].lower()))

    return {
        "colors": colors_list,
        "sizes": sizes_list,
        "shapes": shapes_list,
        "total_products": len(products)
    }

@router.get("/products/with-gifts")
async def get_products_with_gifts():
    """Get products that have free gifts attached (for homepage section)"""
    gifts = await db.product_gifts.find({"is_active": True}, {"_id": 0}).to_list(50)
    gift_product_ids = [g["product_id"] for g in gifts]
    if not gift_product_ids:
        return {"products": []}
    
    products = await db.products.find({"id": {"$in": gift_product_ids}, "is_active": True}, {"_id": 0}).to_list(50)
    
    # Apply commission
    for prod in products:
        shop_id = prod.get("shop_id")
        info = await get_shop_commission_info(shop_id) if shop_id else {"rate": await get_commission_rate(), "type": "on_customer"}
        prod_with_commission = apply_commission_to_product(prod, info["rate"], info["type"])
        prod.update(prod_with_commission)
        prod["has_free_gift"] = True
        if isinstance(prod.get('created_at'), str):
            try:
                prod['created_at'] = datetime.fromisoformat(prod['created_at'])
            except:
                pass
    
    # Add shop names
    shop_ids = list(set(p.get("shop_id") for p in products if p.get("shop_id")))
    if shop_ids:
        shops_data = await db.shops.find({"id": {"$in": shop_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(50)
        shop_names = {s["id"]: s["name"] for s in shops_data}
        for p in products:
            if p.get("shop_id") in shop_names:
                p["shop_name"] = shop_names[p["shop_id"]]
    
    return {"products": products}


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    
    # Apply commission to prices for customer view - use per-shop tier rate
    shop_id = product.get("shop_id")
    info = await get_shop_commission_info(shop_id) if shop_id else {"rate": await get_commission_rate(), "type": "on_customer"}
    product = apply_commission_to_product(product, info["rate"], info["type"])
    
    # Add shop name
    if shop_id:
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "name": 1})
        if shop:
            product["shop_name"] = shop.get("name", "")
    
    # Check for gift
    gift = await db.product_gifts.find_one({"product_id": product_id, "is_active": True}, {"_id": 0})
    product["has_free_gift"] = gift is not None
    
    return product


@router.post("/products", response_model=Product)
async def create_product(product: ProductCreate, admin: Dict = Depends(require_admin)):
    product_data = product.model_dump()
    
    # Handle shop_id from admin - look up shop name
    if product_data.get('shop_id'):
        shop = await db.shops.find_one({"id": product_data['shop_id']}, {"_id": 0, "name": 1})
        if shop:
            product_data['shop_name'] = shop.get('name')
    
    # Handle category_ids - if not provided but category_id is, add it to category_ids
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
        if doc.get('type_variant_image'): vi.append(doc['type_variant_image'])
        for s in (doc.get('sizes') or []): 
            if s.get('image_url'): vi.append(s['image_url'])
        for t in (doc.get('types') or []):
            if t.get('image_url'): vi.append(t['image_url'])
        if vi: doc['images'] = list(dict.fromkeys(vi))
    await db.products.insert_one(doc)
    
    # If product belongs to a shop with an active sale, apply the sale discount
    if doc.get('shop_id'):
        now = datetime.now(timezone.utc).isoformat()
        active_sale = await db.shop_sales.find_one(
            {"shop_id": doc['shop_id'], "is_active": True, "end_date": {"$gt": now}},
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
                await db.shop_sales.update_one(
                    {"id": active_sale["id"]},
                    {"$set": {f"original_prices.{doc['id']}": {
                        "price": doc.get("price", 0),
                        "discount_price": doc.get("discount_price"),
                    }}}
                )
    
    # Re-read to include sale fields in response
    final_doc = await db.products.find_one({"id": doc["id"]}, {"_id": 0})
    if final_doc:
        if isinstance(final_doc.get('created_at'), str):
            final_doc['created_at'] = datetime.fromisoformat(final_doc['created_at'])
        return final_doc
    return prod


@router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product: ProductCreate, admin: Dict = Depends(require_admin)):
    product_data = product.model_dump()
    
    # Handle shop_id from admin - look up shop name
    if product_data.get('shop_id'):
        shop = await db.shops.find_one({"id": product_data['shop_id']}, {"_id": 0, "name": 1})
        if shop:
            product_data['shop_name'] = shop.get('name')
    
    # Handle category_ids - if not provided but category_id is, add it to category_ids
    if not product_data.get('category_ids') and product_data.get('category_id'):
        product_data['category_ids'] = [product_data['category_id']]
    elif product_data.get('category_ids') and not product_data.get('category_id'):
        product_data['category_id'] = product_data['category_ids'][0] if product_data['category_ids'] else None
    
    # Set defaults for variant fields
    for field in ['colors', 'sizes', 'shapes', 'types', 'category_ids']:
        if product_data.get(field) is None:
            product_data[field] = []
    
    result = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": product_data},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(result.get('created_at'), str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    return result


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin: Dict = Depends(require_admin)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}


@router.get("/products/{product_id}/reviews")
async def get_product_reviews(product_id: str):
    """Get all reviews for a product"""
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).to_list(1000)
    
    # Calculate average rating
    total_rating = sum(r.get("rating", 0) for r in reviews)
    avg_rating = total_rating / len(reviews) if reviews else 0
    
    # Rating distribution
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in reviews:
        rating = r.get("rating", 0)
        if 1 <= rating <= 5:
            distribution[rating] += 1
    
    # Sort reviews by date (newest first)
    reviews.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {
        "reviews": reviews,
        "total_reviews": len(reviews),
        "average_rating": round(avg_rating, 1),
        "distribution": distribution
    }


@router.post("/products/{product_id}/reviews")
async def create_product_review(product_id: str, review_data: ProductReviewCreate, user: Dict = Depends(require_auth)):
    """Create a new review for a product (requires login)"""
    # Check if product exists
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Prevent shops from reviewing their own products
    if product.get("shop_id"):
        owning_shop = await db.shops.find_one({"id": product.get("shop_id")}, {"_id": 0, "user_id": 1})
        if owning_shop and owning_shop.get("user_id") == user["user_id"]:
            raise HTTPException(status_code=403, detail="Shops cannot rate their own products")
    
    # Validate rating
    if not 1 <= review_data.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Check if user already reviewed this product
    existing_review = await db.reviews.find_one({"product_id": product_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this product")
    
    # Get user info
    user_data = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    
    # Check if user purchased this product (verified purchase)
    user_orders = await db.orders.find({
        "user_id": user["user_id"],
        "payment_status": "paid",
        "items.product_id": product_id
    }, {"_id": 0}).to_list(100)
    is_verified = len(user_orders) > 0
    
    review = {
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "user_id": user["user_id"],
        "user_name": user_data.get("name", "Anonymous") if user_data else "Anonymous",
        "user_email": user_data.get("email") if user_data else None,
        "rating": review_data.rating,
        "title": review_data.title,
        "comment": review_data.comment,
        "is_verified_purchase": is_verified,
        "helpful_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Make a copy before insert (MongoDB mutates the dict and adds _id)
    review_copy = review.copy()
    await db.reviews.insert_one(review_copy)
    
    # Update product's average rating
    all_reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0, "rating": 1}).to_list(1000)
    avg_rating = sum(r.get("rating", 0) for r in all_reviews) / len(all_reviews) if all_reviews else 0
    await db.products.update_one({"id": product_id}, {"$set": {"average_rating": round(avg_rating, 1), "review_count": len(all_reviews)}})
    
    return {**review, "message": "Review submitted successfully"}


@router.put("/reviews/{review_id}/helpful")
async def mark_review_helpful(review_id: str, user: Optional[Dict] = Depends(get_current_user)):
    """Mark a review as helpful"""
    result = await db.reviews.find_one_and_update(
        {"id": review_id},
        {"$inc": {"helpful_count": 1}},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"message": "Review marked as helpful", "helpful_count": result.get("helpful_count")}


@router.delete("/reviews/{review_id}")
async def delete_review(review_id: str, user: Dict = Depends(require_auth)):
    """Delete a review (owner or admin)"""
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Only allow owner or admin to delete
    if user["role"] != "admin" and review.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this review")
    
    await db.reviews.delete_one({"id": review_id})
    
    # Update product's average rating
    product_id = review.get("product_id")
    all_reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0, "rating": 1}).to_list(1000)
    if all_reviews:
        avg_rating = sum(r.get("rating", 0) for r in all_reviews) / len(all_reviews)
        await db.products.update_one({"id": product_id}, {"$set": {"average_rating": round(avg_rating, 1), "review_count": len(all_reviews)}})
    else:
        await db.products.update_one({"id": product_id}, {"$set": {"average_rating": 0, "review_count": 0}})
    
    return {"message": "Review deleted"}


@router.get("/shops/{shop_id}/products")
async def get_shop_public_products(shop_id: str):
    """Get shop's products (public) with commission applied, boosted products first"""
    shop = await db.shops.find_one({"id": shop_id, "status": "approved"})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    products = await db.products.find(
        {"shop_id": shop_id, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    info = await get_shop_commission_info(shop_id)
    result = [apply_commission_to_product(p, info["rate"], info["type"]) for p in products]
    
    # Mark and sort boosted products first
    now = datetime.now(timezone.utc).isoformat()
    boosted_ids = set()
    active_promos = await db.promotions.find(
        {"shop_id": shop_id, "status": "active", "start_date": {"$lte": now}, "end_date": {"$gt": now}},
        {"_id": 0, "product_id": 1}
    ).to_list(100)
    boosted_ids = {p["product_id"] for p in active_promos}
    
    for p in result:
        p["is_shop_boosted"] = p["id"] in boosted_ids
    
    # Sort: boosted first, then by created_at
    result.sort(key=lambda p: (0 if p.get("is_shop_boosted") else 1, p.get("created_at", "")))
    
    return result
