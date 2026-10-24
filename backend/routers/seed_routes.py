"""
OpenMarket Lebanon - Seed Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
import uuid, bcrypt, hashlib, random, os, asyncio, shutil, json
from pathlib import Path

from config import db, logger, UPLOADS_DIR, STRIPE_SECRET_KEY, ROOT_DIR, JWT_SECRET, JWT_ALGORITHM, client, SMTP_USER, SMTP_PASS, ENABLE_SEED_ROUTES
from auth import create_token, verify_token, get_current_user, require_auth, require_admin, require_shop, require_delivery, require_shop_or_admin, security
from models import *
from services.helpers import create_notification, get_commission_rate, get_shop_commission_info, get_customer_markup_factor, get_shop_revenue_factor, auto_credit_bonus_events

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


async def require_seed_enabled():
    """Guard: seed/bootstrap endpoints are destructive and disclose setup state. They are only
    reachable when ENABLE_SEED_ROUTES is explicitly set (never in a normal production deploy).
    When disabled we 404 so the endpoints are indistinguishable from non-existent."""
    if not ENABLE_SEED_ROUTES:
        raise HTTPException(status_code=404, detail="Not Found")
    return True


@router.post("/seed-public", dependencies=[Depends(require_seed_enabled)])
async def seed_public():
    """One-time bootstrap of the first admin + sample data (guarded by ENABLE_SEED_ROUTES)."""
    from routers.admin_routes import seed_full_data
    # Refuse to touch an already-initialized platform — never overwrite live data from an
    # unauthenticated bootstrap route.
    admin = await db.users.find_one({"role": "admin"})
    if admin:
        return {"status": "skipped", "message": "Platform already initialized (an admin exists). Seeding is disabled."}

    # The initial admin password is chosen by the operator via env — no hardcoded/known default,
    # and it is never returned in the response.
    seed_admin_password = os.environ.get("SEED_ADMIN_PASSWORD")
    if not seed_admin_password:
        raise HTTPException(status_code=400, detail="Set SEED_ADMIN_PASSWORD to bootstrap the first admin.")
    seed_admin_email = os.environ.get("SEED_ADMIN_EMAIL", "admin@openmarket.com")

    hashed_pw = bcrypt.hashpw(seed_admin_password.encode(), bcrypt.gensalt()).decode()
    admin_user = {
        "id": "admin-main",
        "email": seed_admin_email,
        "password": hashed_pw,
        "name": "Admin",
        "role": "admin",
        "phone": "+96170000000",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_user)

    mock_admin = {"user_id": admin_user["id"], "email": admin_user["email"], "role": "admin"}
    result = await seed_full_data(admin=mock_admin)
    return {"status": "ok", "message": "Admin created and data seeded. Sign in with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.", "admin_email": seed_admin_email, "seed_result": result}


@router.post("/seed", dependencies=[Depends(require_seed_enabled)])
async def seed_data():
    """Seed the database with sample data (categories, users, shops, products)"""
    # Check if already seeded
    existing_admin = await db.users.find_one({"email": "admin@openmarketlb.com"})
    if existing_admin:
        return {"message": "Database already seeded", "status": "skipped"}

    # Admin password chosen by the operator via env — no hardcoded default, never returned below.
    seed_admin_password = os.environ.get("SEED_ADMIN_PASSWORD")
    if not seed_admin_password:
        raise HTTPException(status_code=400, detail="Set SEED_ADMIN_PASSWORD to seed the database.")

    # 1. Create admin user
    admin_password = bcrypt.hashpw(seed_admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": "admin@openmarketlb.com",
        "password": admin_password,
        "name": "Admin",
        "role": "admin",
        "phone": "+96170000000",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_user)
    
    # 2. Create categories
    categories = [
        {"id": str(uuid.uuid4()), "name": "Electronics", "slug": "electronics", "is_active": True, "parent_id": None, "order": 1},
        {"id": str(uuid.uuid4()), "name": "Fashion", "slug": "fashion", "is_active": True, "parent_id": None, "order": 2},
        {"id": str(uuid.uuid4()), "name": "Home & Living", "slug": "home-living", "is_active": True, "parent_id": None, "order": 3},
        {"id": str(uuid.uuid4()), "name": "Food & Drinks", "slug": "food-drinks", "is_active": True, "parent_id": None, "order": 4},
        {"id": str(uuid.uuid4()), "name": "Sports & Outdoors", "slug": "sports-outdoors", "is_active": True, "parent_id": None, "order": 5},
        {"id": str(uuid.uuid4()), "name": "Books & Stationery", "slug": "books-stationery", "is_active": True, "parent_id": None, "order": 6},
        {"id": str(uuid.uuid4()), "name": "Beauty & Health", "slug": "beauty-health", "is_active": True, "parent_id": None, "order": 7},
        {"id": str(uuid.uuid4()), "name": "Pets", "slug": "pets", "is_active": True, "parent_id": None, "order": 8},
    ]
    await db.categories.insert_many(categories)
    
    # 3. Create shop users and shops
    shop_data_list = [
        {"name": "TechZone Lebanon", "description": "Premium electronics and gadgets", "state": "Beirut", "lat": 33.8938, "lng": 35.5018, "address": "Hamra Street, Beirut",
         "banner": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=400&fit=crop",
         "logo": "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=200&h=200&fit=crop"},
        {"name": "Fashion Hub", "description": "Latest fashion trends and accessories", "state": "Jounieh", "lat": 33.9806, "lng": 35.6178, "address": "Jounieh Main Road",
         "banner": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop",
         "logo": "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=200&h=200&fit=crop"},
        {"name": "Home Comfort", "description": "Everything for your home", "state": "Tripoli", "lat": 34.4367, "lng": 35.8497, "address": "El Mina, Tripoli",
         "banner": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&h=400&fit=crop",
         "logo": "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=200&h=200&fit=crop"},
        {"name": "Gourmet Bites", "description": "Fine food and premium drinks", "state": "Byblos", "lat": 34.1236, "lng": 35.6511, "address": "Byblos Old Souk",
         "banner": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop",
         "logo": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop"},
        {"name": "SportsPro", "description": "Sports equipment and outdoor gear", "state": "Sidon", "lat": 33.5571, "lng": 35.3729, "address": "Saida Boulevard",
         "banner": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=400&fit=crop",
         "logo": "https://images.unsplash.com/photo-1461896836934-bd45ba8fcf9b?w=200&h=200&fit=crop"},
        {"name": "Beirut Books", "description": "Books, stationery and educational supplies for all ages", "state": "Beirut", "lat": 33.8869, "lng": 35.5131, "address": "Bliss Street, Beirut",
         "banner": "https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=1200&h=400&fit=crop",
         "logo": "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=200&h=200&fit=crop"},
        {"name": "Beauty Glow", "description": "Skincare, cosmetics and beauty essentials", "state": "Jounieh", "lat": 33.9750, "lng": 35.6200, "address": "Kaslik Avenue, Jounieh",
         "banner": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&h=400&fit=crop",
         "logo": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&h=200&fit=crop"},
        {"name": "Pet Paradise", "description": "Everything your pets need - food, toys, accessories", "state": "Beirut", "lat": 33.8900, "lng": 35.4950, "address": "Verdun, Beirut",
         "banner": "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1200&h=400&fit=crop",
         "logo": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop"},
    ]
    
    shop_user_password = bcrypt.hashpw("Shop123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    created_shops = []
    for idx, sd in enumerate(shop_data_list):
        user_id = str(uuid.uuid4())
        shop_id = str(uuid.uuid4())
        email = f"shop{idx+1}@openmarketlb.com"
        
        shop_user = {
            "id": user_id,
            "email": email,
            "password": shop_user_password,
            "name": sd["name"],
            "role": "shop",
            "shop_id": shop_id,
            "phone": f"+9617100000{idx}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(shop_user)
        
        shop_doc = {
            "id": shop_id,
            "user_id": user_id,
            "name": sd["name"],
            "description": sd["description"],
            "logo": sd.get("logo"),
            "banner": sd.get("banner"),
            "phone": f"+9617100000{idx}",
            "email": email,
            "address": sd["address"],
            "state": sd["state"],
            "status": "approved",
            "subscription_status": "active",
            "subscription_start": datetime.now(timezone.utc).isoformat(),
            "subscription_end": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
            "payment_method": "manual",
            "tier": "starter",
            "wallet_balance": 0,
            "latitude": sd["lat"],
            "longitude": sd["lng"],
            "location_address": sd["address"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.shops.insert_one(shop_doc)
        created_shops.append(shop_doc)
    
    # 4. Create regular user
    user_password = bcrypt.hashpw("User123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    regular_user = {
        "id": str(uuid.uuid4()),
        "email": "user@openmarketlb.com",
        "password": user_password,
        "name": "Test User",
        "role": "user",
        "phone": "+96170000001",
        "address": "Downtown Beirut",
        "city": "Beirut",
        "state": "Beirut",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(regular_user)
    
    # 5. Create products for each shop (with images and variants)
    product_samples = [
        # Electronics (TechZone Lebanon)
        [
            {"name": "Wireless Earbuds Pro", "price": 79.99, "discount_price": 59.99, "stock": 50,
             "images": [
                 "https://images.unsplash.com/photo-1598371611276-1bc503a270a4?w=600",
                 "https://images.unsplash.com/photo-1632835746204-22f652dac3af?w=600",
                 "https://images.unsplash.com/photo-1695634463848-4db4e47703a4?w=600"
             ],
             "colors": [
                 {"color_name": "Black", "price": 79.99, "discount_price": 59.99, "stock": 25, "image_url": "https://images.unsplash.com/photo-1598371611276-1bc503a270a4?w=600"},
                 {"color_name": "White", "price": 79.99, "discount_price": 64.99, "stock": 25, "image_url": "https://images.unsplash.com/photo-1632835746204-22f652dac3af?w=600"}
             ]},
            {"name": "Smart Watch X200", "price": 199.99, "discount_price": 149.99, "stock": 30,
             "images": [
                 "https://images.unsplash.com/photo-1719744755507-a4c856c57cf7?w=600",
                 "https://images.unsplash.com/photo-1719744755528-797de46cbbff?w=600",
                 "https://images.unsplash.com/photo-1758348844355-2ef28345979d?w=600"
             ],
             "sizes": [
                 {"size_name": "40mm", "price": 199.99, "discount_price": 149.99, "stock": 15},
                 {"size_name": "44mm", "price": 219.99, "discount_price": 169.99, "stock": 15}
             ]},
            {"name": "Portable Bluetooth Speaker", "price": 49.99, "stock": 100,
             "images": [
                 "https://images.unsplash.com/photo-1675319245480-215961c129f1?w=600",
                 "https://images.unsplash.com/photo-1643901102317-b430b45e4cce?w=600",
                 "https://images.unsplash.com/photo-1674303324806-7018a739ed11?w=600"
             ]},
        ],
        # Fashion (Fashion Hub)
        [
            {"name": "Classic Leather Jacket", "price": 150.0, "discount_price": 120.0, "stock": 25,
             "images": [
                 "https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?w=600",
                 "https://images.unsplash.com/photo-1636343720718-4b68635f94d6?w=600",
                 "https://images.unsplash.com/photo-1562751361-8839562e351b?w=600"
             ],
             "sizes": [
                 {"size_name": "S", "price": 150.0, "discount_price": 120.0, "stock": 8},
                 {"size_name": "M", "price": 150.0, "discount_price": 120.0, "stock": 10},
                 {"size_name": "L", "price": 155.0, "discount_price": 125.0, "stock": 7}
             ]},
            {"name": "Summer Dress Collection", "price": 65.0, "stock": 40,
             "images": [
                 "https://images.unsplash.com/photo-1602303894456-398ce544d90b?w=600",
                 "https://images.unsplash.com/photo-1602303832953-05d841ee21f7?w=600",
                 "https://images.unsplash.com/photo-1553120523-4f38df77dd02?w=600"
             ],
             "colors": [
                 {"color_name": "Floral Red", "price": 65.0, "stock": 20, "image_url": "https://images.unsplash.com/photo-1602303894456-398ce544d90b?w=600"},
                 {"color_name": "White", "price": 65.0, "stock": 20, "image_url": "https://images.unsplash.com/photo-1602303832953-05d841ee21f7?w=600"}
             ]},
            {"name": "Designer Sunglasses", "price": 89.99, "discount_price": 69.99, "stock": 60,
             "images": [
                 "https://images.unsplash.com/photo-1642792539381-b9d9a32f6e1b?w=600",
                 "https://images.unsplash.com/photo-1642792533153-4b03e4d93e09?w=600",
                 "https://images.unsplash.com/photo-1642792545243-1931577811a5?w=600"
             ]},
        ],
        # Home (Home Comfort)
        [
            {"name": "Luxury Bedsheet Set", "price": 120.0, "discount_price": 89.99, "stock": 35,
             "images": [
                 "https://images.unsplash.com/photo-1745613999710-1aaf60145502?w=600",
                 "https://images.unsplash.com/photo-1744000311897-510b64f9a2e2?w=600",
                 "https://images.unsplash.com/photo-1672350563389-6e568bcf8496?w=600"
             ],
             "colors": [
                 {"color_name": "Peach", "price": 120.0, "discount_price": 89.99, "stock": 18, "image_url": "https://images.unsplash.com/photo-1745613999710-1aaf60145502?w=600"},
                 {"color_name": "Brown", "price": 120.0, "discount_price": 89.99, "stock": 17, "image_url": "https://images.unsplash.com/photo-1672350563389-6e568bcf8496?w=600"}
             ]},
            {"name": "Scented Candle Collection", "price": 35.0, "stock": 80,
             "images": [
                 "https://images.unsplash.com/photo-1712148272589-b1e99437a7a0?w=600",
                 "https://images.unsplash.com/photo-1712148273523-f2eb850f7fc2?w=600"
             ]},
            {"name": "Modern Table Lamp", "price": 55.0, "discount_price": 42.0, "stock": 45,
             "images": [
                 "https://images.unsplash.com/photo-1756474215831-4e5f8309c6bc?w=600",
                 "https://images.unsplash.com/photo-1756474215958-f0c2a31eddc1?w=600"
             ]},
        ],
        # Food (Gourmet Bites)
        [
            {"name": "Premium Coffee Beans 1kg", "price": 25.0, "stock": 100,
             "images": [
                 "https://images.unsplash.com/photo-1776829669906-e33c550bb0a0?w=600",
                 "https://images.unsplash.com/photo-1777372429254-9afbf72b2427?w=600"
             ]},
            {"name": "Lebanese Olive Oil", "price": 18.0, "discount_price": 14.99, "stock": 60,
             "images": [
                 "https://images.unsplash.com/photo-1765850257647-811b8d3c20ca?w=600"
             ]},
            {"name": "Gourmet Chocolate Box", "price": 40.0, "stock": 50,
             "images": [
                 "https://images.unsplash.com/photo-1767510533183-425731f088a7?w=600",
                 "https://images.unsplash.com/photo-1773516035245-26f07b76c114?w=600"
             ]},
        ],
        # Sports (SportsPro)
        [
            {"name": "Yoga Mat Premium", "price": 45.0, "discount_price": 35.0, "stock": 70,
             "images": [
                 "https://images.unsplash.com/photo-1746796751590-a8c0f15d4900?w=600",
                 "https://images.unsplash.com/photo-1620862161205-ad45a124805b?w=600"
             ],
             "colors": [
                 {"color_name": "Purple", "price": 45.0, "discount_price": 35.0, "stock": 35, "image_url": "https://images.unsplash.com/photo-1746796751590-a8c0f15d4900?w=600"},
                 {"color_name": "Blue", "price": 45.0, "discount_price": 35.0, "stock": 35, "image_url": "https://images.unsplash.com/photo-1620862161205-ad45a124805b?w=600"}
             ]},
            {"name": "Resistance Bands Set", "price": 30.0, "stock": 90,
             "images": [
                 "https://images.unsplash.com/photo-1584827386916-b5351d3ba34b?w=600",
                 "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600"
             ]},
            {"name": "Running Shoes Ultra", "price": 120.0, "discount_price": 99.99, "stock": 40,
             "images": [
                 "https://images.unsplash.com/photo-1765914448113-ebf0ce8cb918?w=600",
                 "https://images.unsplash.com/photo-1765914448163-da25d773a87d?w=600"
             ],
             "sizes": [
                 {"size_name": "US 8", "price": 120.0, "discount_price": 99.99, "stock": 10},
                 {"size_name": "US 9", "price": 120.0, "discount_price": 99.99, "stock": 15},
                 {"size_name": "US 10", "price": 120.0, "discount_price": 99.99, "stock": 10},
                 {"size_name": "US 11", "price": 125.0, "discount_price": 104.99, "stock": 5}
             ]},
        ],
        # Books & Stationery (Beirut Books)
        [
            {"name": "Arabic Literature Collection", "price": 35.0, "discount_price": 28.0, "stock": 60,
             "images": [
                 "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600",
                 "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600"
             ]},
            {"name": "Premium Notebook Set", "price": 22.0, "stock": 120,
             "images": [
                 "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600",
                 "https://images.unsplash.com/photo-1517842645767-c639042777db?w=600"
             ],
             "colors": [
                 {"color_name": "Black", "price": 22.0, "stock": 60, "image_url": "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600"},
                 {"color_name": "Brown", "price": 22.0, "stock": 60, "image_url": "https://images.unsplash.com/photo-1517842645767-c639042777db?w=600"}
             ]},
            {"name": "Art Supply Kit", "price": 55.0, "discount_price": 42.0, "stock": 45,
             "images": [
                 "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600",
                 "https://images.unsplash.com/photo-1452860606245-08f6e3ef2783?w=600"
             ]},
        ],
        # Beauty & Health (Beauty Glow)
        [
            {"name": "Luxury Skincare Set", "price": 89.0, "discount_price": 69.0, "stock": 40, "type": "women",
             "images": [
                 "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600",
                 "https://images.unsplash.com/photo-1570194065650-d99fb4d8a609?w=600"
             ]},
            {"name": "Natural Hair Oil", "price": 28.0, "stock": 80,
             "images": [
                 "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600",
                 "https://images.unsplash.com/photo-1599305090598-fe179d501227?w=600"
             ]},
            {"name": "Men's Grooming Kit", "price": 65.0, "discount_price": 49.99, "stock": 55, "type": "men",
             "images": [
                 "https://images.unsplash.com/photo-1621607505837-91e2cf6b3903?w=600",
                 "https://images.unsplash.com/photo-1585751119414-ef2636f8aede?w=600"
             ]},
        ],
        # Pets (Pet Paradise)
        [
            {"name": "Premium Dog Food 5kg", "price": 32.0, "discount_price": 26.99, "stock": 90,
             "images": [
                 "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600",
                 "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=600"
             ]},
            {"name": "Cat Tower Deluxe", "price": 75.0, "stock": 30,
             "images": [
                 "https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=600",
                 "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=600"
             ]},
            {"name": "Pet Toy Bundle", "price": 18.0, "discount_price": 14.0, "stock": 150,
             "images": [
                 "https://images.unsplash.com/photo-1535294435445-d7249524ef2e?w=600",
                 "https://images.unsplash.com/photo-1623387641168-d9803ddd3f35?w=600"
             ]},
        ],
    ]
    
    for shop_idx, shop in enumerate(created_shops):
        cat_id = categories[shop_idx]["id"]
        for prod in product_samples[shop_idx]:
            product_doc = {
                "id": str(uuid.uuid4()),
                "shop_id": shop["id"],
                "category_id": cat_id,
                "name": prod["name"],
                "description": f"High quality {prod['name'].lower()} from {shop['name']}",
                "price": prod["price"],
                "discount_price": prod.get("discount_price"),
                "stock": prod["stock"],
                "images": prod.get("images", []),
                "type": "unisex",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "sold_count": random.randint(5, 100),
                "view_count": random.randint(20, 500),
            }
            # Add color variants
            if "colors" in prod:
                product_doc["colors"] = prod["colors"]
                product_doc["has_color_variants"] = True
            # Add size variants
            if "sizes" in prod:
                product_doc["sizes"] = prod["sizes"]
                product_doc["has_size_variants"] = True
            await db.products.insert_one(product_doc)
    
    # 6. Create states for delivery fees
    states = [
        {"id": str(uuid.uuid4()), "name": "Beirut", "delivery_fee": 3.0, "is_active": True},
        {"id": str(uuid.uuid4()), "name": "Mount Lebanon", "delivery_fee": 4.0, "is_active": True},
        {"id": str(uuid.uuid4()), "name": "North Lebanon", "delivery_fee": 5.0, "is_active": True},
        {"id": str(uuid.uuid4()), "name": "South Lebanon", "delivery_fee": 5.0, "is_active": True},
        {"id": str(uuid.uuid4()), "name": "Bekaa", "delivery_fee": 6.0, "is_active": True},
    ]
    await db.states.insert_many(states)
    
    # 7. Set platform settings with logo and promotions enabled
    platform_settings = {
        "id": "platform",
        "subscription_price": 29.0,
        "trial_days": 7,
        "commission_enabled": True,
        "commission_percentage": 10.0,
        "logo_url": "/api/uploads/logo.png",
        "platform_name": "OpenMarket.lb",
        "loyalty_enabled": True,
        "promotion_enabled": True,
        "promotion_daily_price": 2.0,
        "promotion_max_slots_per_page": 10,
    }
    await db.platform_settings.update_one({"id": "platform"}, {"$set": platform_settings}, upsert=True)
    
    # 7.5 Create home banner carousel slides (admin_events with display_mode == "home_banner")
    banner_now = datetime.now(timezone.utc)
    home_banners = [
        {
            "id": str(uuid.uuid4()),
            "title": "Next-Gen Tech, Delivered",
            "banner_subtitle": "Wireless audio, smart watches & more — handpicked electronics at the best prices.",
            "image_url": "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&h=600&fit=crop",
            "cta_text": "Shop Electronics",
            "cta_link": "",
            "display_mode": "home_banner",
            "banner_accent_color": "from-indigo-600 via-blue-600 to-cyan-500",
            "banner_text_color": "#ffffff",
            "banner_order": 1,
            "filter_category_id": categories[0]["id"],
            "filter_category_ids": [categories[0]["id"]],
            "is_active": True,
            "start_date": "",
            "end_date": "",
            "created_at": banner_now.isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Fashion That Speaks",
            "banner_subtitle": "Fresh seasonal looks for men, women & kids — discover your next favorite fit.",
            "image_url": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&h=600&fit=crop",
            "cta_text": "Explore Fashion",
            "cta_link": "",
            "display_mode": "home_banner",
            "banner_accent_color": "from-rose-500 via-pink-500 to-fuchsia-600",
            "banner_text_color": "#ffffff",
            "banner_order": 2,
            "filter_category_id": categories[1]["id"],
            "filter_category_ids": [categories[1]["id"]],
            "is_active": True,
            "start_date": "",
            "end_date": "",
            "created_at": banner_now.isoformat(),
        },
        {
            # No image → showcases the pure-gradient (color) banner look
            "id": str(uuid.uuid4()),
            "title": "Make Your Home Glow",
            "banner_subtitle": "Cozy bedding, warm lighting & decor to refresh every corner of your space.",
            "image_url": "",
            "cta_text": "Shop Home & Living",
            "cta_link": "",
            "display_mode": "home_banner",
            "banner_accent_color": "from-amber-500 via-orange-500 to-rose-500",
            "banner_text_color": "#ffffff",
            "banner_order": 3,
            "filter_category_id": categories[2]["id"],
            "filter_category_ids": [categories[2]["id"]],
            "is_active": True,
            "start_date": "",
            "end_date": "",
            "created_at": banner_now.isoformat(),
        },
    ]
    await db.admin_events.insert_many(home_banners)
    
    # 8. Create sponsored/promoted products (pick 6 products)
    all_products = await db.products.find({}, {"_id": 0, "id": 1, "shop_id": 1}).to_list(20)
    now = datetime.now(timezone.utc)
    sponsored_products = all_products[:6] if len(all_products) >= 6 else all_products
    for sp in sponsored_products:
        promo_doc = {
            "id": str(uuid.uuid4()),
            "product_id": sp["id"],
            "shop_id": sp["shop_id"],
            "status": "active",
            "days": 30,
            "daily_price": 2.0,
            "total_cost": 60.0,
            "start_date": now.isoformat(),
            "end_date": (now + timedelta(days=30)).isoformat(),
            "created_at": now.isoformat()
        }
        await db.promotions.insert_one(promo_doc)
    
    # NOTE: credentials are intentionally NOT returned. The admin password is the operator-supplied
    # SEED_ADMIN_PASSWORD; sample shop/user accounts use fixed demo passwords documented separately.
    return {
        "message": "Database seeded successfully",
        "status": "success",
        "data": {
            "admin_email": "admin@openmarketlb.com",
            "shops_created": len(shop_data_list),
            "categories": len(categories),
            "products": sum(len(p) for p in product_samples),
            "states": len(states),
            "home_banners": len(home_banners)
        }
    }



@router.post("/seed-sponsored", dependencies=[Depends(require_seed_enabled)])
async def seed_more_sponsored():
    """Create MORE sponsored/promoted products so sponsored rows are well populated."""
    # Ensure promotions are enabled
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": {"promotion_enabled": True}},
        upsert=True,
    )

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Find products that do NOT already have an active promotion
    active_promos = await db.promotions.find(
        {"status": "active", "end_date": {"$gt": now_iso}}, {"_id": 0, "product_id": 1}
    ).to_list(1000)
    promoted_ids = {p["product_id"] for p in active_promos}

    # Pull a diverse set of active products across shops
    products = await db.products.find(
        {"is_active": True}, {"_id": 0, "id": 1, "shop_id": 1, "shop_name": 1, "name": 1, "category_id": 1}
    ).to_list(500)

    candidates = [p for p in products if p["id"] not in promoted_ids]
    random.shuffle(candidates)
    target = candidates[:18]  # add up to 18 more sponsored products

    added = 0
    for sp in target:
        days = random.choice([7, 10, 14, 30])
        promo_doc = {
            "id": str(uuid.uuid4()),
            "product_id": sp["id"],
            "shop_id": sp.get("shop_id"),
            "shop_name": sp.get("shop_name", ""),
            "product_name": sp.get("name", ""),
            "status": "active",
            "duration_days": days,
            "daily_price": 2.0,
            "total_cost": round(2.0 * days, 2),
            "payment_method": "seed",
            "is_free": False,
            "views": random.randint(20, 400),
            "orders": random.randint(0, 25),
            "start_date": now_iso,
            "end_date": (now + timedelta(days=days)).isoformat(),
            "created_at": now_iso,
        }
        await db.promotions.insert_one(promo_doc)
        await db.products.update_one(
            {"id": sp["id"]},
            {"$set": {"is_promoted": True, "promotion_end": promo_doc["end_date"]}},
        )
        added += 1

    total_active = await db.promotions.count_documents(
        {"status": "active", "end_date": {"$gt": now_iso}}
    )

    # --- Seed seasonal home-banner events with sponsorship enabled ---
    seasonal = [
        {"title": "Black Friday Hub", "banner_subtitle": "Biggest deals of the year — up to 70% off",
         "banner_accent_color": "linear-gradient(135deg,#0f172a,#7c3aed)", "sponsorship_price": 50.0,
         "image_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=70"},
        {"title": "Ramadan Sale", "banner_subtitle": "Special Ramadan offers for the whole family",
         "banner_accent_color": "linear-gradient(135deg,#065f46,#10b981)", "sponsorship_price": 35.0,
         "image_url": "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=1200&q=70"},
        {"title": "Summer Festival", "banner_subtitle": "Fresh arrivals & seasonal must-haves",
         "banner_accent_color": "linear-gradient(135deg,#b45309,#f59e0b)", "sponsorship_price": 25.0,
         "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=70"},
    ]
    events_added = 0
    for idx, ev in enumerate(seasonal):
        exists = await db.admin_events.find_one({"title": ev["title"], "display_mode": "home_banner"})
        if exists:
            await db.admin_events.update_one(
                {"id": exists["id"]},
                {"$set": {"sponsorship_enabled": True, "sponsorship_price": ev["sponsorship_price"], "is_active": True}},
            )
            continue
        await db.admin_events.insert_one({
            "id": str(uuid.uuid4()),
            "title": ev["title"], "description": ev["banner_subtitle"],
            "image_url": ev["image_url"], "cta_text": "Shop the event", "cta_link": "/products",
            "display_mode": "home_banner", "popup_color": "",
            "filter_category_id": "", "filter_category_ids": [], "filter_gender": "",
            "filter_search": "", "filter_discount_only": False,
            "filter_min_price": None, "filter_max_price": None, "filter_shop_id": "",
            "banner_subtitle": ev["banner_subtitle"], "banner_accent_color": ev["banner_accent_color"],
            "banner_text_color": "#ffffff", "banner_order": idx,
            "sponsorship_enabled": True, "sponsorship_price": ev["sponsorship_price"], "sponsoring_shops": [],
            "start_date": "", "end_date": "", "is_active": True,
            "created_at": now_iso,
        })
        events_added += 1

    return {
        "message": "More sponsored products & seasonal events added",
        "status": "success",
        "added": added,
        "total_active_sponsored": total_active,
        "events_added": events_added,
    }



@router.post("/seed-extra", dependencies=[Depends(require_seed_enabled)])
async def seed_extra_data():
    """Add additional seed data - more products per shop, more diverse products, sub-categories."""
    summary = {"added_products": 0, "added_subcategories": 0, "added_users": 0}

    # 1. Add sub-categories under each main category
    categories = await db.categories.find({"parent_id": None}, {"_id": 0}).to_list(200)
    cat_by_name = {c["name"]: c for c in categories}

    sub_cat_map = {
        "Electronics": [
            ("Phones", "phones"),
            ("Laptops", "laptops"),
            ("Headphones", "headphones"),
            ("Smart Watches", "smart-watches"),
            ("Tablets", "tablets"),
        ],
        "Fashion": [
            ("Men's Clothing", "mens-clothing"),
            ("Women's Clothing", "womens-clothing"),
            ("Kids' Clothing", "kids-clothing"),
            ("Shoes", "shoes"),
            ("Accessories", "accessories"),
        ],
        "Home & Living": [
            ("Furniture", "furniture"),
            ("Kitchen", "kitchen"),
            ("Decor", "decor"),
            ("Bedding", "bedding"),
        ],
        "Food & Drinks": [
            ("Coffee & Tea", "coffee-tea"),
            ("Snacks", "snacks"),
            ("Beverages", "beverages"),
            ("Olive Oil", "olive-oil"),
        ],
        "Sports & Outdoors": [
            ("Fitness", "fitness"),
            ("Outdoor Gear", "outdoor-gear"),
            ("Footwear", "sports-footwear"),
        ],
        "Books & Stationery": [
            ("Fiction", "fiction"),
            ("Notebooks", "notebooks"),
            ("Art Supplies", "art-supplies"),
        ],
        "Beauty & Health": [
            ("Skincare", "skincare"),
            ("Hair Care", "hair-care"),
            ("Men's Grooming", "mens-grooming"),
        ],
        "Pets": [
            ("Dog Supplies", "dog-supplies"),
            ("Cat Supplies", "cat-supplies"),
            ("Pet Food", "pet-food"),
        ],
    }
    sub_cats_created = {}
    for parent_name, subs in sub_cat_map.items():
        parent = cat_by_name.get(parent_name)
        if not parent:
            continue
        for idx, (sub_name, sub_slug) in enumerate(subs):
            existing = await db.categories.find_one({"name": sub_name, "parent_id": parent["id"]})
            if existing:
                sub_cats_created[sub_name] = existing
                continue
            sub_doc = {
                "id": str(uuid.uuid4()),
                "name": sub_name,
                "slug": sub_slug,
                "is_active": True,
                "parent_id": parent["id"],
                "order": idx + 1,
            }
            await db.categories.insert_one(sub_doc)
            sub_cats_created[sub_name] = sub_doc
            summary["added_subcategories"] += 1

    # 2. Add more products to existing shops + new diverse products
    shops = await db.shops.find({"status": "approved"}, {"_id": 0}).to_list(200)
    shop_by_state = {}
    for s in shops:
        shop_by_state.setdefault(s.get("state", ""), []).append(s)

    # 16+ extra products spread across shops by category type
    extra_products = [
        # Electronics
        {"name": "Gaming Mouse RGB", "shop_name": "TechZone Lebanon", "category": "Electronics", "type": "men",
         "price": 45.0, "discount_price": 35.0, "stock": 75,
         "images": ["https://images.unsplash.com/photo-1527814050087-3793815479db?w=600",
                    "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600"]},
        {"name": "Mechanical Keyboard", "shop_name": "TechZone Lebanon", "category": "Electronics", "type": "unisex",
         "price": 89.99, "discount_price": 69.99, "stock": 40,
         "images": ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600",
                    "https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=600"]},
        {"name": "Wireless Charger Pad", "shop_name": "TechZone Lebanon", "category": "Electronics", "type": "unisex",
         "price": 29.99, "stock": 120,
         "images": ["https://images.unsplash.com/photo-1593344484962-796055d4a3a4?w=600"]},
        {"name": "4K Action Camera", "shop_name": "TechZone Lebanon", "category": "Electronics", "type": "men",
         "price": 189.99, "discount_price": 149.99, "stock": 25,
         "images": ["https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600"]},
        # Fashion
        {"name": "Denim Jacket Premium", "shop_name": "Fashion Hub", "category": "Fashion", "type": "men",
         "price": 95.0, "discount_price": 75.0, "stock": 35,
         "images": ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600",
                    "https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=600"],
         "sizes": [{"size_name": "M", "price": 95.0, "discount_price": 75.0, "stock": 12},
                   {"size_name": "L", "price": 95.0, "discount_price": 75.0, "stock": 13},
                   {"size_name": "XL", "price": 99.0, "discount_price": 79.0, "stock": 10}]},
        {"name": "Floral Maxi Dress", "shop_name": "Fashion Hub", "category": "Fashion", "type": "women",
         "price": 78.0, "discount_price": 58.0, "stock": 55,
         "images": ["https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600",
                    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600"]},
        {"name": "Kids' Sneakers", "shop_name": "Fashion Hub", "category": "Fashion", "type": "kids",
         "price": 35.0, "discount_price": 25.0, "stock": 65,
         "images": ["https://images.unsplash.com/photo-1503944168849-8bf86e58cc4e?w=600"]},
        {"name": "Leather Belt Set", "shop_name": "Fashion Hub", "category": "Fashion", "type": "men",
         "price": 28.0, "stock": 80,
         "images": ["https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=600"]},
        # Home
        {"name": "Coffee Table Modern", "shop_name": "Home Comfort", "category": "Home & Living", "type": "unisex",
         "price": 220.0, "discount_price": 175.0, "stock": 12,
         "images": ["https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600",
                    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600"]},
        {"name": "Wall Mirror Decorative", "shop_name": "Home Comfort", "category": "Home & Living", "type": "unisex",
         "price": 65.0, "stock": 28,
         "images": ["https://images.unsplash.com/photo-1618220179428-22790b461013?w=600"]},
        {"name": "Throw Pillow Set", "shop_name": "Home Comfort", "category": "Home & Living", "type": "unisex",
         "price": 38.0, "discount_price": 28.0, "stock": 60,
         "images": ["https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600",
                    "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600"]},
        # Food
        {"name": "Specialty Tea Box", "shop_name": "Gourmet Bites", "category": "Food & Drinks", "type": "unisex",
         "price": 22.0, "stock": 80,
         "images": ["https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600"]},
        {"name": "Lebanese Spice Set", "shop_name": "Gourmet Bites", "category": "Food & Drinks", "type": "unisex",
         "price": 32.0, "discount_price": 26.0, "stock": 70,
         "images": ["https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=600",
                    "https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=600"]},
        # Sports
        {"name": "Dumbbell Set 20kg", "shop_name": "SportsPro", "category": "Sports & Outdoors", "type": "men",
         "price": 150.0, "discount_price": 120.0, "stock": 18,
         "images": ["https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=600",
                    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600"]},
        {"name": "Women's Yoga Set", "shop_name": "SportsPro", "category": "Sports & Outdoors", "type": "women",
         "price": 68.0, "discount_price": 52.0, "stock": 45,
         "images": ["https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600",
                    "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=600"]},
        {"name": "Kids' Soccer Ball", "shop_name": "SportsPro", "category": "Sports & Outdoors", "type": "kids",
         "price": 22.0, "stock": 100,
         "images": ["https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=600"]},
        # Beauty
        {"name": "Luxury Lipstick Collection", "shop_name": "Beauty Glow", "category": "Beauty & Health", "type": "women",
         "price": 45.0, "discount_price": 35.0, "stock": 70,
         "images": ["https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600",
                    "https://images.unsplash.com/photo-1586495985096-787929e0c1a4?w=600"]},
        {"name": "Anti-Aging Cream", "shop_name": "Beauty Glow", "category": "Beauty & Health", "type": "women",
         "price": 78.0, "stock": 50,
         "images": ["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600"]},
        {"name": "Beard Care Kit", "shop_name": "Beauty Glow", "category": "Beauty & Health", "type": "men",
         "price": 48.0, "discount_price": 38.0, "stock": 55,
         "images": ["https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=600"]},
        # Pets
        {"name": "Cat Food Premium 3kg", "shop_name": "Pet Paradise", "category": "Pets", "type": "unisex",
         "price": 28.0, "discount_price": 22.0, "stock": 80,
         "images": ["https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600"]},
        {"name": "Dog Leash & Collar Set", "shop_name": "Pet Paradise", "category": "Pets", "type": "unisex",
         "price": 24.0, "stock": 120,
         "images": ["https://images.unsplash.com/photo-1591946614720-90a587da4a36?w=600",
                    "https://images.unsplash.com/photo-1601758174039-3a3b30c98a48?w=600"]},
        {"name": "Aquarium Decor Set", "shop_name": "Pet Paradise", "category": "Pets", "type": "unisex",
         "price": 38.0, "discount_price": 28.0, "stock": 35,
         "images": ["https://images.unsplash.com/photo-1520637836862-4d197d17c93a?w=600"]},
        # Books
        {"name": "French Literature Bundle", "shop_name": "Beirut Books", "category": "Books & Stationery", "type": "unisex",
         "price": 42.0, "discount_price": 32.0, "stock": 45,
         "images": ["https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600",
                    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600"]},
        {"name": "Premium Pen Set", "shop_name": "Beirut Books", "category": "Books & Stationery", "type": "unisex",
         "price": 28.0, "stock": 90,
         "images": ["https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600"]},
    ]
    
    shop_by_name = {s["name"]: s for s in shops}
    cat_by_name_all = {c["name"]: c for c in categories}
    # Include subcategories in cat lookup
    for sn, sd in sub_cats_created.items():
        cat_by_name_all[sn] = sd
    
    for prod in extra_products:
        shop = shop_by_name.get(prod["shop_name"])
        if not shop:
            continue
        cat = cat_by_name_all.get(prod["category"])
        if not cat:
            continue
        # Check if product already exists
        existing = await db.products.find_one({"name": prod["name"], "shop_id": shop["id"]})
        if existing:
            continue
        product_doc = {
            "id": str(uuid.uuid4()),
            "shop_id": shop["id"],
            "shop_name": shop["name"],
            "category_id": cat["id"],
            "category_ids": [cat["id"]],
            "name": prod["name"],
            "description": f"High quality {prod['name'].lower()} from {shop['name']}",
            "price": prod["price"],
            "discount_price": prod.get("discount_price"),
            "stock": prod["stock"],
            "images": prod.get("images", []),
            "type": prod.get("type", "unisex"),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "sold_count": random.randint(5, 100),
            "view_count": random.randint(50, 800),
        }
        if "sizes" in prod:
            product_doc["sizes"] = prod["sizes"]
            product_doc["has_size_variants"] = True
        if "colors" in prod:
            product_doc["colors"] = prod["colors"]
            product_doc["has_color_variants"] = True
        await db.products.insert_one(product_doc)
        summary["added_products"] += 1

    # 3. Add a few sample regular users
    sample_users = [
        {"email": "ahmad@openmarketlb.com", "name": "Ahmad Khalil", "phone": "+96170111222", "state": "Beirut"},
        {"email": "sara@openmarketlb.com", "name": "Sara Younes", "phone": "+96170222333", "state": "Mount Lebanon"},
        {"email": "michel@openmarketlb.com", "name": "Michel Aoun", "phone": "+96170333444", "state": "North Lebanon"},
    ]
    pw = bcrypt.hashpw("User123!".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    for u in sample_users:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            continue
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": u["email"],
            "password": pw,
            "name": u["name"],
            "role": "user",
            "phone": u["phone"],
            "state": u["state"],
            "city": u["state"],
            "address": f"Sample Street, {u['state']}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        summary["added_users"] += 1

    return {
        "message": "Extra seed data added",
        "status": "success",
        "data": summary,
    }
