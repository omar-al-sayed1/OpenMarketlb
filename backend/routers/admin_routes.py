"""
OpenMarket Lebanon - Admin Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
import uuid
import bcrypt
import hashlib
import random
import os
import asyncio
import shutil
import json
from pathlib import Path

from config import db, logger, UPLOADS_DIR, STRIPE_SECRET_KEY, ROOT_DIR, JWT_SECRET, JWT_ALGORITHM, client, SMTP_USER, SMTP_PASS
from auth import create_token, verify_token, get_current_user, require_auth, require_admin, require_admin_strict, require_shop, require_delivery, require_shop_or_admin, security, DEFAULT_AGENT_PAGES, DEFAULT_EMPLOYEE_PAGES, is_agent, is_employee, require_employee, require_agent
from models import *
from services.helpers import calc_redemption_value, calc_tier, create_notification, get_commission_rate, get_customer_markup_factor, get_default_loyalty_settings, get_loyalty_settings, get_recipient_name, get_shop_commission_info, get_shop_revenue_factor, get_welcome_bonus, seed_storefront_themes

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


def _ps_amount(entry: Dict) -> float:
    """Signed amount for a platform_services ledger entry.

    Most entries are revenue (direction == "credit") and add to profit. Some are
    money paid OUT by admin (direction == "debit", e.g. admin wallet top-ups for a
    shop) and must REDUCE Platform Services / profit. Amounts are stored positive,
    so debits are negated here. This makes Platform Services able to go negative.
    """
    amt = entry.get("amount", 0) or 0
    return -amt if entry.get("direction") == "debit" else amt


@router.get("/admin/orders/{order_id}/details")
async def get_order_details_admin(order_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Get detailed order view with shop addresses"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    # Get shop details with addresses
    shops_info = []
    for shop_id in order.get("shop_ids", []):
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
        if shop:
            # Get items from this shop in the order
            shop_items = [item for item in order.get("items", []) if item.get("shop_id") == shop_id]
            shops_info.append({
                "shop_id": shop_id,
                "shop_name": shop.get("name"),
                "shop_address": shop.get("address"),
                "shop_state": shop.get("state"),
                "shop_phone": shop.get("phone"),
                "shop_email": shop.get("email"),
                "shop_latitude": shop.get("latitude"),
                "shop_longitude": shop.get("longitude"),
                "items_count": len(shop_items),
                "items_subtotal": sum(item.get("subtotal", 0) for item in shop_items)
            })
    
    # Delivery info
    delivery_info = {
        "from_shops": shops_info,
        "to_customer": {
            "name": order.get("customer_name") or order.get("guest_name"),
            "email": order.get("customer_email") or order.get("guest_email"),
            "phone": order.get("customer_phone") or order.get("user_phone") or order.get("guest_phone"),
            "address": order.get("shipping_address", {}).get("address") if isinstance(order.get("shipping_address"), dict) else order.get("shipping_address", ""),
            "city": order.get("shipping_address", {}).get("city") if isinstance(order.get("shipping_address"), dict) else order.get("shipping_city", ""),
            "state": order.get("shipping_address", {}).get("state") if isinstance(order.get("shipping_address"), dict) else order.get("shipping_state", ""),
            "zip": order.get("shipping_address", {}).get("zip") if isinstance(order.get("shipping_address"), dict) else order.get("shipping_zip", ""),
            "location": order.get("customer_location")
        }
    }
    
    return {
        **order,
        "delivery_info": delivery_info,
        "agent_breakdown": await _agent_breakdown_for_order(order),
    }


async def _agent_breakdown_for_order(order: Dict) -> Dict:
    """Helper that returns the referral-agent commission breakdown for an order."""
    try:
        from services.referral_helpers import get_order_agent_breakdown
        return await get_order_agent_breakdown(order)
    except Exception as _e:
        logger.error(f"agent_breakdown error: {_e}")
        return {"has_agent": False, "entries": []}


@router.get("/admin/analytics")
async def get_analytics(admin: Dict = Depends(require_admin)):
    total_orders = await db.orders.count_documents({})
    
    paid_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(10000)
    total_revenue = sum(order["total_amount"] for order in paid_orders)
    
    pending_orders = await db.orders.find({"order_status": "pending"}, {"_id": 0}).to_list(100)
    for order in pending_orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    revenue_by_category = {}
    
    # Only show root categories (level 1 / no parent)
    root_categories = [c for c in categories if not c.get("parent_id") and (c.get("level", 1) == 1)]
    
    # Build a map of all child category IDs for each root category
    def get_descendant_ids(parent_id, all_cats):
        ids = []
        for c in all_cats:
            if c.get("parent_id") == parent_id:
                ids.append(c["id"])
                ids.extend(get_descendant_ids(c["id"], all_cats))
        return ids
    
    for category in root_categories:
        # Get all descendant category IDs (including self)
        all_cat_ids = [category["id"]] + get_descendant_ids(category["id"], categories)
        
        category_products = await db.products.find(
            {"$or": [{"category_id": {"$in": all_cat_ids}}, {"category_ids": {"$in": all_cat_ids}}]},
            {"_id": 0, "id": 1}
        ).to_list(10000)
        product_ids = [p["id"] for p in category_products]
        
        category_revenue = 0
        for order in paid_orders:
            for item in order.get("items", []):
                if item["product_id"] in product_ids:
                    category_revenue += item.get("original_subtotal", item.get("subtotal", 0))
        
        if category_revenue > 0:
            revenue_by_category[category["name"]] = category_revenue
    
    from collections import defaultdict
    monthly_revenue = defaultdict(lambda: {"total": 0, "by_category": defaultdict(float)})
    
    for order in paid_orders:
        order_date = order.get('created_at')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date)
        
        month_key = order_date.strftime("%Y-%m")
        monthly_revenue[month_key]["total"] += order["total_amount"]
        
        for item in order.get("items", []):
            for category in categories:
                category_products = await db.products.find({"category_id": category["id"]}, {"_id": 0}).to_list(1000)
                product_ids = [p["id"] for p in category_products]
                
                if item["product_id"] in product_ids:
                    monthly_revenue[month_key]["by_category"][category["name"]] += item["subtotal"]
                    break
    
    monthly_revenue_formatted = {
        month: {
            "total": data["total"],
            "by_category": dict(data["by_category"])
        }
        for month, data in sorted(monthly_revenue.items(), reverse=True)
    }
    
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    low_stock_products = [p for p in products if p["stock"] < 5]
    
    guest_orders = await db.orders.count_documents({"user_id": None})
    user_orders = total_orders - guest_orders
    
    card_payments = await db.orders.count_documents({"payment_method": "card"})
    cod_payments = await db.orders.count_documents({"payment_method": "cod"})
    
    return {
        "total_orders": total_orders,
        "total_revenue": 0 if is_agent(admin) else total_revenue,
        "total_users": await db.users.count_documents({"role": "user"}),
        "total_products": await db.products.count_documents({}),
        "pending_orders": pending_orders,
        "revenue_by_category": {} if is_agent(admin) else revenue_by_category,
        "monthly_revenue": {} if is_agent(admin) else monthly_revenue_formatted,
        "low_stock_count": len(low_stock_products),
        "guest_orders": guest_orders,
        "user_orders": user_orders,
        "card_payments": card_payments,
        "cod_payments": cod_payments,
        "low_stock_products": low_stock_products,
        "is_agent": is_agent(admin),
    }


@router.get("/admin/users")
async def get_all_users(admin: Dict = Depends(require_admin), role: Optional[str] = None):
    """Admin: Get all users. Optional filter by role (user, shop, admin, delivery, agent)"""
    query = {}
    if role:
        query["role"] = role
    
    # Agents should not see admin users
    if is_agent(admin):
        if role == "admin":
            return []
        if not role:
            query["role"] = {"$ne": "admin"}
    
    users = await db.users.find(query, {"_id": 0, "password": 0}).to_list(10000)
    
    # Compute online status + messaging block status
    now = datetime.now(timezone.utc)
    blocks = await db.messaging_blocks.find({}, {"_id": 0}).to_list(None)
    blocked_customers = {b["entity_id"] for b in blocks if b.get("entity_type") == "customer"}
    blocked_shops = {b["entity_id"] for b in blocks if b.get("entity_type") == "shop"}

    # Enrich shop users with shop info
    for user in users:
        last_seen = user.get("last_seen")
        is_online = False
        if last_seen:
            try:
                ls = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
                if ls.tzinfo is None:
                    ls = ls.replace(tzinfo=timezone.utc)
                is_online = (now - ls).total_seconds() <= 120  # online within 2 minutes
            except Exception:
                is_online = False
        user["is_online"] = is_online
        # Messaging block flag (customers keyed by user id; shops by shop id)
        if user.get("role") == "shop" and user.get("shop_id"):
            user["messaging_blocked"] = user["shop_id"] in blocked_shops
        else:
            user["messaging_blocked"] = user.get("id") in blocked_customers

        if user.get("role") == "shop" and user.get("shop_id"):
            shop = await db.shops.find_one({"id": user["shop_id"]}, {"_id": 0, "name": 1, "status": 1, "subscription_status": 1})
            if shop:
                user["shop_name"] = shop.get("name")
                user["shop_status"] = shop.get("status")
                user["subscription_status"] = shop.get("subscription_status")
    
    return users


# ============= ADMIN MESSAGING OVERSIGHT =============
@router.get("/admin/conversations")
async def admin_get_all_conversations(admin: Dict = Depends(require_admin)):
    """Admin: View ALL conversations across the platform (oversight)."""
    messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(20000)

    conversations = {}
    for msg in messages:
        conv_id = msg.get("conversation_id")
        if not conv_id:
            continue
        if conv_id not in conversations:
            conversations[conv_id] = {
                "conversation_id": conv_id,
                "party_a": {"id": msg.get("sender_id"), "name": msg.get("sender_name", "Unknown"), "type": msg.get("sender_type")},
                "party_b": {"id": msg.get("recipient_id"), "name": msg.get("recipient_name", "Unknown"), "type": msg.get("recipient_type")},
                "last_message": msg.get("message") or {"image": "📷 Photo", "document": "📎 Document", "product": "🛍️ Product"}.get(msg.get("attachment_type"), ""),
                "last_message_time": msg.get("created_at"),
                "subject": msg.get("subject"),
                "message_count": 0,
                "unread_count": 0,
            }
        conversations[conv_id]["message_count"] += 1
        if not msg.get("is_read", False):
            conversations[conv_id]["unread_count"] += 1

    convs = list(conversations.values())
    convs.sort(key=lambda c: c.get("last_message_time") or "", reverse=True)
    return {"conversations": convs, "total": len(convs)}


@router.get("/admin/conversations/{conversation_id}")
async def admin_get_conversation_messages(conversation_id: str, admin: Dict = Depends(require_admin)):
    """Admin: View all messages in a specific conversation (read-only oversight, does not mark read)."""
    messages = await db.messages.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(5000)
    return {"messages": messages}


@router.get("/admin/messaging/blocks")
async def admin_get_messaging_blocks(admin: Dict = Depends(require_admin)):
    """Admin: List all messaging blocks."""
    blocks = await db.messaging_blocks.find({}, {"_id": 0}).sort("blocked_at", -1).to_list(None)
    return {"blocks": blocks}


@router.post("/admin/messaging/block")
async def admin_block_messaging(req: MessagingBlockRequest, admin: Dict = Depends(require_admin)):
    """Admin: Block a customer or shop from messaging."""
    entity_type = "customer" if req.entity_type in ("customer", "user") else req.entity_type
    if entity_type not in ("customer", "shop"):
        raise HTTPException(status_code=400, detail="entity_type must be 'customer' or 'shop'")
    existing = await db.messaging_blocks.find_one({"entity_type": entity_type, "entity_id": req.entity_id})
    if existing:
        return {"success": True, "already_blocked": True}
    # Resolve a friendly name
    name = await get_recipient_name(req.entity_id, entity_type)
    await db.messaging_blocks.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": entity_type,
        "entity_id": req.entity_id,
        "entity_name": name,
        "blocked_by": admin.get("id") or admin.get("user_id"),
        "blocked_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True}


@router.post("/admin/messaging/unblock")
async def admin_unblock_messaging(req: MessagingBlockRequest, admin: Dict = Depends(require_admin)):
    """Admin: Unblock a customer or shop from messaging."""
    entity_type = "customer" if req.entity_type in ("customer", "user") else req.entity_type
    await db.messaging_blocks.delete_many({"entity_type": entity_type, "entity_id": req.entity_id})
    return {"success": True}



@router.post("/admin/users")
async def create_user_admin(user_data: UserCreate, admin: Dict = Depends(require_admin)):
    """Admin: Create a new user (admin, user, or delivery)"""
    # Check if email exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if user_data.role not in ["user", "admin", "delivery"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be user, admin, or delivery")
    
    hashed_password = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt()).decode()
    # Build name from first/last or use provided name
    full_name = user_data.name
    if user_data.first_name or user_data.last_name:
        full_name = f"{user_data.first_name or ''} {user_data.last_name or ''}".strip()
    user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hashed_password,
        "name": full_name or "",
        "first_name": user_data.first_name or "",
        "last_name": user_data.last_name or "",
        "role": user_data.role,
        "phone": user_data.phone,
        "phone_verified": user_data.phone_verified or False,
        "address": user_data.address,
        "city": user_data.city,
        "state": user_data.state,
        "zip": user_data.zip,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    logger.info(f"Admin {admin['email']} created {user_data.role} user: {user_data.email}")
    
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "message": f"{user_data.role.capitalize()} user created successfully"
    }


@router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Edit a user's details"""
    body = await request.json()
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {}
    allowed_fields = ["name", "first_name", "last_name", "email", "phone", "city", "state", "address", "zip", "role", "phone_verified"]
    for field in allowed_fields:
        if field in body and body[field] is not None:
            update_fields[field] = body[field]
    
    # Auto-derive combined name if only first/last provided
    if ("first_name" in body or "last_name" in body) and "name" not in body:
        fn = (body.get("first_name") or "").strip()
        ln = (body.get("last_name") or "").strip()
        combined = f"{fn} {ln}".strip()
        if combined:
            update_fields["name"] = combined
    
    # Validate role if being changed
    if "role" in update_fields:
        valid_roles = ["user", "admin", "delivery", "shop"]
        if update_fields["role"] not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
        
        # If changing away from shop role, clear shop_id
        if user.get("role") == "shop" and update_fields["role"] != "shop":
            update_fields["shop_id"] = None
    
    # If email changed, check uniqueness
    if "email" in update_fields and update_fields["email"] != user.get("email"):
        existing = await db.users.find_one({"email": update_fields["email"], "id": {"$ne": user_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use by another user")
    
    # If password provided, hash it
    if body.get("password") and body["password"].strip():
        update_fields["password"] = bcrypt.hashpw(body["password"].encode(), bcrypt.gensalt()).decode()
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.users.update_one({"id": user_id}, {"$set": update_fields})
    logger.info(f"Admin {admin['email']} updated user {user.get('email')}: {list(update_fields.keys())}")
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Delete a user account"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin users")
    
    # Delete user's cart and wishlist
    await db.carts.delete_many({"user_id": user_id})
    await db.wishlists.delete_many({"user_id": user_id})
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    logger.info(f"Admin {admin['email']} deleted user {user.get('email')}")
    return {"message": f"User {user.get('email')} deleted successfully"}


# ============================================================
# EMPLOYEE MANAGEMENT (Admin only) — formerly "Agent"
# ============================================================
@router.get("/admin/employees")
async def list_employees(admin: Dict = Depends(require_admin_strict)):
    """Admin: List all employees (internal staff with admin page access)"""
    employees = await db.users.find({"role": "employee"}, {"_id": 0, "password": 0}).to_list(1000)
    for e in employees:
        if "allowed_pages" not in e or e.get("allowed_pages") is None:
            e["allowed_pages"] = DEFAULT_EMPLOYEE_PAGES
    return employees


@router.get("/admin/employees/available-pages")
async def list_available_employee_pages(admin: Dict = Depends(require_admin_strict)):
    """Admin: Return list of pages an employee can be granted access to"""
    return {
        "pages": [
            {"key": "dashboard", "label": "Dashboard"},
            {"key": "shops", "label": "Shops"},
            {"key": "map", "label": "Map"},
            {"key": "products", "label": "Products"},
            {"key": "orders", "label": "Orders"},
            {"key": "cancel_requests", "label": "Cancel Requests"},
            {"key": "shops_verifications", "label": "Shops Verifications"},
            {"key": "shop_sales", "label": "Shop Sales"},
            {"key": "categories", "label": "Categories"},
            {"key": "users", "label": "Users"},
            {"key": "contact_form", "label": "Contact Form"},
            {"key": "promotions", "label": "Promotions"},
            {"key": "gallery", "label": "Gallery"},
        ],
        "defaults": DEFAULT_EMPLOYEE_PAGES,
    }


@router.post("/admin/employees")
async def create_employee(data: EmployeeCreate, admin: Dict = Depends(require_admin_strict)):
    """Admin: Create a new employee user (internal staff)"""
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    full_name = f"{data.first_name} {data.last_name}".strip()
    hashed_password = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    
    allowed_pages = data.allowed_pages if data.allowed_pages is not None else list(DEFAULT_EMPLOYEE_PAGES)
    
    employee_doc = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "password": hashed_password,
        "name": full_name,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "role": "employee",
        "phone": data.phone,
        "address": data.address,
        "state": data.state,
        "allowed_pages": allowed_pages,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(employee_doc)
    logger.info(f"Admin {admin['email']} created employee: {data.email}")
    out = await db.users.find_one({"id": employee_doc["id"]}, {"_id": 0, "password": 0})
    return out


@router.put("/admin/employees/{employee_id}")
async def update_employee(employee_id: str, data: EmployeeUpdate, admin: Dict = Depends(require_admin_strict)):
    """Admin: Update an employee"""
    employee = await db.users.find_one({"id": employee_id, "role": "employee"}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_fields = {}
    if data.first_name is not None:
        update_fields["first_name"] = data.first_name
    if data.last_name is not None:
        update_fields["last_name"] = data.last_name
    if data.first_name is not None or data.last_name is not None:
        fn = data.first_name if data.first_name is not None else employee.get("first_name", "")
        ln = data.last_name if data.last_name is not None else employee.get("last_name", "")
        update_fields["name"] = f"{fn} {ln}".strip()
    if data.email is not None and data.email != employee.get("email"):
        ex = await db.users.find_one({"email": data.email, "id": {"$ne": employee_id}}, {"_id": 0})
        if ex:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = data.email
    if data.phone is not None:
        update_fields["phone"] = data.phone
    if data.address is not None:
        update_fields["address"] = data.address
    if data.state is not None:
        update_fields["state"] = data.state
    if data.allowed_pages is not None:
        update_fields["allowed_pages"] = data.allowed_pages
    if data.password and data.password.strip():
        update_fields["password"] = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.users.update_one({"id": employee_id}, {"$set": update_fields})
    updated = await db.users.find_one({"id": employee_id}, {"_id": 0, "password": 0})
    return updated


@router.delete("/admin/employees/{employee_id}")
async def delete_employee(employee_id: str, admin: Dict = Depends(require_admin_strict)):
    """Admin: Delete an employee"""
    employee = await db.users.find_one({"id": employee_id, "role": "employee"}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.users.delete_one({"id": employee_id})
    logger.info(f"Admin {admin['email']} deleted employee {employee.get('email')}")
    return {"message": f"Employee {employee.get('email')} deleted successfully"}


@router.put("/admin/employees/{employee_id}/pages")
async def set_employee_pages(employee_id: str, request: Request, admin: Dict = Depends(require_admin_strict)):
    """Admin: Set the allowed pages for an employee"""
    body = await request.json()
    pages = body.get("allowed_pages")
    if not isinstance(pages, list):
        raise HTTPException(status_code=400, detail="allowed_pages must be a list")
    
    employee = await db.users.find_one({"id": employee_id, "role": "employee"}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    await db.users.update_one({"id": employee_id}, {"$set": {"allowed_pages": pages}})
    updated = await db.users.find_one({"id": employee_id}, {"_id": 0, "password": 0})
    return updated


# ============================================================
# EMPLOYEE SELF: get my profile (allowed_pages etc.)
# ============================================================
@router.get("/employee/me")
async def get_employee_self(user: Dict = Depends(require_auth)):
    """Employee: Get current employee info including allowed_pages"""
    if user.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Employee only")
    employee = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "password": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if "allowed_pages" not in employee or employee.get("allowed_pages") is None:
        employee["allowed_pages"] = DEFAULT_EMPLOYEE_PAGES
    return employee


# ===== (Removed legacy /agent/me — that path now serves Referral Agents via referral_routes.py) =====


# ============================================================
# ADMIN GALLERY: aggregate all shops' galleries
# ============================================================
@router.get("/admin/gallery/all")
async def admin_get_all_gallery(admin: Dict = Depends(require_admin)):
    """Admin/Agent: List all shops with their gallery photos. Photos lacking 'status' default to 'pending'."""
    shops = await db.shops.find({}, {"_id": 0, "id": 1, "name": 1, "logo": 1, "banner": 1, "status": 1, "gallery": 1}).to_list(10000)
    result = []
    total_photos = 0
    counts = {"approved": 0, "pending": 0, "suspended": 0}
    for s in shops:
        gallery = s.get("gallery", []) or []
        if not gallery:
            continue
        normalized = []
        needs_save = False
        for p in gallery:
            np = dict(p)
            if not np.get("status"):
                np["status"] = "pending"
                needs_save = True
            normalized.append(np)
            counts[np["status"]] = counts.get(np["status"], 0) + 1
        if needs_save:
            try:
                await db.shops.update_one({"id": s["id"]}, {"$set": {"gallery": normalized}})
            except Exception:
                pass
        result.append({
            "shop_id": s["id"],
            "shop_name": s.get("name"),
            "shop_logo": s.get("logo"),
            "shop_status": s.get("status", "pending"),
            "gallery": normalized,
            "photo_count": len(normalized),
        })
        total_photos += len(normalized)
    # Sort by photo_count desc
    result.sort(key=lambda x: x["photo_count"], reverse=True)
    return {
        "shops": result,
        "total_shops": len(result),
        "total_photos": total_photos,
        "approved_count": counts.get("approved", 0),
        "pending_count": counts.get("pending", 0),
        "suspended_count": counts.get("suspended", 0),
    }


@router.put("/admin/gallery/{shop_id}/{photo_id}/status")
async def admin_set_gallery_photo_status(shop_id: str, photo_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin/Agent: Set status (approved/pending/suspended) on a specific gallery photo"""
    body = await request.json()
    new_status = (body.get("status") or "").strip().lower()
    if new_status not in ("approved", "pending", "suspended"):
        raise HTTPException(status_code=400, detail="status must be approved, pending, or suspended")
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    gallery = shop.get("gallery", []) or []
    updated = False
    for p in gallery:
        if p.get("id") == photo_id:
            p["status"] = new_status
            updated = True
            break
    if not updated:
        raise HTTPException(status_code=404, detail="Photo not found")
    await db.shops.update_one({"id": shop_id}, {"$set": {"gallery": gallery}})
    return {"message": f"Photo status set to {new_status}", "shop_id": shop_id, "photo_id": photo_id, "status": new_status}


@router.delete("/admin/gallery/{shop_id}/{photo_id}")
async def admin_delete_gallery_photo(shop_id: str, photo_id: str, admin: Dict = Depends(require_admin)):
    """Admin/Agent: Delete a single photo from any shop's gallery"""
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    gallery = shop.get("gallery", []) or []
    new_gallery = [p for p in gallery if p.get("id") != photo_id]
    if len(new_gallery) == len(gallery):
        raise HTTPException(status_code=404, detail="Photo not found")
    await db.shops.update_one({"id": shop_id}, {"$set": {"gallery": new_gallery}})
    return {"message": "Photo deleted", "shop_id": shop_id, "gallery": new_gallery}


@router.put("/admin/profile")
async def update_admin_profile(profile_data: AdminProfileUpdate, admin: Dict = Depends(require_admin_strict)):
    user_data = await db.users.find_one({"id": admin["user_id"]}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {}
    
    if profile_data.email:
        existing = await db.users.find_one({"email": profile_data.email, "id": {"$ne": admin["user_id"]}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = profile_data.email
    
    if profile_data.new_password:
        if not profile_data.old_password:
            raise HTTPException(status_code=400, detail="Old password required")
        
        if not bcrypt.checkpw(profile_data.old_password.encode(), user_data["password"].encode()):
            raise HTTPException(status_code=400, detail="Incorrect old password")
        
        hashed_password = bcrypt.hashpw(profile_data.new_password.encode(), bcrypt.gensalt()).decode()
        update_fields["password"] = hashed_password
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.users.update_one({"id": admin["user_id"]}, {"$set": update_fields})
    
    result = await db.users.find_one({"id": admin["user_id"]}, {"_id": 0, "password": 0})
    return result


@router.get("/admin/contact-messages")
async def get_contact_messages(admin: Dict = Depends(require_admin)):
    messages = await db.contact_messages.find({}, {"_id": 0}).to_list(1000)
    for msg in messages:
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    return messages


@router.put("/admin/contact-messages/{message_id}/status")
async def update_message_status(message_id: str, status: str, admin: Dict = Depends(require_admin)):
    result = await db.contact_messages.find_one_and_update(
        {"id": message_id},
        {"$set": {"status": status}},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Message not found")
    return result


@router.put("/admin/settings")
async def update_site_settings(settings_data: SiteSettingsUpdate, admin: Dict = Depends(require_admin)):
    update_fields = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.site_settings.find_one_and_update(
        {"id": "site_settings"},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0},
        upsert=True
    )
    
    return result


@router.put("/admin/platform-settings")
async def update_platform_settings(
    request: Request,
    admin: Dict = Depends(require_admin_strict)
):
    """Admin: Update platform settings including tiers and promotions"""
    body = await request.json()
    update_fields = {}
    
    # Standard fields
    simple_fields = [
        "subscription_price", "trial_days", "commission_enabled", "commission_percentage",
        "card_subscription_enabled", "card_payment_enabled", "yearly_discount_percent",
        "logo_url", "subscription_sale_active", "subscription_sale_percentage",
        "subscription_sale_message", "subscription_sale_popup_enabled", "otp_verification_enabled",
        "promotion_enabled", "promotion_daily_price", "promotion_max_slots_per_page",
        "tiers",
        "sponsored_strategy", "sponsored_density",
        "sponsored_master_enabled", "sponsored_placement_products",
        "sponsored_placement_product_detail", "sponsored_placement_cart_checkout",
        "sponsored_placement_category_band", "sponsored_placement_shop_public",
        "dark_mode_enabled", "language_toggle_enabled",
        "event_popup_color",
        # New ads & welcome bonus settings
        "ads_enabled",
        "email_campaigns_enabled", "ppc_campaigns_enabled", "banner_campaigns_enabled",
        "email_price_per_email", "ppc_price_per_click", "ppc_min_wallet_to_start",
        "event_sponsorship_default_price",
        # Welcome bonus when approving a shop
        "shop_welcome_wallet_bonus", "shop_welcome_sponsor_count",
        # Shop cashback: % of order commission credited back to the shop's wallet
        "shop_cashback_percent",
        # 4 product variants global enable/disable toggles
        "variant_color_enabled", "variant_size_enabled", "variant_shape_enabled", "variant_type_enabled",
        # Delivery availability toggle - when OFF, delivery section is hidden in checkout/shop order page
        "available_delivery",
        # Social media links shown in the public footer
        "instagram_url", "facebook_url",
        # Brand colors — theme the web + mobile apps at runtime
        "primary_color", "secondary_color",
    ]
    
    for field in simple_fields:
        if field in body:
            update_fields[field] = body[field]
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.platform_settings.find_one_and_update(
        {"id": "platform"},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0},
        upsert=True
    )
    return result


@router.put("/admin/type-images")
async def update_type_images(
    images: Dict[str, str],
    admin: Dict = Depends(require_admin)
):
    """Admin: Update type images (men/women/kids)"""
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": {"type_images": images}},
        upsert=True
    )
    return {"message": "Type images updated", "type_images": images}


@router.put("/admin/about-page")
async def update_about_page(
    request: Request,
    admin: Dict = Depends(require_admin)
):
    """Admin: Update about page sections"""
    body = await request.json()
    sections = body.get("sections", [])
    
    await db.about_page.update_one(
        {"id": "about"},
        {"$set": {"id": "about", "sections": sections}},
        upsert=True
    )
    return {"message": "About page updated", "sections": sections}


@router.post("/admin/states")
async def create_state(state_data: StateCreate, admin: Dict = Depends(require_admin)):
    """Admin: Create a new state with delivery fee"""
    # Check duplicate name
    existing = await db.states.find_one({"name": {"$regex": f"^{state_data.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="State with this name already exists")
    
    state = State(
        name=state_data.name,
        delivery_fee=state_data.delivery_fee,
        is_active=state_data.is_active
    )
    doc = state.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.states.insert_one(doc)
    return {"message": "State created", "state": {k: v for k, v in doc.items() if k != '_id'}}


@router.put("/admin/states/{state_id}")
async def update_state(state_id: str, state_data: StateCreate, admin: Dict = Depends(require_admin)):
    """Admin: Update a state"""
    state = await db.states.find_one({"id": state_id})
    if not state:
        raise HTTPException(status_code=404, detail="State not found")
    
    result = await db.states.find_one_and_update(
        {"id": state_id},
        {"$set": {
            "name": state_data.name,
            "delivery_fee": state_data.delivery_fee,
            "is_active": state_data.is_active
        }},
        return_document=True,
        projection={"_id": 0}
    )
    return {"message": "State updated", "state": result}


@router.delete("/admin/states/{state_id}")
async def delete_state(state_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Delete a state"""
    result = await db.states.delete_one({"id": state_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="State not found")
    return {"message": "State deleted"}


@router.get("/admin/shops")
async def get_all_shops(payment_method: Optional[str] = None, admin: Dict = Depends(require_admin)):
    """Admin: Get all shops filtered by payment method, with net revenue (same as shop sees)"""
    query = {}
    if payment_method:
        query["payment_method"] = payment_method
    
    shops = await db.shops.find(query, {"_id": 0}).to_list(1000)

    # Get platform settings for default commission
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    default_commission = platform_settings.get("commission_percentage", 0) if platform_settings else 0

    # Lazily expire subscriptions whose duration has passed (so the admin sees the
    # ended-badge even if the shop never opened its dashboard) + notify admin once.
    from services.helpers import mark_subscription_ended
    _now = datetime.now(timezone.utc)
    for shop in shops:
        try:
            if shop.get("subscription_status") in ["active", "trial"] and shop.get("subscription_end"):
                end_date = shop["subscription_end"]
                end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00")) if isinstance(end_date, str) else end_date
                if end_dt and end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=timezone.utc)
                if end_dt and end_dt < _now:
                    await db.shops.update_one({"id": shop["id"]}, {"$set": {"subscription_status": "expired"}})
                    shop["subscription_status"] = "expired"
                    await mark_subscription_ended(shop, "expired")
                    shop["subscription_ended_at"] = _now.isoformat()
                    shop["subscription_end_reason"] = "expired"
        except Exception:
            pass

    # Calculate net revenue per shop (same as shop dashboard shows)
    for shop in shops:
        commission_pct = shop.get("commission_percentage") if shop.get("commission_percentage") is not None else default_commission
        orders = await db.orders.find(
            {"shop_ids": shop["id"], "payment_status": "paid"},
            {"_id": 0, "items": 1}
        ).to_list(1000)
        
        gross_revenue = 0
        for order in orders:
            shop_items = [item for item in order.get("items", []) if item.get("shop_id") == shop["id"]]
            for item in shop_items:
                gross_revenue += item.get("subtotal", 0)
        
        commission_amount = gross_revenue * (commission_pct / 100)
        shop["total_revenue"] = gross_revenue - commission_amount  # Net revenue
    
    return shops


@router.get("/admin/shops/{shop_id}")
async def get_shop_details(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Get shop details"""
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.put("/admin/shops/{shop_id}/approve")
async def approve_shop(
    shop_id: str,
    months: int = 1,
    subscription_required: bool = True,
    commission_percentage: Optional[float] = None,
    commission_type: str = "on_customer",
    admin: Dict = Depends(require_admin)
):
    """Admin: Approve a shop request.

    Admin chooses:
      - subscription_required (bool): if False, shop pays NO subscription fees.
      - commission_percentage (float): per-shop commission rate to apply to products.
      - commission_type (str): one of 'on_shop', 'on_customer', 'half_half'.
      - months (int): subscription duration if subscription is required.
    """
    if commission_type not in ("on_shop", "on_customer", "half_half"):
        raise HTTPException(status_code=400, detail="Invalid commission_type. Must be one of: on_shop, on_customer, half_half")
    if commission_percentage is not None and (commission_percentage < 0 or commission_percentage > 100):
        raise HTTPException(status_code=400, detail="Commission percentage must be between 0 and 100")
    
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if subscription_required and months < 1:
        raise HTTPException(status_code=400, detail="Months must be at least 1 when subscription is required")
    
    # Get user email for notification
    user = await db.users.find_one({"id": shop.get("user_id")}, {"_id": 0})
    
    # Get platform settings
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    trial_days = platform_settings.get("trial_days", 7) if platform_settings else 7
    
    # Force shop to use Pro tier (only tier available now)
    shop_tier = "pro"
    tiers = platform_settings.get("tiers", {}) if platform_settings else {}
    tier_config = tiers.get(shop_tier, {})
    if not tier_config:
        tier_config = {"monthly_price": 39, "yearly_price": round(39*12*0.85, 2), "monthly_wallet_credit": 6}
    
    is_yearly = months == 12
    if is_yearly:
        price_per_month = tier_config.get("yearly_price", 397.8) / 12
    else:
        price_per_month = tier_config.get("monthly_price", 39)
    
    # Determine if this is the first-time approval (never had active subscription before)
    is_first_approval = shop.get("subscription_status") in [None, "pending", "none", ""] and not shop.get("subscription_start")
    
    now = datetime.now(timezone.utc)
    
    # Initialize variables for both branches
    total_amount = 0.0
    discount_amount = 0
    plan_type = "monthly"
    end_date_str = None
    end_date = None
    
    if not subscription_required:
        # No subscription: shop is approved, gets active status with no fee, no end date
        # When subscription is not required, shop is NOT a pro shop — set tier to "starter"
        update_fields = {
            "status": "approved",
            "subscription_required": False,
            "subscription_status": "active",
            "subscription_start": now.isoformat(),
            "subscription_end": None,
            "subscription_price_paid": 0.0,
            "plan_type": "free",
            "tier": "starter",
            "commission_type": commission_type,
        }
        if commission_percentage is not None:
            update_fields["commission_percentage"] = commission_percentage
        plan_type = "free"
        end_date_str = "No expiration"
    else:
        # Subscription required: activate paid subscription
        if is_first_approval:
            subscription_days = 30 + trial_days
            end_date = now + timedelta(days=subscription_days)
            end_date_str = end_date.strftime("%B %d, %Y")
            sale_active = tier_config.get("sale_active", False)
            sale_percentage = tier_config.get("sale_percentage", 0)
            if not sale_active:
                sale_active = platform_settings.get("subscription_sale_active", False) if platform_settings else False
                sale_percentage = platform_settings.get("subscription_sale_percentage", 0) if platform_settings else 0
            if sale_active and sale_percentage > 0:
                total_amount = round(price_per_month * (1 - sale_percentage / 100), 2)
            else:
                total_amount = price_per_month
            discount_amount = 0
            plan_type = "monthly"
        else:
            sale_active = tier_config.get("sale_active", False)
            sale_percentage = tier_config.get("sale_percentage", 0)
            if not sale_active:
                sale_active = platform_settings.get("subscription_sale_active", False) if platform_settings else False
                sale_percentage = platform_settings.get("subscription_sale_percentage", 0) if platform_settings else 0
            if is_yearly:
                yearly_discount_percent = platform_settings.get("yearly_discount_percent", 15) if platform_settings else 15
                base_price = price_per_month
                if sale_active and sale_percentage > 0:
                    base_price = round(price_per_month * (1 - sale_percentage / 100), 2)
                original_total = base_price * 12
                discount_amount = original_total * (yearly_discount_percent / 100)
                total_amount = original_total - discount_amount
            else:
                if sale_active and sale_percentage > 0:
                    total_amount = round(price_per_month * (1 - sale_percentage / 100) * months, 2)
                else:
                    total_amount = price_per_month * months
                discount_amount = 0
            plan_type = "yearly" if is_yearly else "monthly"
            end_date = now + timedelta(days=365 if is_yearly else 30 * months)
            end_date_str = end_date.strftime("%B %d, %Y")
        
        update_fields = {
            "status": "approved",
            "subscription_required": True,
            "subscription_status": "active",
            "subscription_start": now.isoformat(),
            "subscription_end": end_date.isoformat() if end_date else None,
            "subscription_price_paid": total_amount,
            "plan_type": plan_type,
            "tier": shop_tier,
            "commission_type": commission_type,
        }
        if commission_percentage is not None:
            update_fields["commission_percentage"] = commission_percentage
    
    result = await db.shops.find_one_and_update(
        {"id": shop_id},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0}
    )
    
    # Update user role to "shop" now that subscription is active
    await db.users.update_one(
        {"id": shop.get("user_id")},
        {"$set": {"role": "shop", "shop_id": shop_id}}
    )
    
    # Record payment in subscription_payments only if there was a payment
    if subscription_required and total_amount > 0:
        payment_record = {
            "id": str(uuid.uuid4()),
            "shop_id": shop_id,
            "shop_name": result.get("name"),
            "amount": total_amount,
            "months": months,
            "price_per_month": price_per_month,
            "discount_amount": discount_amount,
            "plan_type": plan_type,
            "tier": shop_tier,
            "payment_intent_id": None,
            "payment_method": "manual_admin",
            "type": "subscription",
            "created_at": now.isoformat()
        }
        await db.subscription_payments.insert_one(payment_record)
    
    # Credit wallet with monthly tier bonus only when subscription is required
    if subscription_required:
        monthly_credit = tier_config.get("monthly_wallet_credit", 6)
        if monthly_credit > 0:
            current_balance = result.get("wallet_balance", 0) or 0
            new_balance = current_balance + monthly_credit
            await db.shops.update_one({"id": shop_id}, {"$set": {"wallet_balance": new_balance}})
            txn = {
                "id": str(uuid.uuid4()), "shop_id": shop_id, "shop_name": result.get("name", ""),
                "type": "monthly_credit", "amount": monthly_credit, "balance_after": new_balance,
                "status": "completed", "note": f"{shop_tier.title()} tier monthly wallet credit",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.wallet_transactions.insert_one(txn)
    
    # ---- Welcome bonuses: configurable wallet credit + free sponsors (only once per shop) ----
    welcome_already_granted = (result or {}).get("welcome_bonus_granted", False)
    if not welcome_already_granted:
        # Branch on referral: referred shops get a richer welcome bonus ($3 + 2 sponsors)
        is_referred = bool((result or {}).get("referred_by_agent_id"))
        welcome = get_welcome_bonus(is_referred, platform_settings)
        welcome_wallet = welcome["wallet"]
        welcome_sponsors = welcome["sponsors"]
        
        # Update shop: add wallet credit + sponsor credits, mark granted
        update_doc = {
            "$inc": {
                "free_sponsor_credits": welcome_sponsors,
            },
            "$set": {
                "welcome_bonus_granted": True,
                "welcome_bonus_granted_at": now.isoformat(),
            }
        }
        if welcome_wallet > 0:
            current_balance = result.get("wallet_balance", 0) or 0
            update_doc["$set"]["wallet_balance"] = round(current_balance + welcome_wallet, 2)
        
        await db.shops.update_one({"id": shop_id}, update_doc)
        
        # Wallet transaction & admin_ledger (counted as monthly_credits → deduction from admin profit)
        if welcome_wallet > 0:
            txn_id = str(uuid.uuid4())
            await db.wallet_transactions.insert_one({
                "id": txn_id,
                "shop_id": shop_id,
                "shop_name": result.get("name", ""),
                "type": "welcome_bonus",
                "amount": welcome_wallet,
                "balance_after": round((result.get("wallet_balance", 0) or 0) + welcome_wallet, 2),
                "status": "completed",
                "note": f"Welcome bonus: {welcome['summary']}",
                "created_at": now.isoformat()
            })
            await db.admin_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "type": "monthly_credits",
                "subtype": "shop_welcome_wallet_referred" if is_referred else "shop_welcome_wallet",
                "amount": welcome_wallet,
                "direction": "debit",
                "shop_id": shop_id,
                "shop_name": result.get("name", ""),
                "ref_id": txn_id,
                "note": f"Welcome wallet credit{' (referred)' if is_referred else ''} for {result.get('name','')}",
                "created_at": now.isoformat()
            })
        
        # Notify the shop owner about the welcome bonus
        try:
            shop_owner_id = result.get("user_id") if result else None
            if shop_owner_id:
                await create_notification(
                    shop_owner_id,
                    "🎁 Welcome Bonus Unlocked!",
                    f"You got {welcome['summary']} as a welcome gift. Use them in your shop dashboard!",
                    "bonus",
                    "/shop/dashboard"
                )
        except Exception:
            pass
    
    # ---- Record subscription fee as admin profit (only when subscription is required) ----
    if subscription_required and total_amount > 0:
        try:
            await db.admin_revenue.insert_one({
                "id": str(uuid.uuid4()),
                "type": "subscription_fee",
                "source": "shop_subscription",
                "shop_id": shop_id,
                "shop_name": result.get("name", ""),
                "amount": total_amount,
                "plan_type": plan_type,
                "months": months,
                "description": f"Subscription fee from shop {result.get('name', '')} ({plan_type}, {months}mo)",
                "created_at": now.isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to record subscription revenue: {e}")
    
    # Send activation email
    shop_email = result.get("email") or (user.get("email") if user else None)
    if shop_email:
        await send_subscription_email(
            shop_email,
            result.get("name"),
            "activated",
            {"amount": total_amount, "months": months if subscription_required else 0, "expires": end_date_str, "trial_days": trial_days if (is_first_approval and subscription_required) else 0}
        )
    
    logger.info(f"Admin approved shop {shop_id}: subscription_required={subscription_required}, commission={commission_percentage}%, type={commission_type}")
    
    # ---- Referral agent: pay approval bonus if shop was referred ----
    if result and result.get("referred_by_agent_id") and not (shop.get("agent_approval_bonus_paid")):
        try:
            from services.referral_helpers import on_referred_shop_approved
            await on_referred_shop_approved(
                shop_id=shop_id,
                shop_name=result.get("name", ""),
                referral_agent_id=result["referred_by_agent_id"],
            )
            await db.shops.update_one({"id": shop_id}, {"$set": {"agent_approval_bonus_paid": True}})
        except Exception as _ref_err:
            logger.error(f"Failed to credit agent approval bonus for shop {shop_id}: {_ref_err}")
    
    # Notify shop about approval
    sub_msg = f" Subscription active until {end_date_str}." if subscription_required else " No subscription fees!"
    commission_msg = f" Commission: {commission_percentage}% ({commission_type.replace('_', ' ').title()})." if commission_percentage is not None else ""
    await create_notification(
        "shop",
        "Shop Approved!",
        f"Congratulations! '{result.get('name')}' has been approved.{sub_msg}{commission_msg}",
        "subscription",
        "/shop/dashboard",
        shop_id
    )
    
    return {
        "message": f"Shop approved (subscription_required={subscription_required}). Commission: {commission_percentage}% ({commission_type}). User will need to re-login to access shop features.",
        "shop": result,
        "amount_paid": total_amount,
        "months": months if subscription_required else 0,
        "plan_type": plan_type,
        "is_first_approval": is_first_approval,
        "trial_days": trial_days if (is_first_approval and subscription_required) else None,
        "subscription_required": subscription_required,
        "commission_percentage": commission_percentage,
        "commission_type": commission_type,
    }


@router.put("/admin/shops/{shop_id}/suspend")
async def suspend_shop(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Suspend shop"""
    result = await db.shops.find_one_and_update(
        {"id": shop_id},
        {"$set": {"status": "suspended", "subscription_status": "cancelled"}},
        return_document=True,
        projection={"_id": 0}
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Send suspension email
    shop_email = result.get("email")
    if shop_email:
        await send_subscription_email(shop_email, result.get("name"), "suspended")
    
    return {"message": "Shop suspended", "shop": result}


@router.put("/admin/shops/{shop_id}/verify")
async def admin_verify_shop(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Instantly mark a shop as Verified (manual verification from the Shops page)."""
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.shops.update_one(
        {"id": shop_id},
        {"$set": {"is_verified": True, "verified_at": now, "verified_by": admin.get("user_id"), "updated_at": now}}
    )

    # Keep any verification request record in sync if one exists
    try:
        await db.shop_verifications.update_one(
            {"shop_id": shop_id},
            {"$set": {"status": "approved", "approved_at": now, "approved_by": admin.get("user_id"), "rejection_reason": None, "updated_at": now}}
        )
    except Exception:
        pass

    # Notify the shop owner
    try:
        await create_notification(
            recipient_type="shop",
            title="Verification Approved!",
            message=f"Congratulations! Your shop '{shop.get('name', '')}' is now a Verified Seller.",
            notification_type="system",
            link="/shop/verification",
            recipient_id=shop_id
        )
    except Exception:
        pass

    return {"message": "Shop verified", "shop_id": shop_id, "is_verified": True}


@router.put("/admin/shops/{shop_id}/unverify")
async def admin_unverify_shop(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Remove the Verified badge from a shop."""
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.shops.update_one(
        {"id": shop_id},
        {"$set": {"is_verified": False, "updated_at": now}}
    )
    return {"message": "Shop unverified", "shop_id": shop_id, "is_verified": False}


@router.put("/admin/shops/{shop_id}/activate-subscription")
async def activate_shop_subscription(shop_id: str, months: int = 1, admin: Dict = Depends(require_admin)):
    """Admin: Manually activate shop subscription"""
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Get subscription price from platform settings
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    subscription_price = platform_settings.get("subscription_price", 29.0) if platform_settings else 29.0
    total_paid = subscription_price * months
    
    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=30 * months)
    end_date_str = end_date.strftime("%B %d, %Y")
    
    await db.shops.update_one(
        {"id": shop_id},
        {"$set": {
            "status": "approved",
            "subscription_status": "active",
            "subscription_start": now.isoformat(),
            "subscription_end": end_date.isoformat(),
            "subscription_price_paid": total_paid
        }}
    )
    
    # Update user role to shop
    await db.users.update_one(
        {"id": shop.get("user_id")},
        {"$set": {"role": "shop", "shop_id": shop_id}}
    )
    
    # Record subscription payment for admin revenue tracking
    subscription_record = {
        "id": str(uuid.uuid4()),
        "shop_id": shop_id,
        "shop_name": shop.get("name"),
        "amount": total_paid,
        "months": months,
        "price_per_month": subscription_price,
        "type": "subscription",
        "payment_method": "manual",
        "created_at": now.isoformat()
    }
    await db.subscription_payments.insert_one(subscription_record)
    
    # Send activation email to BOTH user email and shop email
    user = await db.users.find_one({"id": shop.get("user_id")}, {"_id": 0, "email": 1, "name": 1})
    emails_sent = []
    
    # Send to user's logged-in email
    if user and user.get("email"):
        await send_subscription_email(
            user.get("email"),
            shop.get("name"),
            "activated",
            {"amount": total_paid, "expires": end_date_str, "user_name": user.get("name")}
        )
        emails_sent.append(user.get("email"))
    
    # Send to shop email (if different from user email)
    shop_email = shop.get("email")
    if shop_email and shop_email not in emails_sent:
        await send_subscription_email(
            shop_email,
            shop.get("name"),
            "activated",
            {"amount": total_paid, "expires": end_date_str}
        )
        emails_sent.append(shop_email)
    
    logger.info(f"Subscription activated for shop {shop_id}. Emails sent to: {emails_sent}")
    
    return {"message": f"Subscription activated for {months} month(s)", "expires": end_date.isoformat(), "amount_paid": total_paid, "emails_sent": emails_sent}


@router.put("/admin/shops/{shop_id}")
async def admin_update_shop(shop_id: str, shop_data: AdminShopUpdate, admin: Dict = Depends(require_admin)):
    """Admin: Update shop details including commission"""
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    update_fields = {}
    if shop_data.name is not None:
        update_fields["name"] = shop_data.name
    if shop_data.description is not None:
        update_fields["description"] = shop_data.description
    if shop_data.phone is not None:
        update_fields["phone"] = shop_data.phone
    if shop_data.email is not None:
        update_fields["email"] = shop_data.email
    if shop_data.address is not None:
        update_fields["address"] = shop_data.address
    if shop_data.logo is not None:
        update_fields["logo"] = shop_data.logo
    if shop_data.latitude is not None:
        update_fields["latitude"] = shop_data.latitude
    if shop_data.longitude is not None:
        update_fields["longitude"] = shop_data.longitude
    if shop_data.commission_percentage is not None:
        if shop_data.commission_percentage < 0 or shop_data.commission_percentage > 100:
            raise HTTPException(status_code=400, detail="Commission must be between 0 and 100")
        update_fields["commission_percentage"] = shop_data.commission_percentage
    if shop_data.commission_type is not None:
        if shop_data.commission_type not in ("on_shop", "on_customer", "half_half"):
            raise HTTPException(status_code=400, detail="Invalid commission_type")
        update_fields["commission_type"] = shop_data.commission_type
    if shop_data.subscription_required is not None:
        update_fields["subscription_required"] = shop_data.subscription_required
    if shop_data.category_ids is not None:
        update_fields["category_ids"] = shop_data.category_ids
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.shops.find_one_and_update(
        {"id": shop_id},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0}
    )
    
    # Notify shop about update
    await create_notification(
        "shop",
        "Shop Profile Updated",
        "Your shop information has been updated by admin.",
        "system",
        "/shop/settings",
        shop_id
    )
    
    return {"message": "Shop updated successfully", "shop": result}


@router.put("/admin/shops/{shop_id}/update-subscription")
async def update_shop_subscription(
    shop_id: str, 
    subscription_end: Optional[str] = None,
    subscription_status: Optional[str] = None,
    payment_amount: Optional[float] = None,
    admin: Dict = Depends(require_admin)
):
    """Admin: Update shop subscription details"""
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    update_fields = {}
    if subscription_end:
        update_fields["subscription_end"] = subscription_end
    if subscription_status:
        valid_statuses = ["none", "trial", "active", "expired", "cancelled"]
        if subscription_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        update_fields["subscription_status"] = subscription_status
        # Also update status to approved if activating
        if subscription_status == "active":
            update_fields["status"] = "approved"
    
    if not update_fields and payment_amount is None:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    if update_fields:
        result = await db.shops.find_one_and_update(
            {"id": shop_id},
            {"$set": update_fields},
            return_document=True,
            projection={"_id": 0}
        )
    else:
        result = shop
    
    # Record payment amount as admin revenue if provided
    if payment_amount and payment_amount > 0:
        payment_record = {
            "id": str(uuid.uuid4()),
            "shop_id": shop_id,
            "shop_name": shop.get("name", "Unknown"),
            "amount": payment_amount,
            "months": 0,
            "price_per_month": 0,
            "discount_amount": 0,
            "plan_type": "subscription_edit",
            "payment_intent_id": None,
            "payment_method": "manual_admin",
            "type": "subscription",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscription_payments.insert_one(payment_record)
    
    return {"message": "Subscription updated", "shop": result}


@router.put("/admin/shops/{shop_id}/commission")
async def update_shop_commission(
    shop_id: str,
    commission_percentage: Optional[float] = None,
    admin: Dict = Depends(require_admin)
):
    """Admin: Set custom commission percentage for a specific shop"""
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if commission_percentage is not None:
        if commission_percentage < 0 or commission_percentage > 100:
            raise HTTPException(status_code=400, detail="Commission percentage must be between 0 and 100")
    
    result = await db.shops.find_one_and_update(
        {"id": shop_id},
        {"$set": {"commission_percentage": commission_percentage}},
        return_document=True,
        projection={"_id": 0}
    )
    
    return {"message": "Commission percentage updated", "shop": result}


@router.get("/admin/shops/{shop_id}/products")
async def get_shop_products_admin(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Get shop's products with commission info"""
    products = await db.products.find({"shop_id": shop_id}, {"_id": 0}).to_list(1000)
    
    info = await get_shop_commission_info(shop_id)
    commission_rate = info["rate"]
    commission_type = info["type"]
    customer_factor = get_customer_markup_factor(commission_rate, commission_type)
    shop_factor = get_shop_revenue_factor(commission_rate, commission_type)
    
    # Add commission prices
    for prod in products:
        original_price = prod.get('price', 0)
        original_discount = prod.get('discount_price')
        
        prod['original_price'] = original_price
        prod['original_discount_price'] = original_discount
        prod['customer_price'] = round(original_price * customer_factor, 2)
        if original_discount:
            prod['customer_discount_price'] = round(original_discount * customer_factor, 2)
        prod['shop_revenue_price'] = round(original_price * shop_factor, 2)
        if original_discount:
            prod['shop_revenue_discount_price'] = round(original_discount * shop_factor, 2)
        prod['commission_type'] = commission_type
        prod['commission_rate_pct'] = round(commission_rate * 100, 2)
    
    return products


@router.get("/admin/products-all")
async def get_all_products_admin(admin: Dict = Depends(require_admin)):
    """Admin: Get all products with both original and commission prices (per-shop rates)"""
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    # Build a map of shop_id -> commission_rate and type for per-shop tier commission
    shop_ids = list(set(p.get("shop_id") for p in products if p.get("shop_id")))
    shop_commission_rates = {}
    shop_commission_types = {}
    for sid in shop_ids:
        info = await get_shop_commission_info(sid)
        shop_commission_rates[sid] = info["rate"]
        shop_commission_types[sid] = info["type"]
    default_commission_rate = await get_commission_rate()
    
    # Fetch shop names for display
    shops_map = {}
    if shop_ids:
        shop_docs = await db.shops.find({"id": {"$in": shop_ids}}, {"_id": 0, "id": 1, "name": 1, "tier": 1}).to_list(500)
        shops_map = {s["id"]: s for s in shop_docs}
    
    # Add commission prices for admin view - using per-shop rates
    for prod in products:
        original_price = prod.get('price', 0)
        original_discount = prod.get('discount_price')
        shop_id = prod.get('shop_id')
        commission_rate = shop_commission_rates.get(shop_id, default_commission_rate) if shop_id else default_commission_rate
        commission_type = shop_commission_types.get(shop_id, "on_customer") if shop_id else "on_customer"
        customer_factor = get_customer_markup_factor(commission_rate, commission_type)
        shop_factor = get_shop_revenue_factor(commission_rate, commission_type)
        
        prod['original_price'] = original_price
        prod['original_discount_price'] = original_discount
        prod['customer_price'] = round(original_price * customer_factor, 2)
        if original_discount:
            prod['customer_discount_price'] = round(original_discount * customer_factor, 2)
        prod['shop_revenue_price'] = round(original_price * shop_factor, 2)
        if original_discount:
            prod['shop_revenue_discount_price'] = round(original_discount * shop_factor, 2)
        prod['commission_rate_percent'] = round(commission_rate * 100, 1)
        prod['commission_type'] = commission_type
        prod['shop_name'] = shops_map.get(shop_id, {}).get('name', '')
        prod['shop_tier'] = shops_map.get(shop_id, {}).get('tier', 'pro')
    
    return products


@router.delete("/admin/shops/{shop_id}")
async def delete_shop(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Delete a shop and all related data (products, etc.) but keep user account"""
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Get shop owner info
    owner_id = shop.get("user_id")
    
    # Delete all shop's products
    deleted_products = await db.products.delete_many({"shop_id": shop_id})
    
    # Remove shop from orders (but keep orders for history)
    # Note: We don't delete orders as they are important for records
    
    # Delete the shop
    await db.shops.delete_one({"id": shop_id})
    
    # Update user role back to 'user' if they had shop role
    if owner_id:
        await db.users.update_one(
            {"id": owner_id, "role": "shop"},
            {"$set": {"role": "user"}}
        )
    
    logger.info(f"Admin {admin['email']} deleted shop {shop.get('name')} - {deleted_products.deleted_count} products removed")
    
    return {
        "message": f"Shop '{shop.get('name')}' deleted successfully",
        "products_deleted": deleted_products.deleted_count,
        "user_account_preserved": True
    }


@router.get("/admin/shops/{shop_id}/orders")
async def get_shop_orders_admin(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Get shop's orders"""
    orders = await db.orders.find({"shop_ids": shop_id}, {"_id": 0}).to_list(1000)
    return orders


@router.get("/admin/shops/{shop_id}/analytics")
async def get_shop_analytics_admin(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Get shop's analytics (returns same revenue as shop sees - net after commission)"""
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    
    # Get platform settings for default commission
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    default_commission = platform_settings.get("commission_percentage", 0) if platform_settings else 0
    
    # Use shop-specific commission or tier-based
    tier = shop.get("tier", "starter") if shop else "starter"
    tiers = platform_settings.get("tiers", {}) if platform_settings else {}
    tier_config = tiers.get(tier, {})
    commission_percentage = shop.get("commission_percentage") if shop and shop.get("commission_percentage") is not None else (tier_config.get("commission_rate") or default_commission)
    
    orders = await db.orders.find(
        {"shop_ids": shop_id, "payment_status": "paid"},
        {"_id": 0}
    ).to_list(1000)
    
    all_orders_count = await db.orders.count_documents({"shop_ids": shop_id})
    
    gross_revenue = 0
    for order in orders:
        shop_items = [item for item in order.get("items", []) if item.get("shop_id") == shop_id]
        for item in shop_items:
            gross_revenue += item.get("subtotal", 0)
    
    # Calculate commission and net revenue (same as shop sees)
    commission_amount = gross_revenue * (commission_percentage / 100)
    net_revenue = gross_revenue - commission_amount
    
    products_count = await db.products.count_documents({"shop_id": shop_id})
    
    return {
        "total_revenue": net_revenue,
        "gross_revenue": gross_revenue,
        "commission_amount": commission_amount,
        "commission_percentage": commission_percentage,
        "total_orders": all_orders_count,
        "paid_orders": len(orders),
        "products_count": products_count
    }


@router.get("/admin/delivery-users")
async def get_delivery_users(admin: Dict = Depends(require_admin)):
    """Admin: Get all delivery users"""
    users = await db.users.find({"role": "delivery"}, {"_id": 0, "password": 0}).to_list(1000)
    return users


@router.post("/admin/create-delivery-user")
async def create_delivery_user(email: str, password: str, name: str, admin: Dict = Depends(require_admin)):
    """Admin: Create a delivery user account"""
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password": hashed_password,
        "name": name,
        "role": "delivery",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    return {"message": "Delivery user created", "user_id": user_id}


@router.get("/admin/revenue")
async def get_admin_revenue(admin: Dict = Depends(require_admin)):
    """Admin: Get total revenue breakdown - subscriptions, commissions, and per-shop revenue"""
    
    # Get all approved shops with their revenue
    shops = await db.shops.find({"status": "approved"}, {"_id": 0}).to_list(1000)
    
    shops_revenue = []
    total_shops_revenue = 0
    total_gross_revenue = 0
    
    for shop in shops:
        # Get paid orders for this shop
        orders = await db.orders.find(
            {"shop_ids": shop["id"], "payment_status": "paid"},
            {"_id": 0}
        ).to_list(1000)
        
        shop_gross_revenue = 0
        shop_commission = 0
        shop_orders = 0
        for order in orders:
            shop_items = [item for item in order.get("items", []) if item.get("shop_id") == shop["id"]]
            for item in shop_items:
                shop_gross_revenue += item.get("subtotal", 0)
            if shop_items:
                shop_orders += 1
                # Calculate shop's share of commission from this order
                # Proportional to items from this shop
                order_total = sum(i.get("subtotal", 0) for i in order.get("items", []))
                shop_share = sum(i.get("subtotal", 0) for i in shop_items) / order_total if order_total > 0 else 0
                shop_commission += order.get("commission_amount", 0) * shop_share
        
        # Net revenue = gross - commission
        shop_net_revenue = shop_gross_revenue - shop_commission
        total_gross_revenue += shop_gross_revenue
        total_shops_revenue += shop_net_revenue
        
        shops_revenue.append({
            "shop_id": shop["id"],
            "shop_name": shop.get("name"),
            "gross_revenue": shop_gross_revenue,
            "commission_deducted": shop_commission,
            "net_revenue": shop_net_revenue,
            "orders_count": shop_orders,
            "subscription_status": shop.get("subscription_status", "none"),
            "subscription_end": shop.get("subscription_end")
        })
    
    # Get subscription payments (admin revenue from subscriptions)
    subscription_payments = await db.subscription_payments.find({}, {"_id": 0}).to_list(1000)
    total_subscription_revenue = sum(p.get("amount", 0) for p in subscription_payments)
    
    # Get commission revenue from all paid orders
    all_paid_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(10000)
    total_commission_revenue = sum(order.get("commission_amount", 0) for order in all_paid_orders)
    
    # Get platform settings
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    
    # Admin's total revenue = subscriptions + commissions + adjustments
    adjustments = await db.revenue_adjustments.find({}, {"_id": 0, "amount": 1}).to_list(1000)
    total_adjustments = sum(a.get("amount", 0) for a in adjustments)
    admin_total_revenue = total_subscription_revenue + total_commission_revenue + total_adjustments
    
    return {
        "admin_revenue": {
            "total": admin_total_revenue,
            "subscriptions": total_subscription_revenue,
            "commissions": total_commission_revenue,
            "adjustments": total_adjustments
        },
        "platform_revenue": {
            "total_gross_sales": total_gross_revenue,
            "total_commissions_collected": total_commission_revenue,
            "total_net_to_shops": total_shops_revenue,
            "total_orders": len(all_paid_orders)
        },
        "shops_breakdown": sorted(shops_revenue, key=lambda x: x.get("net_revenue", 0), reverse=True),
        "subscription_payments": subscription_payments,
        "platform_settings": platform_settings
    }


@router.post("/admin/reset-revenue")
async def reset_admin_revenue(admin: Dict = Depends(require_admin)):
    """Admin: Reset all revenue AND profit tracking data (DANGEROUS - cannot be undone).

    Clears every collection that feeds the Admin Profit / Revenue figures so both
    Total Revenue and Admin Profit return to $0:
      - subscription_payments (subscription revenue)
      - order commission_amount -> 0 (commission revenue)
      - admin_ledger (subscriptions/platform services/credits/loyalty deductions)
      - revenue_adjustments (manual +/- adjustments)
      - admin_cashouts / admin_revenue (legacy revenue + withdrawals)
    Shop wallet balances and order records (besides commission) are left intact.
    """
    try:
        # 1. Subscription revenue records
        result_sub = await db.subscription_payments.delete_many({})

        # 2. Zero out commission on all orders (commission revenue)
        result_orders = await db.orders.update_many(
            {"commission_amount": {"$exists": True}},
            {"$set": {"commission_amount": 0}}
        )

        # 3. Profit ledger entries (subscriptions auto-renew, platform services,
        #    monthly credits, loyalty deductions)
        result_ledger = await db.admin_ledger.delete_many({})

        # 4. Manual revenue adjustments
        result_adjustments = await db.revenue_adjustments.delete_many({})

        # 5. Legacy admin revenue records + admin cash-out history (available balance)
        result_admin_rev = await db.admin_revenue.delete_many({})
        result_cashouts = await db.admin_cashouts.delete_many({})

        logger.info(
            f"Admin {admin['email']} reset revenue & profit: "
            f"subs={result_sub.deleted_count}, orders_commission={result_orders.modified_count}, "
            f"ledger={result_ledger.deleted_count}, adjustments={result_adjustments.deleted_count}, "
            f"admin_revenue={result_admin_rev.deleted_count}, cashouts={result_cashouts.deleted_count}"
        )

        return {
            "message": "Revenue and profit data has been reset successfully",
            "subscription_payments_deleted": result_sub.deleted_count,
            "orders_commission_reset": result_orders.modified_count,
            "ledger_entries_deleted": result_ledger.deleted_count,
            "adjustments_deleted": result_adjustments.deleted_count,
            "admin_revenue_deleted": result_admin_rev.deleted_count,
            "admin_cashouts_deleted": result_cashouts.deleted_count,
        }
    except Exception as e:
        logger.error(f"Error resetting revenue: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reset revenue data")


@router.get("/admin/payouts/pending")
async def get_pending_payouts(admin: Dict = Depends(require_admin)):
    """Get all pending payouts grouped by shop — ONLY orders with redeemed loyalty points"""
    # Find orders with redeemed loyalty points: payment_status=paid or COD delivered, payout_status=pending
    orders = await db.orders.find({
        "payout_status": "pending",
        "order_status": {"$nin": ["cancelled"]},
        "loyalty_points_redeemed": {"$gt": 0},
        "$or": [
            {"payment_method": "card", "payment_status": "paid"},
            {"payment_method": "cod", "order_status": "delivered"}
        ]
    }, {"_id": 0}).to_list(10000)
    
    # Group by shop
    shop_payouts = {}
    for order in orders:
        for shop_id in order.get("shop_ids", []):
            if shop_id not in shop_payouts:
                shop_payouts[shop_id] = {
                    "shop_id": shop_id,
                    "shop_name": "",
                    "total_amount": 0,
                    "commission_deducted": 0,
                    "loyalty_discount": 0,
                    "admin_owes_shop": 0,
                    "net_payout": 0,
                    "order_count": 0,
                    "order_ids": [],
                    "orders": []
                }
            
            num_shops = max(len(order.get("shop_ids", [1])), 1)
            order_share = order.get("total_amount", 0) / num_shops
            original_commission = order.get("original_commission_amount", order.get("commission_amount", 0)) / num_shops
            loyalty_discount_share = order.get("loyalty_discount_amount", 0) / num_shops
            admin_owes_share = order.get("admin_owes_shop_amount", 0) / num_shops
            
            # Net payout = original shop revenue + any admin-owes amount
            # Shop revenue = order items at original prices (no commission)
            # But simplified: net_payout = order_share - commission + loyalty_discount that exceeded commission
            original_total_share = sum(
                item.get("original_subtotal", item.get("subtotal", 0))
                for item in order.get("items", [])
                if item.get("shop_id") == shop_id
            )
            if original_total_share == 0:
                original_total_share = order_share - original_commission
            
            shop_payouts[shop_id]["total_amount"] += order_share
            shop_payouts[shop_id]["commission_deducted"] += original_commission
            shop_payouts[shop_id]["loyalty_discount"] += loyalty_discount_share
            shop_payouts[shop_id]["admin_owes_shop"] += admin_owes_share
            shop_payouts[shop_id]["net_payout"] += original_total_share + admin_owes_share
            shop_payouts[shop_id]["order_count"] += 1
            shop_payouts[shop_id]["order_ids"].append(order["id"])
            shop_payouts[shop_id]["orders"].append({
                "id": order["id"],
                "total_amount": order.get("total_amount", 0),
                "commission_amount": order.get("commission_amount", 0),
                "original_commission_amount": order.get("original_commission_amount", order.get("commission_amount", 0)),
                "loyalty_discount_amount": order.get("loyalty_discount_amount", 0),
                "loyalty_points_redeemed": order.get("loyalty_points_redeemed", 0),
                "admin_owes_shop_amount": order.get("admin_owes_shop_amount", 0),
                "payment_method": order.get("payment_method"),
                "created_at": order.get("created_at"),
            })
    
    # Get shop names
    for shop_id in shop_payouts:
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "name": 1})
        if shop:
            shop_payouts[shop_id]["shop_name"] = shop.get("name", "Unknown Shop")
        # Round values
        for key in ["total_amount", "commission_deducted", "loyalty_discount", "admin_owes_shop", "net_payout"]:
            shop_payouts[shop_id][key] = round(shop_payouts[shop_id][key], 2)
    
    payouts_list = list(shop_payouts.values())
    return {
        "pending_payouts": payouts_list,
        "total_pending": round(sum(p["net_payout"] for p in payouts_list), 2),
        "total_admin_owes": round(sum(p["admin_owes_shop"] for p in payouts_list), 2),
        "total_orders": sum(p["order_count"] for p in payouts_list)
    }


@router.post("/admin/payouts/mark-paid/{shop_id}")
async def mark_shop_payout_paid(shop_id: str, admin: Dict = Depends(require_admin)):
    """Mark all pending payouts for a shop as paid — only orders with redeemed loyalty points.
    Also records a loyalty_points_deduction in admin_ledger to decrease admin revenue."""
    # Use same eligibility logic as get_pending_payouts
    orders = await db.orders.find({
        "payout_status": "pending",
        "order_status": {"$nin": ["cancelled"]},
        "shop_ids": shop_id,
        "loyalty_points_redeemed": {"$gt": 0},
        "$or": [
            {"payment_method": "card", "payment_status": "paid"},
            {"payment_method": "cod", "order_status": "delivered"}
        ]
    }, {"_id": 0}).to_list(10000)
    
    if not orders:
        raise HTTPException(status_code=404, detail="No pending payouts found for this shop")
    
    order_ids = [order["id"] for order in orders]
    
    # Calculate total admin_owes_shop_amount (the amount admin must pay shop from loyalty points)
    total_admin_owes = 0
    for order in orders:
        num_shops = max(len(order.get("shop_ids", [1])), 1)
        admin_owes_share = order.get("admin_owes_shop_amount", 0) / num_shops
        total_admin_owes += admin_owes_share
    total_admin_owes = round(total_admin_owes, 2)
    
    # Update all orders to payout_status = "paid"
    result = await db.orders.update_many(
        {"id": {"$in": order_ids}},
        {"$set": {"payout_status": "paid", "payout_date": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get shop name for response
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "name": 1})
    shop_name = shop.get("name", "Unknown Shop") if shop else "Unknown Shop"
    
    # Record loyalty points deduction in admin_ledger (decreases admin revenue)
    if total_admin_owes > 0:
        ledger_entry = {
            "id": str(uuid.uuid4()),
            "type": "loyalty_points_deduction",
            "subtype": "payout_to_shop",
            "amount": -total_admin_owes,  # Negative to decrease revenue
            "note": f"Payout to {shop_name} for loyalty point deductions ({len(order_ids)} orders)",
            "shop_id": shop_id,
            "shop_name": shop_name,
            "order_ids": order_ids,
            "direction": "debit",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.admin_ledger.insert_one(ledger_entry)
    
    # Calculate total paid out
    total_paid = sum(order.get("total_amount", 0) - order.get("commission_amount", 0) for order in orders)
    
    logger.info(f"Admin {admin['email']} marked payout as paid for shop {shop_name}: {len(order_ids)} orders, ${total_paid:.2f}, loyalty deduction: ${total_admin_owes:.2f}")
    
    return {
        "message": f"Payout marked as paid for {shop_name}",
        "shop_id": shop_id,
        "shop_name": shop_name,
        "orders_updated": result.modified_count,
        "total_paid": total_paid,
        "loyalty_deduction": total_admin_owes
    }


@router.get("/admin/cancel-requests")
async def get_cancel_requests(admin: Dict = Depends(require_admin), status: Optional[str] = None):
    """Admin: Get all cancellation requests"""
    query = {}
    if status:
        query["status"] = status
    requests = await db.cancel_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    # Enrich with order details
    for req in requests:
        order = await db.orders.find_one({"id": req["order_id"]}, {"_id": 0})
        if order:
            req["order"] = order
        # Get user info if available
        if req.get("user_id"):
            user_data = await db.users.find_one({"id": req["user_id"]}, {"_id": 0, "password": 0})
            if user_data:
                req["user_info"] = user_data
    
    return requests


@router.post("/admin/cancel-requests/{request_id}/approve")
async def approve_cancel_request(request_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Approve a cancellation request — performs full order cancellation"""
    cancel_req = await db.cancel_requests.find_one({"id": request_id}, {"_id": 0})
    if not cancel_req:
        raise HTTPException(status_code=404, detail="Cancellation request not found")
    if cancel_req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {cancel_req['status']}")
    
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    
    order_id = cancel_req["order_id"]
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Perform the actual cancellation (stock restore, notifications, loyalty adjustments)
    # Restore stock for cancelled items
    for item in order.get("items", []):
        if item.get("selected_color"):
            await db.products.update_one(
                {"id": item["product_id"], "colors.color_name": item["selected_color"]},
                {"$inc": {"colors.$.stock": item["quantity"]}}
            )
        else:
            await db.products.update_one(
                {"id": item["product_id"]},
                {"$inc": {"stock": item["quantity"]}}
            )
    
    # Update order status to cancelled
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "order_status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": "admin_approved_request",
            "cancel_request_status": "approved"
        }}
    )
    
    # Update cancel request
    await db.cancel_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "decided_at": datetime.now(timezone.utc).isoformat(),
            "decided_by": admin.get("email"),
            "admin_note": body.get("admin_note", "")
        }}
    )
    
    # Notify user about approval
    if cancel_req.get("user_id"):
        await create_notification(
            cancel_req["user_id"],
            "Cancellation Approved",
            f"Your cancellation request for order #{order_id[:8]} has been approved.",
            "order",
            "/profile"
        )
    
    # Notify each shop involved
    for shop_id in order.get("shop_ids", []):
        shop_items = [item for item in order.get("items", []) if item.get("shop_id") == shop_id]
        shop_total = sum(item.get("subtotal", 0) for item in shop_items)
        await create_notification(
            "shop",
            "Order Cancelled",
            f"Order #{order_id[:8]} was cancelled by admin. Your items total: ${shop_total:.2f}",
            "order",
            "/shop/orders",
            shop_id
        )
    
    # --- Loyalty: Clawback points earned on this order ---
    if order.get("user_id") and order.get("loyalty_points_earned", 0) > 0:
        earned = order["loyalty_points_earned"]
        await db.users.update_one(
            {"id": order["user_id"]},
            {"$inc": {
                "loyalty_points_balance": -earned,
                "loyalty_points_lifetime": -earned
            }}
        )
        u = await db.users.find_one({"id": order["user_id"]}, {"_id": 0, "loyalty_points_balance": 1, "loyalty_points_lifetime": 1})
        if u and u.get("loyalty_points_balance", 0) < 0:
            await db.users.update_one({"id": order["user_id"]}, {"$set": {"loyalty_points_balance": 0}})
        if u and u.get("loyalty_points_lifetime", 0) < 0:
            await db.users.update_one({"id": order["user_id"]}, {"$set": {"loyalty_points_lifetime": 0}})
        updated_u = await db.users.find_one({"id": order["user_id"]}, {"_id": 0, "loyalty_points_lifetime": 1})
        loyalty_s = await get_loyalty_settings()
        tiers = loyalty_s.get("tiers", get_default_loyalty_settings()["tiers"])
        new_tier = calc_tier(updated_u.get("loyalty_points_lifetime", 0) if updated_u else 0, tiers)
        await db.users.update_one({"id": order["user_id"]}, {"$set": {"loyalty_tier": new_tier["name"]}})
        await db.loyalty_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "order_id": order_id,
            "type": "clawback",
            "points": -earned,
            "description": f"Points reversed — order #{order_id[:8]} cancelled (admin approved)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # --- Loyalty: Refund redeemed points ---
    if order.get("user_id") and order.get("loyalty_points_redeemed", 0) > 0:
        redeemed = order["loyalty_points_redeemed"]
        await db.users.update_one(
            {"id": order["user_id"]},
            {"$inc": {"loyalty_points_balance": redeemed}}
        )
        await db.loyalty_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "order_id": order_id,
            "type": "refund",
            "points": redeemed,
            "description": f"Points refunded — order #{order_id[:8]} cancelled (admin approved)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # --- Wallet/Card Refund: Refund money to shop wallet if order was paid via wallet or card ---
    if order.get("wallet_paid") or order.get("payment_method") in ("wallet", "card"):
        refund_amount = order.get("total_amount", 0)
        created_by_shop = order.get("created_by_shop") or order.get("wallet_shop_id") or (order.get("shop_ids", [None])[0] if order.get("shop_ids") else None)
        if refund_amount > 0 and created_by_shop:
            # Refund to shop wallet
            await db.shops.update_one(
                {"id": created_by_shop},
                {"$inc": {"wallet_balance": refund_amount}}
            )
            shop_doc = await db.shops.find_one({"id": created_by_shop}, {"_id": 0, "name": 1, "wallet_balance": 1})
            await db.wallet_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "shop_id": created_by_shop,
                "shop_name": shop_doc.get("name", "") if shop_doc else "",
                "type": "order_refund",
                "amount": refund_amount,
                "balance_after": shop_doc.get("wallet_balance", 0) if shop_doc else refund_amount,
                "status": "completed",
                "note": f"Refund for cancelled order #{order_id[:8]}",
                "order_id": order_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            # If revenue was already distributed, reverse it
            if order.get("revenue_distributed"):
                # Reverse shop revenue
                for item in order.get("items", []):
                    sid = item.get("shop_id")
                    if sid:
                        orig_subtotal = item.get("original_subtotal", item.get("subtotal", 0))
                        await db.shops.update_one(
                            {"id": sid},
                            {"$inc": {"total_revenue": -orig_subtotal, "wallet_balance": -orig_subtotal}}
                        )
                # Remove admin commission
                await db.admin_revenue.delete_many({"order_id": order_id})
                # Remove held delivery fee
                await db.held_delivery_fees.delete_many({"order_id": order_id})
    
    return {"message": "Cancellation request approved. Order has been cancelled.", "order_id": order_id}


@router.post("/admin/cancel-requests/{request_id}/reject")
async def reject_cancel_request(request_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Reject a cancellation request"""
    cancel_req = await db.cancel_requests.find_one({"id": request_id}, {"_id": 0})
    if not cancel_req:
        raise HTTPException(status_code=404, detail="Cancellation request not found")
    if cancel_req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {cancel_req['status']}")
    
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    
    await db.cancel_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "rejected",
            "decided_at": datetime.now(timezone.utc).isoformat(),
            "decided_by": admin.get("email"),
            "admin_note": body.get("admin_note", "")
        }}
    )
    
    # Update the order's cancel request status
    await db.orders.update_one(
        {"id": cancel_req["order_id"]},
        {"$set": {"cancel_request_status": "rejected"}}
    )
    
    # Notify user about rejection
    if cancel_req.get("user_id"):
        await create_notification(
            cancel_req["user_id"],
            "Cancellation Rejected",
            f"Your cancellation request for order #{cancel_req['order_id'][:8]} was rejected. {body.get('admin_note', '')}",
            "order",
            "/profile"
        )
    
    return {"message": "Cancellation request rejected", "request_id": request_id}


@router.get("/admin/users/{user_id}/orders")
async def get_user_orders_admin(user_id: str, created_after: Optional[str] = None, admin: Dict = Depends(require_admin)):
    """Admin: Get all orders for a specific user, optionally filtered by created_after date"""
    query = {"user_id": user_id}
    if created_after:
        query["created_at"] = {"$gt": created_after}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return orders


@router.put("/admin/orders/{order_id}/loyalty-redemption")
async def admin_edit_order_redemption(order_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Adjust an order's redeemed loyalty points (reduce or remove)"""
    body = await request.json()
    new_points = int(body.get("loyalty_points_redeemed", 0))
    admin_note = body.get("admin_note", "")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_points = order.get("loyalty_points_redeemed", 0)
    if new_points < 0:
        raise HTTPException(status_code=400, detail="Redeemed points cannot be negative")
    if new_points > old_points:
        raise HTTPException(status_code=400, detail=f"Cannot increase redeemed points above original ({old_points})")
    
    # Get loyalty settings for redemption rate
    loyalty_settings = await get_loyalty_settings()
    redeem_rate = loyalty_settings.get("redeem_points_per_dollar", 100)
    
    # Recompute values
    old_discount = order.get("loyalty_discount_amount", 0)
    new_discount = calc_redemption_value(new_points, redeem_rate)
    discount_diff = old_discount - new_discount  # positive means we're reducing discount
    
    # Recalculate total_amount: add back the old discount, subtract the new one
    old_total = order.get("total_amount", 0)
    new_total = round(old_total + discount_diff, 2)
    
    # Recalculate commission and admin_owes
    original_commission = order.get("original_commission_amount", order.get("commission_amount", 0))
    new_commission = max(0, round(original_commission - new_discount, 2)) if new_discount > 0 else original_commission
    new_admin_owes = round(max(0, new_discount - original_commission), 2)
    
    # Points to return to user
    points_returned = old_points - new_points
    
    # Update order
    update = {
        "loyalty_points_redeemed": new_points,
        "loyalty_discount_amount": new_discount,
        "commission_amount": new_commission,
        "admin_owes_shop_amount": new_admin_owes,
        "total_amount": new_total,
    }
    await db.orders.update_one({"id": order_id}, {"$set": update})
    
    # Return points to user if applicable
    if points_returned > 0 and order.get("user_id"):
        await db.users.update_one(
            {"id": order["user_id"]},
            {"$inc": {"loyalty_points_balance": points_returned}}
        )
    
    # Write audit ledger entry
    ledger_entry = {
        "id": str(uuid.uuid4()),
        "user_id": order.get("user_id", ""),
        "order_id": order_id,
        "type": "admin_order_redemption_adjustment",
        "points": points_returned,
        "description": f"Admin adjusted order redemption: {old_points} → {new_points} pts (discount ${old_discount:.2f} → ${new_discount:.2f}). {admin_note}".strip(),
        "admin_email": admin.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.loyalty_ledger.insert_one(ledger_entry)
    
    logger.info(f"Admin {admin['email']} adjusted order {order_id} redemption: {old_points} → {new_points} pts")
    
    return {
        "message": f"Order redemption updated: {old_points} → {new_points} points",
        "order_id": order_id,
        "old_points": old_points,
        "new_points": new_points,
        "old_discount": old_discount,
        "new_discount": new_discount,
        "new_total": new_total,
        "points_returned_to_user": points_returned,
        "new_commission": new_commission,
        "new_admin_owes": new_admin_owes
    }


@router.get("/admin/users/{user_id}/points")
async def get_user_points_admin(user_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Get user's loyalty points details"""
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user_id,
        "name": user_data.get("name"),
        "email": user_data.get("email"),
        "loyalty_points_balance": user_data.get("loyalty_points_balance", 0),
        "loyalty_points_lifetime": user_data.get("loyalty_points_lifetime", 0),
        "loyalty_tier": user_data.get("loyalty_tier", "Bronze"),
    }


@router.put("/admin/users/{user_id}/points")
async def update_user_points_admin(user_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Edit a user's loyalty points balance and/or tier"""
    body = await request.json()
    
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {}
    ledger_entries = []
    
    # Handle points balance change
    new_balance = body.get("loyalty_points_balance")
    old_balance = user_data.get("loyalty_points_balance", 0)
    if new_balance is not None:
        new_balance = int(new_balance)
        if new_balance < 0:
            raise HTTPException(status_code=400, detail="Points balance cannot be negative")
        
        diff = new_balance - old_balance
        update_fields["loyalty_points_balance"] = new_balance
        
        # If increasing, also increase lifetime
        if diff > 0:
            new_lifetime = user_data.get("loyalty_points_lifetime", 0) + diff
            update_fields["loyalty_points_lifetime"] = new_lifetime
        
        if diff != 0:
            ledger_entries.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "admin_adjustment",
                "points": diff,
                "description": f"Admin adjusted points: {old_balance} → {new_balance} (by {admin.get('email')})",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Handle tier override
    new_tier_name = body.get("loyalty_tier")
    old_tier = user_data.get("loyalty_tier", "Bronze")
    if new_tier_name and new_tier_name != old_tier:
        loyalty_s = await get_loyalty_settings()
        tiers = loyalty_s.get("tiers", get_default_loyalty_settings()["tiers"])
        valid_tier = next((t for t in tiers if t["name"] == new_tier_name), None)
        if not valid_tier:
            raise HTTPException(status_code=400, detail=f"Invalid tier: {new_tier_name}")
        update_fields["loyalty_tier"] = new_tier_name
        
        ledger_entries.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "admin_tier_change",
            "points": 0,
            "description": f"Admin changed tier: {old_tier} → {new_tier_name} (by {admin.get('email')})",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.users.update_one({"id": user_id}, {"$set": update_fields})
    
    # Auto-update tier based on points if tier wasn't explicitly set
    if new_balance is not None and not new_tier_name:
        updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "loyalty_points_lifetime": 1})
        loyalty_s = await get_loyalty_settings()
        tiers = loyalty_s.get("tiers", get_default_loyalty_settings()["tiers"])
        auto_tier = calc_tier(updated_user.get("loyalty_points_lifetime", 0) if updated_user else 0, tiers)
        await db.users.update_one({"id": user_id}, {"$set": {"loyalty_tier": auto_tier["name"]}})
    
    # Write ledger entries
    for entry in ledger_entries:
        await db.loyalty_ledger.insert_one(entry)
    
    logger.info(f"Admin {admin['email']} updated user {user_data.get('email')}: {list(update_fields.keys())}")
    
    final_balance = new_balance if new_balance is not None else old_balance
    return {
        "message": "User loyalty updated",
        "user_id": user_id,
        "old_balance": old_balance,
        "new_balance": final_balance,
        "old_tier": old_tier,
        "new_tier": update_fields.get("loyalty_tier", old_tier)
    }


@router.post("/admin/team-members")
async def add_team_member(request: Request, admin: Dict = Depends(require_admin)):
    body = await request.json()
    name = body.get("name", "")
    photo = body.get("photo", "")
    # Generate default avatar if no photo provided
    if not photo or not photo.strip():
        photo = f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&background=6366f1&color=fff&size=200&bold=true"
    member = {
        "id": str(uuid.uuid4()),
        "name": name,
        "position": body.get("position", ""),
        "photo": photo,
        "order": body.get("order", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.team_members.insert_one({**member})
    return member


@router.put("/admin/team-members/{member_id}")
async def update_team_member(member_id: str, request: Request, admin: Dict = Depends(require_admin)):
    body = await request.json()
    update_data = {}
    for field in ["name", "position", "photo", "order"]:
        if field in body:
            update_data[field] = body[field]
    result = await db.team_members.find_one_and_update(
        {"id": member_id}, {"$set": update_data}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Team member not found")
    return result


@router.delete("/admin/team-members/{member_id}")
async def delete_team_member(member_id: str, admin: Dict = Depends(require_admin)):
    result = await db.team_members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    return {"message": "Team member deleted"}


@router.post("/admin/testimonials")
async def add_testimonial(request: Request, admin: Dict = Depends(require_admin)):
    body = await request.json()
    testimonial = {
        "id": str(uuid.uuid4()),
        "text": body.get("text", ""),
        "author": body.get("author", ""),
        "role": body.get("role", ""),
        "rating": body.get("rating", 5),
        "order": body.get("order", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.testimonials.insert_one({**testimonial})
    return testimonial


@router.put("/admin/testimonials/{testimonial_id}")
async def update_testimonial(testimonial_id: str, request: Request, admin: Dict = Depends(require_admin)):
    body = await request.json()
    update_data = {}
    for field in ["text", "author", "role", "rating", "order"]:
        if field in body:
            update_data[field] = body[field]
    result = await db.testimonials.find_one_and_update(
        {"id": testimonial_id}, {"$set": update_data}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return result


@router.delete("/admin/testimonials/{testimonial_id}")
async def delete_testimonial(testimonial_id: str, admin: Dict = Depends(require_admin)):
    result = await db.testimonials.delete_one({"id": testimonial_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return {"message": "Testimonial deleted"}


@router.put("/admin/revenue/adjust")
async def adjust_admin_revenue(request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Increase or decrease admin revenue by adding adjustment records"""
    body = await request.json()
    amount = body.get("amount", 0)
    description = body.get("description", "Manual adjustment")
    adjustment_type = body.get("type", "increase")  # increase or decrease

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    actual_amount = amount if adjustment_type == "increase" else -amount

    adjustment = {
        "id": str(uuid.uuid4()),
        "amount": actual_amount,
        "description": description,
        "type": adjustment_type,
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.revenue_adjustments.insert_one({**adjustment})

    return {"message": f"Revenue {'increased' if adjustment_type == 'increase' else 'decreased'} by ${amount:.2f}", "adjustment": adjustment}


@router.get("/admin/revenue/adjustments")
async def get_revenue_adjustments(admin: Dict = Depends(require_admin)):
    """Get all revenue adjustments"""
    adjustments = await db.revenue_adjustments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    total_adjustments = sum(a.get("amount", 0) for a in adjustments)
    return {"adjustments": adjustments, "total": total_adjustments}


@router.get("/admin/revenue/monthly-analytics")
async def get_monthly_revenue_analytics(admin: Dict = Depends(require_admin)):
    """Admin: Get detailed monthly revenue analytics for the Analytics page"""
    from collections import defaultdict
    
    # Get all paid orders
    all_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(10000)
    
    # Get subscription payments
    sub_payments = await db.subscription_payments.find({}, {"_id": 0}).to_list(1000)
    
    # Get adjustments
    adjustments = await db.revenue_adjustments.find({}, {"_id": 0}).to_list(1000)
    
    # Get platform_services (spin/boost) and monthly_credits from admin_ledger
    platform_services_entries = await db.admin_ledger.find({"type": "platform_services"}, {"_id": 0}).to_list(10000)
    monthly_credits_entries = await db.admin_ledger.find({"type": "monthly_credits"}, {"_id": 0}).to_list(10000)
    sub_ledger_entries = await db.admin_ledger.find({"type": "subscriptions"}, {"_id": 0}).to_list(10000)
    # Loyalty point deductions (shop payouts) and agent payouts (agent commission + approval bonus)
    loyalty_deduction_entries = await db.admin_ledger.find({"type": "loyalty_points_deduction"}, {"_id": 0}).to_list(10000)
    agent_payout_entries = await db.admin_ledger.find({"type": "agent_payouts"}, {"_id": 0}).to_list(10000)

    # Build monthly data
    monthly = defaultdict(lambda: {
        "orders": 0, "sales": 0, "commissions": 0, "subscriptions": 0,
        "adjustments": 0, "platform_services": 0, "monthly_credits": 0,
        "loyalty_deductions": 0, "agent_commission_payouts": 0, "agent_approval_bonus_payouts": 0,
        "items_sold": 0, "avg_order_value": 0,
        "order_list": []
    })
    
    for order in all_orders:
        created = order.get("created_at", "")
        if isinstance(created, str) and len(created) >= 7:
            month_key = created[:7]  # YYYY-MM
        else:
            continue
        monthly[month_key]["orders"] += 1
        monthly[month_key]["sales"] += order.get("total_amount", 0)
        monthly[month_key]["commissions"] += order.get("commission_amount", 0)
        monthly[month_key]["items_sold"] += sum(i.get("quantity", 1) for i in order.get("items", []))
    
    for pay in sub_payments:
        created = pay.get("created_at", "")
        if isinstance(created, str) and len(created) >= 7:
            month_key = created[:7]
        else:
            continue
        monthly[month_key]["subscriptions"] += pay.get("amount", 0)
    
    for entry in sub_ledger_entries:
        created = entry.get("created_at", "")
        if isinstance(created, str) and len(created) >= 7:
            month_key = created[:7]
            monthly[month_key]["subscriptions"] += entry.get("amount", 0)
    
    for adj in adjustments:
        created = adj.get("created_at", "")
        if isinstance(created, str) and len(created) >= 7:
            month_key = created[:7]
        else:
            continue
        monthly[month_key]["adjustments"] += adj.get("amount", 0)
    
    for entry in platform_services_entries:
        created = entry.get("created_at", "")
        if isinstance(created, str) and len(created) >= 7:
            month_key = created[:7]
            monthly[month_key]["platform_services"] += _ps_amount(entry)
    
    for entry in monthly_credits_entries:
        created = entry.get("created_at", "")
        if isinstance(created, str) and len(created) >= 7:
            month_key = created[:7]
            monthly[month_key]["monthly_credits"] += entry.get("amount", 0)

    for entry in loyalty_deduction_entries:
        created = entry.get("created_at", "")
        if isinstance(created, str) and len(created) >= 7:
            month_key = created[:7]
            # stored negative — accumulate as positive deduction
            monthly[month_key]["loyalty_deductions"] += abs(entry.get("amount", 0))

    for entry in agent_payout_entries:
        created = entry.get("created_at", "")
        if isinstance(created, str) and len(created) >= 7:
            month_key = created[:7]
            if entry.get("subtype") == "agent_commission":
                monthly[month_key]["agent_commission_payouts"] += entry.get("amount", 0)
            elif entry.get("subtype") == "agent_approval_bonus":
                monthly[month_key]["agent_approval_bonus_payouts"] += entry.get("amount", 0)

    # Calculate avg order value & admin_profit per month
    for key, data in monthly.items():
        if data["orders"] > 0:
            data["avg_order_value"] = round(data["sales"] / data["orders"], 2)
        # Admin profit formula: subs + commissions + adjustments + platform_services
        #   - monthly_credits - loyalty_deductions (shop payouts) - agent payouts
        data["admin_profit"] = round(
            data["subscriptions"] + data["commissions"] + data["adjustments"]
            + data["platform_services"] - data["monthly_credits"]
            - data["loyalty_deductions"] - data["agent_commission_payouts"]
            - data["agent_approval_bonus_payouts"], 2
        )
        # Keep legacy total_revenue key for backward compat but now equals profit
        data["total_revenue"] = data["admin_profit"]
    
    # Sort by month
    sorted_monthly = dict(sorted(monthly.items(), reverse=True))
    
    # Calculate totals
    total_sales = sum(d["sales"] for d in monthly.values())
    total_commissions = sum(d["commissions"] for d in monthly.values())
    total_subscriptions = sum(d["subscriptions"] for d in monthly.values())
    total_adjustments_val = sum(d["adjustments"] for d in monthly.values())
    total_platform_services_val = sum(d["platform_services"] for d in monthly.values())
    total_monthly_credits_val = sum(d["monthly_credits"] for d in monthly.values())
    total_loyalty_deductions_val = sum(d["loyalty_deductions"] for d in monthly.values())
    total_agent_commission_val = sum(d["agent_commission_payouts"] for d in monthly.values())
    total_agent_approval_bonus_val = sum(d["agent_approval_bonus_payouts"] for d in monthly.values())
    total_orders = sum(d["orders"] for d in monthly.values())
    total_items = sum(d["items_sold"] for d in monthly.values())
    total_admin_profit = round(
        total_commissions + total_subscriptions + total_adjustments_val
        + total_platform_services_val - total_monthly_credits_val
        - total_loyalty_deductions_val - total_agent_commission_val
        - total_agent_approval_bonus_val, 2
    )

    # Get current month key
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    current_month_data = monthly.get(current_month, {
        "orders": 0, "sales": 0, "commissions": 0, "subscriptions": 0,
        "adjustments": 0, "platform_services": 0, "monthly_credits": 0,
        "loyalty_deductions": 0, "agent_commission_payouts": 0, "agent_approval_bonus_payouts": 0,
        "items_sold": 0, "avg_order_value": 0, "total_revenue": 0, "admin_profit": 0
    })
    
    # Top shops this month
    top_shops = {}
    for order in all_orders:
        created = order.get("created_at", "")
        if isinstance(created, str) and created[:7] == current_month:
            for item in order.get("items", []):
                sn = item.get("shop_name", "Unknown")
                if sn not in top_shops:
                    top_shops[sn] = {"revenue": 0, "orders": 0}
                top_shops[sn]["revenue"] += item.get("subtotal", 0)
                top_shops[sn]["orders"] += 1
    
    top_shops_list = sorted(
        [{"name": k, **v} for k, v in top_shops.items()],
        key=lambda x: x["revenue"], reverse=True
    )[:10]

    # ---- Daily breakdown (YYYY-MM-DD) so the dashboard can filter profit by day ----
    daily = defaultdict(lambda: {
        "orders": 0, "sales": 0, "commissions": 0, "subscriptions": 0,
        "adjustments": 0, "platform_services": 0, "monthly_credits": 0,
        "loyalty_deductions": 0, "agent_commission_payouts": 0, "agent_approval_bonus_payouts": 0,
        "items_sold": 0, "avg_order_value": 0,
    })

    def _dkey(doc):
        c = doc.get("created_at", "")
        return c[:10] if isinstance(c, str) and len(c) >= 10 else None

    for order in all_orders:
        k = _dkey(order)
        if not k:
            continue
        daily[k]["orders"] += 1
        daily[k]["sales"] += order.get("total_amount", 0)
        daily[k]["commissions"] += order.get("commission_amount", 0)
        daily[k]["items_sold"] += sum(i.get("quantity", 1) for i in order.get("items", []))
    for pay in sub_payments:
        k = _dkey(pay)
        if k:
            daily[k]["subscriptions"] += pay.get("amount", 0)
    for entry in sub_ledger_entries:
        k = _dkey(entry)
        if k:
            daily[k]["subscriptions"] += entry.get("amount", 0)
    for adj in adjustments:
        k = _dkey(adj)
        if k:
            daily[k]["adjustments"] += adj.get("amount", 0)
    for entry in platform_services_entries:
        k = _dkey(entry)
        if k:
            daily[k]["platform_services"] += _ps_amount(entry)
    for entry in monthly_credits_entries:
        k = _dkey(entry)
        if k:
            daily[k]["monthly_credits"] += entry.get("amount", 0)
    for entry in loyalty_deduction_entries:
        k = _dkey(entry)
        if k:
            daily[k]["loyalty_deductions"] += abs(entry.get("amount", 0))
    for entry in agent_payout_entries:
        k = _dkey(entry)
        if k:
            if entry.get("subtype") == "agent_commission":
                daily[k]["agent_commission_payouts"] += entry.get("amount", 0)
            elif entry.get("subtype") == "agent_approval_bonus":
                daily[k]["agent_approval_bonus_payouts"] += entry.get("amount", 0)
    for _k, d in daily.items():
        if d["orders"] > 0:
            d["avg_order_value"] = round(d["sales"] / d["orders"], 2)
        d["admin_profit"] = round(
            d["subscriptions"] + d["commissions"] + d["adjustments"]
            + d["platform_services"] - d["monthly_credits"]
            - d["loyalty_deductions"] - d["agent_commission_payouts"]
            - d["agent_approval_bonus_payouts"], 2
        )
        d["total_revenue"] = d["admin_profit"]
    sorted_daily = dict(sorted(daily.items(), reverse=True))

    return {
        "monthly": sorted_monthly,
        "daily": sorted_daily,
        "current_month": current_month_data,
        "current_month_key": current_month,
        "totals": {
            "sales": total_sales,
            "commissions": total_commissions,
            "subscriptions": total_subscriptions,
            "adjustments": total_adjustments_val,
            "platform_services": total_platform_services_val,
            "monthly_credits": total_monthly_credits_val,
            "loyalty_deductions": total_loyalty_deductions_val,
            "agent_commission_payouts": total_agent_commission_val,
            "agent_approval_bonus_payouts": total_agent_approval_bonus_val,
            "admin_profit": total_admin_profit,
            "total_revenue": total_admin_profit,  # legacy alias
            "orders": total_orders,
            "items_sold": total_items,
            "avg_order_value": round(total_sales / total_orders, 2) if total_orders > 0 else 0
        },
        "top_shops_this_month": top_shops_list
    }


@router.get("/admin/report/pdf")
async def generate_pdf_report(admin: Dict = Depends(require_admin)):
    """Admin: Generate comprehensive PDF report of the website"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import inch
    import io

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=22, textColor=colors.HexColor('#4f46e5'), spaceAfter=20)
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#1e293b'), spaceBefore=16, spaceAfter=8)
    normal_style = styles['Normal']

    # Title
    story.append(Paragraph("OpenMarketlb - Platform Report", title_style))
    story.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}", normal_style))
    story.append(Spacer(1, 20))

    # Users Stats
    total_users = await db.users.count_documents({})
    admin_users = await db.users.count_documents({"role": "admin"})
    shop_users = await db.users.count_documents({"role": "shop"})
    delivery_users = await db.users.count_documents({"role": "delivery"})
    regular_users = await db.users.count_documents({"role": "user"})

    story.append(Paragraph("User Statistics", heading_style))
    user_data = [
        ["Category", "Count"],
        ["Total Users", str(total_users)],
        ["Admins", str(admin_users)],
        ["Shop Owners", str(shop_users)],
        ["Delivery Personnel", str(delivery_users)],
        ["Regular Users", str(regular_users)],
    ]
    t = Table(user_data, colWidths=[3*inch, 2*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

    # Products Stats
    total_products = await db.products.count_documents({})
    active_products = await db.products.count_documents({"is_active": True})
    story.append(Paragraph("Product Statistics", heading_style))
    prod_data = [
        ["Metric", "Value"],
        ["Total Products", str(total_products)],
        ["Active Products", str(active_products)],
        ["Inactive Products", str(total_products - active_products)],
    ]
    # Categories
    categories = await db.categories.find({}, {"_id": 0, "name": 1}).to_list(100)
    prod_data.append(["Total Categories", str(len(categories))])

    t2 = Table(prod_data, colWidths=[3*inch, 2*inch])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdf4')]),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(t2)
    story.append(Spacer(1, 12))

    # Orders Stats
    total_orders = await db.orders.count_documents({})
    paid_orders = await db.orders.count_documents({"payment_status": "paid"})
    pending_orders = await db.orders.count_documents({"order_status": "pending"})
    delivered_orders = await db.orders.count_documents({"order_status": "delivered"})
    cancelled_orders = await db.orders.count_documents({"order_status": "cancelled"})

    all_paid = await db.orders.find({"payment_status": "paid"}, {"_id": 0, "total_amount": 1, "commission_amount": 1}).to_list(10000)
    total_sales = sum(o.get("total_amount", 0) for o in all_paid)
    total_commission = sum(o.get("commission_amount", 0) for o in all_paid)

    story.append(Paragraph("Order & Revenue Statistics", heading_style))
    order_data = [
        ["Metric", "Value"],
        ["Total Orders", str(total_orders)],
        ["Paid Orders", str(paid_orders)],
        ["Pending Orders", str(pending_orders)],
        ["Delivered Orders", str(delivered_orders)],
        ["Cancelled Orders", str(cancelled_orders)],
        ["Total Sales Revenue", f"${total_sales:,.2f}"],
        ["Total Commission Earned", f"${total_commission:,.2f}"],
    ]

    # Revenue adjustments
    adjustments = await db.revenue_adjustments.find({}, {"_id": 0, "amount": 1}).to_list(1000)
    total_adj = sum(a.get("amount", 0) for a in adjustments)
    if total_adj != 0:
        order_data.append(["Revenue Adjustments", f"${total_adj:,.2f}"])

    # Subscriptions
    sub_payments = await db.subscription_payments.find({}, {"_id": 0, "amount": 1}).to_list(1000)
    total_sub = sum(p.get("amount", 0) for p in sub_payments)
    order_data.append(["Subscription Revenue", f"${total_sub:,.2f}"])
    order_data.append(["Total Admin Revenue", f"${total_commission + total_sub + total_adj:,.2f}"])

    t3 = Table(order_data, colWidths=[3*inch, 2*inch])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fffbeb')]),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(t3)
    story.append(Spacer(1, 12))

    # Shops Stats
    total_shops = await db.shops.count_documents({})
    approved_shops = await db.shops.count_documents({"status": "approved"})
    active_sub_shops = await db.shops.count_documents({"subscription_status": {"$in": ["active", "trial"]}})

    story.append(Paragraph("Shop Statistics", heading_style))
    shop_data = [
        ["Metric", "Value"],
        ["Total Shops", str(total_shops)],
        ["Approved Shops", str(approved_shops)],
        ["Active Subscriptions", str(active_sub_shops)],
    ]
    t4 = Table(shop_data, colWidths=[3*inch, 2*inch])
    t4.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f3ff')]),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(t4)

    # Top shops by revenue
    shops_list = await db.shops.find({"status": "approved"}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    if shops_list:
        story.append(Spacer(1, 8))
        story.append(Paragraph("Top Shops by Revenue", heading_style))
        shop_rev_data = [["Shop Name", "Orders", "Revenue"]]
        for shop in shops_list[:10]:
            shop_orders = await db.orders.find({"shop_ids": shop["id"], "payment_status": "paid"}, {"_id": 0, "total_amount": 1, "items": 1}).to_list(10000)
            shop_revenue = 0
            for o in shop_orders:
                for item in o.get("items", []):
                    if item.get("shop_id") == shop["id"]:
                        shop_revenue += item.get("subtotal", 0)
            shop_rev_data.append([shop.get("name", "N/A"), str(len(shop_orders)), f"${shop_revenue:,.2f}"])

        if len(shop_rev_data) > 1:
            t5 = Table(shop_rev_data, colWidths=[2.5*inch, 1.25*inch, 1.25*inch])
            t5.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#eef2ff')]),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(t5)

    # ============ MONTHLY REVENUE BREAKDOWN ============
    story.append(Spacer(1, 16))
    story.append(Paragraph("Monthly Revenue Breakdown", heading_style))
    
    from collections import defaultdict as dd
    monthly_data = dd(lambda: {"orders": 0, "sales": 0, "commissions": 0, "subscriptions": 0, "adjustments": 0})
    
    all_orders_for_monthly = await db.orders.find({}, {"_id": 0, "created_at": 1, "total_amount": 1, "commission_amount": 1}).to_list(10000)
    for order in all_orders_for_monthly:
        ca = order.get("created_at", "")
        if isinstance(ca, str) and len(ca) >= 7:
            mk = ca[:7]
            monthly_data[mk]["orders"] += 1
            monthly_data[mk]["sales"] += order.get("total_amount", 0)
            monthly_data[mk]["commissions"] += order.get("commission_amount", 0)
    
    for pay in sub_payments:
        ca = pay.get("created_at", "")
        if isinstance(ca, str) and len(ca) >= 7:
            monthly_data[ca[:7]]["subscriptions"] += pay.get("amount", 0)
    
    adj_list = await db.revenue_adjustments.find({}, {"_id": 0}).to_list(1000)
    monthly_adj_details = dd(list)
    for adj in adj_list:
        ca = adj.get("created_at", "")
        if isinstance(ca, str) and len(ca) >= 7:
            mk = ca[:7]
            monthly_data[mk]["adjustments"] += adj.get("amount", 0)
            monthly_adj_details[mk].append(adj)
    
    sorted_months = sorted(monthly_data.keys(), reverse=True)[:12]
    
    if sorted_months:
        month_table = [["Month", "Orders", "Sales", "Commissions", "Subscriptions", "Adjustments", "Total Revenue"]]
        for mk in sorted_months:
            d = monthly_data[mk]
            total_rev = d["commissions"] + d["subscriptions"] + d["adjustments"]
            try:
                month_label = datetime.strptime(mk + "-01", "%Y-%m-%d").strftime("%b %Y")
            except:
                month_label = mk
            month_table.append([
                month_label,
                str(d["orders"]),
                f"${d['sales']:,.2f}",
                f"${d['commissions']:,.2f}",
                f"${d['subscriptions']:,.2f}",
                f"${d['adjustments']:,.2f}",
                f"${total_rev:,.2f}"
            ])
        
        t6 = Table(month_table, colWidths=[0.9*inch, 0.6*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.9*inch])
        t6.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0ea5e9')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f9ff')]),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ]))
        story.append(t6)
        
        # Show adjustment details per month if any
        for mk in sorted_months:
            if monthly_adj_details.get(mk):
                try:
                    month_label = datetime.strptime(mk + "-01", "%Y-%m-%d").strftime("%b %Y")
                except:
                    month_label = mk
                adj_sub_style = ParagraphStyle('AdjSub', parent=normal_style, fontSize=9, textColor=colors.HexColor('#6b7280'), spaceBefore=4)
                story.append(Spacer(1, 4))
                story.append(Paragraph(f"Adjustments in {month_label}:", adj_sub_style))
                for adj in monthly_adj_details[mk]:
                    sign = "+" if adj.get("amount", 0) >= 0 else ""
                    reason = adj.get("description", "No reason provided")
                    story.append(Paragraph(f"  {sign}${adj.get('amount', 0):,.2f} — {reason}", adj_sub_style))

    doc.build(story)
    buffer.seek(0)

    from starlette.responses import StreamingResponse
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=openmarketlb_report_{datetime.now().strftime('%Y%m%d')}.pdf"}
    )


@router.get("/admin/blocked-ips")
async def get_blocked_ips(admin: Dict = Depends(require_admin)):
    """Get all blocked IPs"""
    blocked = await db.blocked_ips.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return blocked


@router.post("/admin/blocked-ips")
async def block_ip(request: Request, admin: Dict = Depends(require_admin)):
    """Block an IP address"""
    body = await request.json()
    ip_address = body.get("ip_address", "").strip()
    name = body.get("name", "").strip()

    if not ip_address:
        raise HTTPException(status_code=400, detail="IP address is required")

    existing = await db.blocked_ips.find_one({"ip_address": ip_address})
    if existing:
        raise HTTPException(status_code=400, detail="This IP is already blocked")

    blocked = {
        "id": str(uuid.uuid4()),
        "ip_address": ip_address,
        "name": name,
        "blocked_by": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.blocked_ips.insert_one({**blocked})
    return blocked


@router.delete("/admin/blocked-ips/{block_id}")
async def unblock_ip(block_id: str, admin: Dict = Depends(require_admin)):
    """Unblock an IP address"""
    result = await db.blocked_ips.delete_one({"id": block_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blocked IP not found")
    return {"message": "IP unblocked"}


@router.get("/admin/loyalty/settings")
async def admin_get_loyalty_settings(admin: Dict = Depends(require_admin)):
    """Get loyalty program settings"""
    settings = await get_loyalty_settings()
    allowed_keys = ["tiers", "bonus_events", "double_points_weekend_enabled", "birthday_bonus_enabled", "birthday_bonus_points", "first_purchase_bonus_enabled", "first_purchase_bonus_points", "first_purchase_bonus_display", "points_per_dollar", "redeem_points_per_dollar", "loyalty_enabled"]
    result = {k: v for k, v in settings.items() if k in allowed_keys}
    if "first_purchase_bonus_display" not in result:
        result["first_purchase_bonus_display"] = "none"
    return result


@router.put("/admin/loyalty/settings")
async def admin_update_loyalty_settings(settings_data: Dict[str, Any], admin: Dict = Depends(require_admin)):
    """Update loyalty program settings"""
    allowed_keys = [
        "loyalty_enabled", "points_per_dollar", "redeem_points_per_dollar",
        "loyalty_tiers", "double_points_weekend_enabled", "birthday_bonus_enabled",
        "birthday_bonus_points", "first_purchase_bonus_enabled", "first_purchase_bonus_points",
        "first_purchase_bonus_display", "bonus_events"
    ]
    
    update_fields = {}
    for k, v in settings_data.items():
        if k == "tiers" and isinstance(v, list):
            # Store loyalty tiers separately to avoid conflict with subscription tiers
            update_fields["loyalty_tiers"] = v
        elif k in allowed_keys:
            update_fields[k] = v
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.platform_settings.find_one_and_update(
        {"id": "platform"},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0},
        upsert=True
    )
    return {"message": "Loyalty settings updated", "settings": {k: result.get(k) for k in allowed_keys if k in result}}


@router.get("/admin/loyalty/analytics")
async def admin_loyalty_analytics(admin: Dict = Depends(require_admin)):
    """Get loyalty program analytics"""
    # Total points issued
    earn_pipeline = [
        {"$match": {"type": "earn"}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]
    earn_result = await db.loyalty_ledger.aggregate(earn_pipeline).to_list(1)
    total_issued = earn_result[0]["total"] if earn_result else 0
    
    # Total points redeemed
    redeem_pipeline = [
        {"$match": {"type": "redeem"}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]
    redeem_result = await db.loyalty_ledger.aggregate(redeem_pipeline).to_list(1)
    total_redeemed = redeem_result[0]["total"] if redeem_result else 0
    
    # Active members per tier
    all_users = await db.users.find(
        {"role": "user", "loyalty_points_lifetime": {"$gt": 0}},
        {"_id": 0, "loyalty_points_lifetime": 1, "loyalty_tier": 1}
    ).to_list(10000)
    
    settings = await get_loyalty_settings()
    tiers = settings.get("tiers", get_default_loyalty_settings()["tiers"])
    # Ensure tiers is a list (not subscription tiers dict)
    if not isinstance(tiers, list):
        tiers = get_default_loyalty_settings()["tiers"]
    
    tier_counts = {}
    for tier in tiers:
        tier_counts[tier["name"]] = 0
    
    for u in all_users:
        lt = u.get("loyalty_points_lifetime", 0)
        t = calc_tier(lt, tiers)
        tier_counts[t["name"]] = tier_counts.get(t["name"], 0) + 1
    
    # Total users with loyalty
    total_members = await db.users.count_documents({"role": "user"})
    active_members = len(all_users)
    
    # Total discount given
    discount_pipeline = [
        {"$match": {"loyalty_discount_amount": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$loyalty_discount_amount"}}}
    ]
    discount_result = await db.orders.aggregate(discount_pipeline).to_list(1)
    total_discount_given = discount_result[0]["total"] if discount_result else 0
    
    return {
        "total_points_issued": total_issued,
        "total_points_redeemed": abs(total_redeemed),
        "total_points_outstanding": total_issued - abs(total_redeemed),
        "total_members": total_members,
        "active_members": active_members,
        "tier_breakdown": tier_counts,
        "total_discount_given": round(total_discount_given, 2),
        "settings": {
            "loyalty_enabled": settings.get("loyalty_enabled", True),
            "points_per_dollar": settings.get("points_per_dollar", 1),
            "redeem_rate": settings.get("redeem_points_per_dollar", 100),
        }
    }


@router.post("/admin/loyalty/bonus-event")
async def admin_add_bonus_event(event_data: Dict[str, Any], admin: Dict = Depends(require_admin)):
    """Add a bonus event - type: 'multiplier' or 'added_points'"""
    event = {
        "id": str(uuid.uuid4()),
        "name": event_data.get("name", ""),
        "description": event_data.get("description", ""),
        "type": event_data.get("type", "multiplier"),  # 'multiplier' or 'added_points'
        "multiplier": event_data.get("multiplier", 2.0),
        "added_points": event_data.get("added_points", 100),
        "display_mode": event_data.get("display_mode", "center"),  # 'center' (modal) or 'side' (toast-like)
        "start_date": event_data.get("start_date", ""),
        "end_date": event_data.get("end_date", ""),
        "is_active": event_data.get("is_active", True),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$push": {"bonus_events": event}},
        upsert=True
    )
    return {"message": "Bonus event added", "event": event}


@router.delete("/admin/loyalty/bonus-event/{event_id}")
async def admin_delete_bonus_event(event_id: str, admin: Dict = Depends(require_admin)):
    """Delete a bonus event"""
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$pull": {"bonus_events": {"id": event_id}}}
    )
    return {"message": "Bonus event deleted"}


@router.get("/admin/events")
async def admin_get_events(admin: Dict = Depends(require_admin)):
    """Get all admin events"""
    events = await db.admin_events.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return events


@router.post("/admin/events")
async def admin_create_event(event_data: Dict[str, Any], admin: Dict = Depends(require_admin)):
    """Create a general admin event"""
    event = {
        "id": str(uuid.uuid4()),
        "title": event_data.get("title", ""),
        "description": event_data.get("description", ""),
        "image_url": event_data.get("image_url", ""),
        "cta_text": event_data.get("cta_text", ""),
        "cta_link": event_data.get("cta_link", ""),
        "display_mode": event_data.get("display_mode", "center"),  # center, side_fixed, side_toast, home_banner
        "audience": event_data.get("audience", "all_visitors"),  # all_visitors, users_logged_in, shops_logged_in, shops_and_users_logged_in
        "popup_color": event_data.get("popup_color", ""),
        # Home banner-specific fields (only used when display_mode == "home_banner")
        "filter_category_id": event_data.get("filter_category_id", ""),
        "filter_category_ids": event_data.get("filter_category_ids", []),
        "filter_gender": event_data.get("filter_gender", ""),  # men/women/kids or ""
        "filter_search": event_data.get("filter_search", ""),
        "filter_discount_only": bool(event_data.get("filter_discount_only", False)),
        "filter_min_price": event_data.get("filter_min_price"),
        "filter_max_price": event_data.get("filter_max_price"),
        "filter_shop_id": event_data.get("filter_shop_id", ""),
        "banner_subtitle": event_data.get("banner_subtitle", ""),
        "banner_accent_color": event_data.get("banner_accent_color", ""),  # gradient accent for banner
        "banner_text_color": event_data.get("banner_text_color", "#ffffff"),
        "banner_order": event_data.get("banner_order", 0),  # for ordering banners
        # Event/Campaign sponsorship (shops pay from wallet to be featured)
        "sponsorship_enabled": bool(event_data.get("sponsorship_enabled", False)),
        "sponsorship_price": event_data.get("sponsorship_price"),
        "sponsorship_price_per_day": event_data.get("sponsorship_price_per_day", event_data.get("sponsorship_price")),
        "sponsoring_shops": event_data.get("sponsoring_shops", []),
        "current_sponsor": None,
        "start_date": event_data.get("start_date", ""),
        "end_date": event_data.get("end_date", ""),
        "is_active": event_data.get("is_active", True),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_events.insert_one(event)
    # Return without _id
    event.pop("_id", None)
    return {"message": "Event created", "event": event}


@router.put("/admin/events/{event_id}")
async def admin_update_event(event_id: str, event_data: Dict[str, Any], admin: Dict = Depends(require_admin)):
    """Update an admin event"""
    allowed = ["title", "description", "image_url", "cta_text", "cta_link", "display_mode", "popup_color", "audience",
               "filter_category_id", "filter_category_ids", "filter_gender", "filter_search", "filter_discount_only",
               "filter_min_price", "filter_max_price", "filter_shop_id",
               "banner_subtitle", "banner_accent_color", "banner_text_color", "banner_order",
               "sponsorship_enabled", "sponsorship_price", "sponsorship_price_per_day",
               "start_date", "end_date", "is_active"]
    update = {k: v for k, v in event_data.items() if k in allowed}
    # Sync per-day pricing with legacy field
    if "sponsorship_price_per_day" in update and "sponsorship_price" not in update:
        update["sponsorship_price"] = update["sponsorship_price_per_day"]
    if "sponsorship_price" in update and "sponsorship_price_per_day" not in update:
        update["sponsorship_price_per_day"] = update["sponsorship_price"]
    result = await db.admin_events.find_one_and_update(
        {"id": event_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event updated", "event": result}


@router.delete("/admin/events/{event_id}")
async def admin_delete_event(event_id: str, admin: Dict = Depends(require_admin)):
    """Delete an admin event"""
    await db.admin_events.delete_one({"id": event_id})
    return {"message": "Event deleted"}


@router.put("/admin/shops/{shop_id}/wallet/add")
async def admin_add_wallet_funds(shop_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin adds money to shop wallet"""
    body = await request.json()
    amount = body.get("amount", 0)
    note = body.get("note", "Admin top-up")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    now = datetime.now(timezone.utc)
    new_balance = (shop.get("wallet_balance", 0) or 0) + amount
    
    await db.shops.update_one({"id": shop_id}, {"$set": {"wallet_balance": new_balance}})
    
    txn = {
        "id": str(uuid.uuid4()),
        "shop_id": shop_id,
        "shop_name": shop.get("name", ""),
        "type": "admin_topup",
        "amount": amount,
        "balance_after": new_balance,
        "status": "completed",
        "note": note,
        "admin_id": admin["user_id"],
        "created_at": now.isoformat()
    }
    await db.wallet_transactions.insert_one(txn)
    
    # Record as platform services debit (reduces admin profit/money held)
    await db.admin_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "type": "platform_services",
        "subtype": "shop_wallet_topup",
        "amount": amount,
        "direction": "debit",
        "shop_id": shop_id,
        "shop_name": shop.get("name", ""),
        "ref_id": txn["id"],
        "note": f"Wallet top-up for {shop.get('name', '')} - {note}",
        "created_at": now.isoformat()
    })
    
    # Mark any pending requests as fulfilled
    await db.wallet_transactions.update_many(
        {"shop_id": shop_id, "type": "topup_request", "status": "pending"},
        {"$set": {"status": "fulfilled"}}
    )

    # Notify the shop that funds were added to their wallet
    try:
        await create_notification(
            recipient_type="shop",
            title="💰 Funds Added to Your Wallet",
            message=f"${amount:.2f} has been added to your wallet by admin. Your new balance is ${new_balance:.2f}.",
            notification_type="wallet",
            link="/shop/wallet",
            recipient_id=shop_id,
        )
    except Exception as e:
        logger.error(f"Failed to create wallet top-up notification for shop {shop_id}: {e}")

    return {"message": f"Added ${amount:.2f} to wallet", "new_balance": new_balance}


@router.get("/admin/shops/{shop_id}/wallet")
async def admin_get_shop_wallet(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Get shop wallet info"""
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "wallet_balance": 1, "name": 1, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    transactions = await db.wallet_transactions.find({"shop_id": shop_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"balance": shop.get("wallet_balance", 0), "transactions": transactions, "shop_name": shop.get("name")}


@router.get("/admin/wallet/requests")
async def admin_get_all_wallet_requests(status: Optional[str] = None, admin: Dict = Depends(require_admin)):
    """Admin: Get all wallet top-up requests across all shops with shop info"""
    query = {"type": "topup_request"}
    if status:
        query["status"] = status
    
    requests = await db.wallet_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with shop balance info
    shop_ids = list(set(r.get("shop_id") for r in requests if r.get("shop_id")))
    shops = {}
    if shop_ids:
        shop_docs = await db.shops.find(
            {"id": {"$in": shop_ids}}, 
            {"_id": 0, "id": 1, "name": 1, "wallet_balance": 1, "tier": 1, "logo": 1}
        ).to_list(200)
        shops = {s["id"]: s for s in shop_docs}
    
    for req in requests:
        shop = shops.get(req.get("shop_id"), {})
        req["shop_wallet_balance"] = shop.get("wallet_balance", 0)
        req["shop_tier"] = shop.get("tier", "starter")
        req["shop_logo"] = shop.get("logo", "")
    
    return {"requests": requests}


@router.put("/admin/shops/{shop_id}/wallet/decrease")
async def admin_decrease_wallet_funds(shop_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin decreases money from shop wallet"""
    body = await request.json()
    amount = body.get("amount", 0)
    note = body.get("note", "Admin deduction")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    current_balance = shop.get("wallet_balance", 0) or 0
    new_balance = max(0, round(current_balance - amount, 2))
    
    now = datetime.now(timezone.utc)
    await db.shops.update_one({"id": shop_id}, {"$set": {"wallet_balance": new_balance}})
    
    txn = {
        "id": str(uuid.uuid4()),
        "shop_id": shop_id,
        "shop_name": shop.get("name", ""),
        "type": "admin_deduction",
        "amount": -amount,
        "balance_after": new_balance,
        "status": "completed",
        "note": note,
        "admin_id": admin["user_id"],
        "created_at": now.isoformat()
    }
    await db.wallet_transactions.insert_one(txn)
    
    return {"message": f"Deducted ${amount:.2f} from wallet", "new_balance": new_balance}


@router.post("/admin/wallet/bulk-add")
async def admin_bulk_add_wallet(request: Request, admin: Dict = Depends(require_admin)):
    """Admin adds a specific amount to ALL active shops at once"""
    body = await request.json()
    amount = body.get("amount", 0)
    note = body.get("note", "Bulk wallet top-up by admin")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    shops = await db.shops.find({"subscription_status": {"$in": ["active", "trial"]}}).to_list(1000)
    if not shops:
        return {"message": "No active shops found", "updated": 0}
    
    now = datetime.now(timezone.utc)
    count = 0
    for shop in shops:
        new_balance = round((shop.get("wallet_balance", 0) or 0) + amount, 2)
        await db.shops.update_one({"id": shop["id"]}, {"$set": {"wallet_balance": new_balance}})
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "type": "admin_bulk_topup",
            "amount": amount,
            "balance_after": new_balance,
            "status": "completed",
            "note": note,
            "admin_id": admin["user_id"],
            "created_at": now.isoformat()
        })
        count += 1
    
    return {"message": f"Added ${amount:.2f} to {count} shops", "updated": count}


@router.get("/admin/cashout-requests")
async def admin_get_cashout_requests(status: Optional[str] = None, admin: Dict = Depends(require_admin)):
    """Admin: Get all cash out requests"""
    query = {}
    if status:
        query["status"] = status
    
    requests_list = await db.cashout_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with shop info
    shop_ids = list(set(r.get("shop_id") for r in requests_list if r.get("shop_id")))
    shops = {}
    if shop_ids:
        shop_docs = await db.shops.find(
            {"id": {"$in": shop_ids}},
            {"_id": 0, "id": 1, "name": 1, "wallet_balance": 1, "tier": 1, "logo": 1, "email": 1, "phone": 1, "total_revenue": 1}
        ).to_list(500)
        shops = {s["id"]: s for s in shop_docs}
    
    for req in requests_list:
        shop = shops.get(req.get("shop_id"), {})
        req["shop_wallet_balance"] = shop.get("wallet_balance", 0)
        req["shop_tier"] = shop.get("tier", "starter")
        req["shop_logo"] = shop.get("logo", "")
        req["shop_email"] = shop.get("email", "")
        req["shop_phone"] = shop.get("phone", "")
        req["shop_total_revenue"] = shop.get("total_revenue", 0)
    
    return {"requests": requests_list}


@router.get("/admin/cashout-settings")
async def get_cashout_settings(admin: Dict = Depends(require_admin)):
    """Get minimum cashout amount"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    return {"min_cashout_amount": settings.get("min_cashout_amount", 5.0) if settings else 5.0}


@router.put("/admin/cashout-settings")
async def update_cashout_settings(request: Request, admin: Dict = Depends(require_admin)):
    """Update minimum cashout amount"""
    body = await request.json()
    min_amount = body.get("min_cashout_amount")
    if min_amount is None or float(min_amount) < 0:
        raise HTTPException(status_code=400, detail="Invalid minimum amount")
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": {"min_cashout_amount": float(min_amount)}},
        upsert=True
    )
    return {"message": f"Minimum cashout amount updated to ${float(min_amount):.2f}", "min_cashout_amount": float(min_amount)}


@router.put("/admin/cashout-requests/{request_id}/approve")
async def admin_approve_cashout(request_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Approve a cash out request"""
    cashout = await db.cashout_requests.find_one({"id": request_id}, {"_id": 0})
    if not cashout:
        raise HTTPException(status_code=404, detail="Cash out request not found")
    if cashout["status"] != "pending":
        raise HTTPException(status_code=400, detail="This request is already processed")
    
    now = datetime.now(timezone.utc)
    
    # Update cashout status
    await db.cashout_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "approved_by": admin["user_id"], "updated_at": now.isoformat()}}
    )
    
    # Update wallet transaction status
    await db.wallet_transactions.update_many(
        {"cashout_id": request_id},
        {"$set": {"status": "completed"}}
    )
    
    # Notify shop
    await create_notification(cashout["shop_id"], "Cash Out Approved", f"Your cash out request for ${cashout['amount']:.2f} has been approved!", "wallet", "/shop/wallet")
    
    return {"message": "Cash out request approved"}


@router.put("/admin/cashout-requests/{request_id}/reject")
async def admin_reject_cashout(request_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Reject a cash out request (refund to wallet)"""
    cashout = await db.cashout_requests.find_one({"id": request_id}, {"_id": 0})
    if not cashout:
        raise HTTPException(status_code=404, detail="Cash out request not found")
    if cashout["status"] != "pending":
        raise HTTPException(status_code=400, detail="This request is already processed")
    
    body = await request.json() if request else {}
    reason = body.get("reason", "") if isinstance(body, dict) else ""
    
    now = datetime.now(timezone.utc)
    amount = cashout["amount"]
    shop_id = cashout["shop_id"]
    
    # Refund to wallet
    shop = await db.shops.find_one({"id": shop_id})
    new_balance = round((shop.get("wallet_balance", 0) or 0) + amount, 2)
    await db.shops.update_one({"id": shop_id}, {"$set": {"wallet_balance": new_balance}})
    
    # Update cashout status
    await db.cashout_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "rejected_by": admin["user_id"], "reject_reason": reason, "updated_at": now.isoformat()}}
    )
    
    # Update wallet transaction
    await db.wallet_transactions.update_many(
        {"cashout_id": request_id},
        {"$set": {"status": "rejected"}}
    )
    
    # Create refund transaction
    refund_txn = {
        "id": str(uuid.uuid4()),
        "shop_id": shop_id,
        "shop_name": shop.get("name", ""),
        "type": "cashout_refund",
        "amount": amount,
        "balance_after": new_balance,
        "status": "completed",
        "note": "Refund: cash out request rejected" + (f" - {reason}" if reason else ""),
        "created_at": now.isoformat()
    }
    await db.wallet_transactions.insert_one(refund_txn)
    
    # Notify shop
    await create_notification(shop_id, "Cash Out Rejected", f"Your cash out request for ${amount:.2f} was rejected." + (f" Reason: {reason}" if reason else ""), "wallet", "/shop/wallet")
    
    return {"message": "Cash out request rejected, funds refunded to wallet", "new_balance": new_balance}


@router.get("/admin/promotions")
async def admin_get_promotions(status: Optional[str] = None, admin: Dict = Depends(require_admin)):
    """Admin: Get all promotions"""
    query = {}
    if status:
        query["status"] = status
    
    promotions = await db.promotions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Auto-expire
    now = datetime.now(timezone.utc).isoformat()
    for promo in promotions:
        if promo["status"] == "active" and promo["end_date"] <= now:
            await db.promotions.update_one({"id": promo["id"]}, {"$set": {"status": "expired"}})
            await db.products.update_one({"id": promo["product_id"]}, {"$set": {"is_promoted": False}})
            promo["status"] = "expired"
    
    # Revenue calculation
    total_revenue = sum(p.get("total_cost", 0) for p in promotions if p["status"] in ["active", "expired"])
    active_count = sum(1 for p in promotions if p["status"] == "active")
    
    return {
        "promotions": promotions,
        "total_revenue": total_revenue,
        "active_count": active_count,
        "total_count": len(promotions)
    }


@router.get("/admin/tier-upgrade-requests")
async def admin_get_tier_requests(status: Optional[str] = None, admin: Dict = Depends(require_admin)):
    """Admin: Get all tier upgrade requests"""
    query = {}
    if status:
        query["status"] = status
    requests = await db.tier_upgrade_requests.find(query, {"_id": 0}).sort("requested_at", -1).to_list(200)
    return {"requests": requests}


@router.put("/admin/tier-upgrade-requests/{request_id}/approve")
async def admin_approve_tier_request(request_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Approve a tier upgrade request"""
    req = await db.tier_upgrade_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    body = await request.json() if True else {}
    try:
        body = await request.json()
    except:
        body = {}
    admin_note = body.get("admin_note", "")
    
    shop = await db.shops.find_one({"id": req["shop_id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    target_tier = req["to_tier"]
    billing_cycle = req.get("billing_cycle", "monthly")
    
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    tiers = settings.get("tiers", {}) if settings else {}
    tier_config = tiers.get(target_tier, {})
    price = tier_config.get("yearly_price" if billing_cycle == "yearly" else "monthly_price", 39)
    
    now = datetime.now(timezone.utc)
    tier_end = now + timedelta(days=365 if billing_cycle == "yearly" else 30)
    
    await db.shops.update_one(
        {"id": req["shop_id"]},
        {"$set": {
            "tier": target_tier,
            "tier_start": now.isoformat(),
            "tier_end": tier_end.isoformat(),
            "tier_billing_cycle": billing_cycle,
            "tier_price_paid": price,
            "subscription_status": "active",
            "subscription_start": now.isoformat(),
            "subscription_end": tier_end.isoformat(),
            "boost_credits_used_this_month": 0
        }}
    )
    
    await db.tier_upgrade_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "decided_at": now.isoformat(), "admin_note": admin_note}}
    )
    
    await create_notification(
        "shop",
        "Tier Upgrade Approved!",
        f"Your upgrade to {target_tier.title()} has been approved!",
        "subscription",
        "/shop/dashboard",
        recipient_id=req["shop_id"]
    )
    
    return {"message": f"Tier upgrade approved. Shop is now {target_tier.title()}."}


@router.put("/admin/tier-upgrade-requests/{request_id}/reject")
async def admin_reject_tier_request(request_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Reject a tier upgrade request"""
    req = await db.tier_upgrade_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    try:
        body = await request.json()
    except:
        body = {}
    admin_note = body.get("admin_note", "")
    
    now = datetime.now(timezone.utc)
    await db.tier_upgrade_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "decided_at": now.isoformat(), "admin_note": admin_note}}
    )
    
    await create_notification(
        "shop",
        "Tier Upgrade Rejected",
        f"Your upgrade request to {req['to_tier'].title()} was not approved. {admin_note}",
        "subscription",
        "/shop/dashboard",
        recipient_id=req["shop_id"]
    )
    
    return {"message": "Tier upgrade request rejected."}


@router.put("/admin/shops/{shop_id}/tier")
async def admin_set_shop_tier(shop_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Assign/change a shop's tier"""
    body = await request.json()
    tier = body.get("tier", "starter")
    
    if tier not in ["starter", "pro"]:
        raise HTTPException(status_code=400, detail="Tier must be 'starter' or 'pro'")
    
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    now = datetime.now(timezone.utc)
    await db.shops.update_one(
        {"id": shop_id},
        {"$set": {
            "tier": tier,
            "tier_start": now.isoformat(),
            "tier_changed_by": "admin",
            "boost_credits_used_this_month": 0
        }}
    )
    
    return {"message": f"Shop tier updated to {tier}"}


@router.get("/admin/tiers/revenue")
async def admin_tier_revenue(admin: Dict = Depends(require_admin)):
    """Admin: View revenue breakdown by tier"""
    shops = await db.shops.find({}, {"_id": 0, "id": 1, "tier": 1, "tier_price_paid": 1, "name": 1}).to_list(1000)
    
    starter_shops = [s for s in shops if s.get("tier", "starter") == "starter"]
    pro_shops = [s for s in shops if s.get("tier") == "pro"]
    
    starter_revenue = sum(s.get("tier_price_paid", 0) or 0 for s in starter_shops)
    pro_revenue = sum(s.get("tier_price_paid", 0) or 0 for s in pro_shops)
    
    return {
        "starter": {"count": len(starter_shops), "revenue": starter_revenue},
        "pro": {"count": len(pro_shops), "revenue": pro_revenue},
        "total_revenue": starter_revenue + pro_revenue
    }


@router.get("/admin/subscription-tiers")
async def admin_get_subscription_tiers(admin: Dict = Depends(require_admin)):
    """Admin: Get subscription tier configuration with shop counts and revenue.
    The platform now exposes a single 'subscription' (pro) tier — price clamped to $15-$20.
    Shops can choose whether or not to subscribe (subscription_required flag)."""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    settings = settings or {}
    tiers = settings.get("tiers", {}) or {}
    pro = tiers.get("pro", {}) or {}

    # Backfill / clamp defaults so the front-end always has something to render
    try:
        current_price = float(pro.get("monthly_price", 0))
    except Exception:
        current_price = 0
    if not (15.0 <= current_price <= 20.0):
        pro["monthly_price"] = 19.0
    pro.setdefault("yearly_price", round(pro["monthly_price"] * 10, 2))
    pro.setdefault("name", "Subscription")
    pro.setdefault("description", "Unlock the full seller experience for your shop. Get visibility, advanced tools and full marketplace access.")
    pro.setdefault("monthly_wallet_credit", 0)
    pro.setdefault("commission_rate", settings.get("commission_percentage", 10))
    pro.setdefault("features", [
        "1 free Lucky Spin every month",
        "2 free product sponsor credits every month",
        "Lower commission on your sales",
        "Full storefront theme customisation",
        "Marketing & boost tools + advanced analytics",
        "Priority customer support",
    ])
    tiers["pro"] = pro

    # Shop stats (everyone is now on the single subscription tier)
    all_shops = await db.shops.find(
        {},
        {"_id": 0, "id": 1, "tier": 1, "tier_price_paid": 1, "subscription_price_paid": 1, "name": 1, "subscription_status": 1, "subscription_required": 1}
    ).to_list(2000)

    subscribed_shops = [s for s in all_shops if s.get("subscription_required", True)]
    free_shops = [s for s in all_shops if not s.get("subscription_required", True)]
    active_subscribed = [s for s in subscribed_shops if s.get("subscription_status") in ["active", "trial"]]

    total_revenue = sum(
        (s.get("subscription_price_paid") or s.get("tier_price_paid") or 0) for s in all_shops
    )

    sub_payments = await db.subscription_payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)

    return {
        "tiers": tiers,
        "subscription": pro,  # single-tier alias for the new UI
        "stats": {
            "total_shops": len(all_shops),
            "subscribed": len(subscribed_shops),
            "active_subscribed": len(active_subscribed),
            "free": len(free_shops),
            "total_revenue": round(total_revenue, 2),
            # Legacy keys for backwards compatibility
            "starter": {"count": 0, "active": 0, "revenue": 0},
            "pro": {
                "count": len(subscribed_shops),
                "active": len(active_subscribed),
                "revenue": round(total_revenue, 2),
            },
        },
        "recent_payments": sub_payments[:20],
        "promotion_daily_price": settings.get("promotion_daily_price", 2),
        "promotion_enabled": settings.get("promotion_enabled", True),
        "promotion_max_slots_per_page": settings.get("promotion_max_slots_per_page", 4),
        "min_price": 15.0,
        "max_price": 20.0,
    }


@router.put("/admin/subscription-tiers")
async def admin_update_subscription_tiers(request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Update subscription tier settings (single-tier model).
    Accepts either {tiers: {pro: {...}}} or {subscription: {...}}.
    monthly_price is clamped to the $15-$20 range."""
    body = await request.json()
    update_fields = {}

    # Pull tier payload either from 'subscription' or 'tiers.pro'
    sub_payload = body.get("subscription")
    tiers_payload = body.get("tiers") or {}
    pro_payload = sub_payload or (tiers_payload.get("pro") if isinstance(tiers_payload, dict) else None)

    if pro_payload is not None:
        existing = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0}) or {}
        existing_tiers = existing.get("tiers", {}) or {}
        merged = {**(existing_tiers.get("pro") or {}), **pro_payload}

        # Clamp price to the $15-$20 range
        try:
            mp = float(merged.get("monthly_price", 19))
        except Exception:
            mp = 19.0
        mp = max(15.0, min(20.0, mp))
        merged["monthly_price"] = round(mp, 2)

        # Auto-derive yearly price if not provided
        if not merged.get("yearly_price"):
            merged["yearly_price"] = round(mp * 10, 2)

        # Reset / drop the starter tier completely
        update_fields["tiers"] = {"pro": merged}
        update_fields["subscription_price"] = merged["monthly_price"]

    if "promotion_daily_price" in body:
        update_fields["promotion_daily_price"] = body["promotion_daily_price"]
    if "promotion_enabled" in body:
        update_fields["promotion_enabled"] = body["promotion_enabled"]
    if "promotion_max_slots_per_page" in body:
        update_fields["promotion_max_slots_per_page"] = body["promotion_max_slots_per_page"]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Apply the update. If we're rewriting `tiers`, do it in two ops to avoid
    # MongoDB's "cannot have $set + $unset on overlapping paths" conflict.
    if "tiers" in update_fields:
        await db.platform_settings.update_one(
            {"id": "platform"}, {"$unset": {"tiers.starter": ""}}, upsert=True
        )

    result = await db.platform_settings.find_one_and_update(
        {"id": "platform"},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0},
        upsert=True,
    )
    return {
        "message": "Subscription settings updated",
        "tiers": result.get("tiers"),
        "subscription": (result.get("tiers") or {}).get("pro"),
    }


@router.post("/admin/wallet/monthly-credit")
async def admin_run_monthly_wallet_credit(admin: Dict = Depends(require_admin)):
    """Admin: Manually trigger monthly wallet credit for all active shops.
    Starter gets $1, Pro gets $3 (configurable in tier settings).
    Skips shops that were already credited this month."""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    tiers = settings.get("tiers", {}) if settings else {}
    
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    
    # Get all active shops
    active_shops = await db.shops.find(
        {"subscription_status": {"$in": ["active", "trial"]}, "status": "approved"},
        {"_id": 0}
    ).to_list(1000)
    
    credited_count = 0
    skipped_count = 0
    total_credited = 0
    
    for shop in active_shops:
        # Check if already credited this month
        last_credit = shop.get("wallet_last_monthly_credit")
        if last_credit and last_credit.startswith(current_month):
            skipped_count += 1
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
            {"$set": {
                "wallet_balance": new_balance,
                "wallet_last_monthly_credit": current_month
            }}
        )
        
        credit_txn_id = str(uuid.uuid4())
        txn = {
            "id": credit_txn_id,
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "type": "monthly_credit",
            "amount": credit_amount,
            "balance_after": new_balance,
            "status": "completed",
            "note": f"{tier.title()} tier monthly wallet credit ({current_month})",
            "created_at": now.isoformat()
        }
        await db.wallet_transactions.insert_one(txn)
        
        # Record admin ledger debit for monthly credit given to shop
        await db.admin_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "type": "monthly_credits",
            "subtype": f"{tier}_monthly_credit",
            "amount": credit_amount,
            "direction": "debit",
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "ref_id": credit_txn_id,
            "note": f"Monthly ${credit_amount} credit given to {shop.get('name', '')} ({tier.title()} tier)",
            "created_at": now.isoformat()
        })
        
        credited_count += 1
        total_credited += credit_amount
    
    return {
        "message": f"Monthly credit completed. {credited_count} shops credited, {skipped_count} skipped (already credited this month).",
        "credited_count": credited_count,
        "skipped_count": skipped_count,
        "total_credited": total_credited,
        "month": current_month
    }


@router.get("/admin/badge-counts")
async def admin_badge_counts(admin: Dict = Depends(require_admin)):
    """Get real-time badge counts for admin sidebar"""
    now = datetime.now(timezone.utc).isoformat()
    cancel_count = await db.cancel_requests.count_documents({"status": "pending"})
    wallet_req_count = await db.wallet_transactions.count_documents({"type": "topup_request", "status": "pending"})
    cashout_count = await db.cashout_requests.count_documents({"status": "pending"})
    agent_cashout_count = await db.agent_cashout_requests.count_documents({"status": "pending"})
    contact_count = await db.contact_messages.count_documents({"status": {"$ne": "resolved"}})
    shop_pending_count = await db.shops.count_documents({
        "subscription_status": {"$in": ["pending", "pending_payment"]}
    })
    subscription_req_count = await db.shops.count_documents({
        "subscription_status": {"$in": ["pending", "pending_payment"]}
    })
    tier_upgrade_count = await db.tier_upgrade_requests.count_documents({"status": "pending"})
    promo_count = await db.promotions.count_documents({"status": "active", "end_date": {"$gt": now}})
    verification_count = await db.shop_verifications.count_documents({"status": "pending"})
    return {
        "cancel_requests": cancel_count,
        "wallet_requests": wallet_req_count,
        "cashout_requests": cashout_count,
        "agent_cashout_requests": agent_cashout_count,
        "subscription_requests": subscription_req_count + tier_upgrade_count,
        "contact_messages": contact_count,
        "shop_pending": shop_pending_count,
        "promotions": promo_count,
        "verification_requests": verification_count,
        "total_requests": cancel_count + wallet_req_count + cashout_count + agent_cashout_count + subscription_req_count + tier_upgrade_count + verification_count
    }


@router.put("/admin/tos")
async def update_tos(request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Update Terms of Service content"""
    body = await request.json()
    content = body.get("content", "")
    
    tos_doc = {
        "id": "tos",
        "content": content,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tos.update_one(
        {"id": "tos"},
        {"$set": tos_doc},
        upsert=True
    )
    
    return tos_doc


@router.post("/admin/badges/mark-seen")
async def admin_mark_badge_seen(request: Request, admin: Dict = Depends(require_admin)):
    """Mark admin badge section as seen"""
    body = await request.json()
    section = body.get("section", "")
    
    await db.badge_reads.update_one(
        {"user_id": admin["user_id"], "section": section},
        {"$set": {"user_id": admin["user_id"], "section": section, "last_seen": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"status": "ok"}


@router.get("/admin/spin/settings")
async def admin_get_spin_settings(admin: Dict = Depends(require_admin)):
    """Get spin wheel settings"""
    settings = await db.spin_settings.find_one({"id": "spin"}, {"_id": 0})
    if not settings:
        # Default settings
        settings = {
            "id": "spin",
            "enabled": True,
            "spin_cost_usd": 7.0,
            "outcomes": [
                {"key": "free_sponsors_4", "label": "4 Free Sponsors", "weight": 5, "payload": {"count": 4}, "is_active": True},
                {"key": "free_sponsor_10_days", "label": "1 Sponsor (10 days)", "weight": 15, "payload": {"count": 1, "days": 10}, "is_active": True},
                {"key": "free_theme", "label": "Free Theme", "weight": 5, "payload": {"count": 1}, "is_active": True},
                {"key": "wallet_credit_small", "label": "+$3 Wallet", "weight": 18, "payload": {"amount": 3}, "is_active": True},
                {"key": "wallet_credit_large", "label": "+$8 Wallet", "weight": 17, "payload": {"amount": 8}, "is_active": True},
                {"key": "another_spin", "label": "Another Spin!", "weight": 15, "payload": {}, "is_active": True},
                {"key": "try_again", "label": "Try Again", "weight": 25, "payload": {}, "is_active": True}
            ]
        }
        await db.spin_settings.insert_one(settings.copy())
    else:
        # Migration: Replace old subscription outcomes with sponsorship outcomes
        outcomes = settings.get("outcomes", [])
        migrated = False
        new_outcomes = []
        seen_keys = set()
        for o in outcomes:
            key = o.get("key")
            if key in ("free_subscription", "subscription_extension"):
                # Skip old outcomes
                migrated = True
                continue
            if "is_active" not in o:
                o["is_active"] = True
                migrated = True
            seen_keys.add(key)
            new_outcomes.append(o)
        # Add new sponsorship outcomes if missing
        if "free_sponsors_4" not in seen_keys:
            new_outcomes.insert(0, {"key": "free_sponsors_4", "label": "4 Free Sponsors", "weight": 5, "payload": {"count": 4}, "is_active": True})
            migrated = True
        if "free_sponsor_10_days" not in seen_keys:
            new_outcomes.insert(1, {"key": "free_sponsor_10_days", "label": "1 Sponsor (10 days)", "weight": 15, "payload": {"count": 1, "days": 10}, "is_active": True})
            migrated = True
        if "free_theme" not in seen_keys:
            new_outcomes.insert(2, {"key": "free_theme", "label": "Free Theme", "weight": 5, "payload": {"count": 1}, "is_active": True})
            migrated = True
        if migrated:
            await db.spin_settings.update_one({"id": "spin"}, {"$set": {"outcomes": new_outcomes}})
            settings["outcomes"] = new_outcomes
    return settings


@router.put("/admin/spin/settings")
async def admin_update_spin_settings(request: Request, admin: Dict = Depends(require_admin)):
    """Update spin wheel settings"""
    body = await request.json()
    
    update_data = {}
    if "enabled" in body:
        update_data["enabled"] = body["enabled"]
    if "spin_cost_usd" in body:
        update_data["spin_cost_usd"] = float(body["spin_cost_usd"])
    if "outcomes" in body:
        outcomes = body["outcomes"]
        # Validate outcomes
        for o in outcomes:
            if "key" not in o or "label" not in o or "weight" not in o:
                raise HTTPException(status_code=400, detail="Each outcome must have key, label, and weight")
        update_data["outcomes"] = outcomes
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.spin_settings.update_one(
        {"id": "spin"},
        {"$set": update_data},
        upsert=True
    )
    
    updated = await db.spin_settings.find_one({"id": "spin"}, {"_id": 0})
    return updated


@router.get("/admin/spin/history")
async def admin_get_spin_history(admin: Dict = Depends(require_admin)):
    """Get all spin history for admin"""
    history = await db.spin_history.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Enrich with shop names
    shop_ids = list(set(h.get("shop_id") for h in history if h.get("shop_id")))
    if shop_ids:
        shops = await db.shops.find({"id": {"$in": shop_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        shop_names = {s["id"]: s["name"] for s in shops}
        for h in history:
            h["shop_name"] = shop_names.get(h.get("shop_id"), "Unknown")
    return {"history": history}


@router.post("/admin/spin/grant-free-spin")
async def admin_grant_free_spin(request: Request, admin: Dict = Depends(require_admin)):
    """Admin grants free spins to specific shops or all shops.
    
    Body: { shop_ids: ["id1", "id2"] | "all", count: 1 }
    Sends in-app notification + email to each affected shop.
    """
    body = await request.json()
    target = body.get("shop_ids", [])
    count = max(1, int(body.get("count", 1)))
    
    # Resolve target shops
    if target == "all" or (isinstance(target, list) and len(target) == 0):
        target_shops = await db.shops.find({"status": "approved"}, {"_id": 0}).to_list(10000)
    elif isinstance(target, list):
        target_shops = await db.shops.find({"id": {"$in": target}}, {"_id": 0}).to_list(len(target))
    else:
        raise HTTPException(status_code=400, detail="Invalid shop_ids")
    
    if not target_shops:
        raise HTTPException(status_code=400, detail="No matching shops found")
    
    now = datetime.now(timezone.utc).isoformat()
    granted = []
    
    # Import email helpers lazily
    try:
        from services.email_service import send_email_async
    except ImportError:
        send_email_async = None
    
    for shop in target_shops:
        shop_id = shop["id"]
        # Increment free spins balance in both places used by shop spin logic
        await db.shop_spin_state.update_one(
            {"shop_id": shop_id},
            {"$inc": {"free_spins_balance": count}, "$set": {"updated_at": now}},
            upsert=True
        )
        await db.shops.update_one({"id": shop_id}, {"$inc": {"free_spins_balance": count}})
        
        # In-app notification (message)
        try:
            await create_notification(
                shop.get("user_id"),
                "🎉 Free Spin Gift!",
                f"OpenMarket Admin granted you {count} free spin{'s' if count > 1 else ''} for the Lucky Spin Wheel. Enjoy!",
                "spin_gift",
                "/shop/spin"
            )
        except Exception as e:
            logger.error(f"Failed to notify shop {shop_id}: {e}")
        
        # Email to shop
        email_to = shop.get("email")
        if not email_to and shop.get("user_id"):
            owner = await db.users.find_one({"id": shop["user_id"]}, {"_id": 0, "email": 1})
            email_to = (owner or {}).get("email")
        
        if email_to and send_email_async:
            shop_name = shop.get("name", "Shop")
            spins_text = f"{count} free spin{'s' if count > 1 else ''}"
            html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px 28px;color:#fff;">
          <div style="font-size:22px;font-weight:800;">🎁 Free Spin Gift</div>
          <div style="font-size:13px;opacity:0.9;margin-top:4px;">OpenMarket Lebanon</div>
        </td></tr>
        <tr><td style="padding:28px;color:#334155;font-size:15px;line-height:1.7;">
          <p style="margin:0 0 12px;">Hi <strong>{shop_name}</strong>,</p>
          <p style="margin:0 0 12px;">Great news! Our admin team just gifted your shop <strong style="color:#7c3aed;">{spins_text}</strong> on the Lucky Spin Wheel.</p>
          <p style="margin:0 0 18px;">You could win free sponsorships, wallet credits, free themes, or even more spins. Don't let them sit idle!</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="{(os.environ.get('FRONTEND_URL') or '').rstrip('/')}/shop/spin" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;">Spin the Wheel →</a>
          </div>
          <p style="margin:0;color:#64748b;font-size:13px;">Sent from <strong>openmarketlb@gmail.com</strong></p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #eef2f7;color:#94a3b8;font-size:11px;text-align:center;">
          &copy; {datetime.now().year} OpenMarket Lebanon. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
            try:
                import asyncio as _a
                _a.create_task(send_email_async(email_to, f"🎁 You got {spins_text} from OpenMarket", html))
            except Exception as e:
                logger.error(f"Failed to send free-spin email to {email_to}: {e}")
        
        granted.append({"shop_id": shop_id, "shop_name": shop.get("name", ""), "count": count})
    
    return {"message": f"Granted {count} free spin(s) to {len(granted)} shop(s)", "shops": granted}


@router.post("/admin/seed")
async def seed_full_data(admin: Dict = Depends(require_admin)):
    """Seed the database with comprehensive demo data"""
    
    now = datetime.now(timezone.utc)
    
    # ---- Platform Settings (ensure commission is enabled) ----
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": {
            "commission_enabled": True,
            "commission_percentage": 10.0,
            "promotion_enabled": True,
            "loyalty_enabled": True,
        }},
        upsert=True
    )
    
    # ---- Categories ----
    categories = [
        {"id": "cat-electronics", "name": "Electronics", "parent_id": None, "is_active": True, "sort_order": 1, "created_at": now.isoformat()},
        {"id": "cat-phones", "name": "Phones & Tablets", "parent_id": "cat-electronics", "is_active": True, "sort_order": 2, "created_at": now.isoformat()},
        {"id": "cat-laptops", "name": "Laptops & Computers", "parent_id": "cat-electronics", "is_active": True, "sort_order": 3, "created_at": now.isoformat()},
        {"id": "cat-accessories", "name": "Accessories", "parent_id": "cat-electronics", "is_active": True, "sort_order": 4, "created_at": now.isoformat()},
        {"id": "cat-fashion", "name": "Fashion", "parent_id": None, "is_active": True, "sort_order": 5, "created_at": now.isoformat()},
        {"id": "cat-men", "name": "Men's Clothing", "parent_id": "cat-fashion", "is_active": True, "sort_order": 6, "created_at": now.isoformat()},
        {"id": "cat-women", "name": "Women's Clothing", "parent_id": "cat-fashion", "is_active": True, "sort_order": 7, "created_at": now.isoformat()},
        {"id": "cat-shoes", "name": "Shoes", "parent_id": "cat-fashion", "is_active": True, "sort_order": 8, "created_at": now.isoformat()},
        {"id": "cat-home", "name": "Home & Living", "parent_id": None, "is_active": True, "sort_order": 9, "created_at": now.isoformat()},
        {"id": "cat-furniture", "name": "Furniture", "parent_id": "cat-home", "is_active": True, "sort_order": 10, "created_at": now.isoformat()},
        {"id": "cat-kitchen", "name": "Kitchen", "parent_id": "cat-home", "is_active": True, "sort_order": 11, "created_at": now.isoformat()},
        {"id": "cat-beauty", "name": "Beauty & Health", "parent_id": None, "is_active": True, "sort_order": 12, "created_at": now.isoformat()},
        {"id": "cat-skincare", "name": "Skincare", "parent_id": "cat-beauty", "is_active": True, "sort_order": 13, "created_at": now.isoformat()},
        {"id": "cat-sports", "name": "Sports & Outdoors", "parent_id": None, "is_active": True, "sort_order": 14, "created_at": now.isoformat()},
        {"id": "cat-books", "name": "Books & Stationery", "parent_id": None, "is_active": True, "sort_order": 15, "created_at": now.isoformat()},
    ]
    
    existing_cats = await db.categories.count_documents({})
    if existing_cats == 0:
        await db.categories.insert_many(categories)
    
    # ---- States ----
    states = [
        {"id": "state-beirut", "name": "Beirut", "delivery_fee": 3.0, "is_active": True},
        {"id": "state-mount-leb", "name": "Mount Lebanon", "delivery_fee": 4.0, "is_active": True},
        {"id": "state-north", "name": "North Lebanon", "delivery_fee": 5.0, "is_active": True},
        {"id": "state-south", "name": "South Lebanon", "delivery_fee": 5.0, "is_active": True},
        {"id": "state-bekaa", "name": "Bekaa", "delivery_fee": 5.5, "is_active": True},
        {"id": "state-nabatieh", "name": "Nabatieh", "delivery_fee": 5.0, "is_active": True},
    ]
    existing_states = await db.states.count_documents({})
    if existing_states == 0:
        await db.states.insert_many(states)
    
    # ---- Users (test shoppers) ----
    hashed_pw = bcrypt.hashpw("Test1234!".encode(), bcrypt.gensalt()).decode()
    
    test_users = [
        {"id": "user-shopper1", "email": "shopper1@test.com", "password": hashed_pw, "name": "Sarah Ahmad", "phone": "+96170123456", "role": "user", "address": "Hamra St", "city": "Beirut", "state": "Beirut", "created_at": (now - timedelta(days=30)).isoformat()},
        {"id": "user-shopper2", "email": "shopper2@test.com", "password": hashed_pw, "name": "Omar Khoury", "phone": "+96171234567", "role": "user", "address": "Bliss St", "city": "Beirut", "state": "Beirut", "created_at": (now - timedelta(days=25)).isoformat()},
        {"id": "user-shopper3", "email": "shopper3@test.com", "password": hashed_pw, "name": "Lina Haddad", "phone": "+96176345678", "role": "user", "address": "Mar Mikhael", "city": "Beirut", "state": "Beirut", "created_at": (now - timedelta(days=20)).isoformat()},
    ]
    
    for u in test_users:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            await db.users.insert_one(u)

    # ---- Referral Agent (Omar) ----
    # A demo referral agent so the shop-referral / commission flow is testable end-to-end.
    demo_agents = [
        {
            "id": "agent-omar",
            "email": "example@agent.com",
            "password": bcrypt.hashpw("Agent1234!".encode(), bcrypt.gensalt()).decode(),
            "name": "Omar",
            "first_name": "Omar",
            "last_name": "Agent",
            "phone": "+96170999888",
            "state": "Beirut",
            "role": "agent",
            "referral_code": "OMAR-IKL2L",
            "commission_share_percent": 30.0,   # gets 30% of admin's commission on referred shops' orders
            "approval_bonus_amount": 4.0,        # $4 credited when a referred shop is approved
            "wallet_balance": 0.0,
            "created_at": (now - timedelta(days=15)).isoformat(),
        },
    ]
    for a in demo_agents:
        existing = await db.users.find_one({"email": a["email"]})
        if not existing:
            await db.users.insert_one(a)
        else:
            # Ensure key referral fields are present even if the agent already exists
            await db.users.update_one(
                {"email": a["email"]},
                {"$set": {
                    "role": "agent",
                    "referral_code": a["referral_code"],
                    "commission_share_percent": a["commission_share_percent"],
                    "approval_bonus_amount": a["approval_bonus_amount"],
                }},
            )

    # ---- Shop owners & shops ----
    shop_owners = [
        {"id": "user-shop1", "email": "shop1@test.com", "password": hashed_pw, "name": "Ali Bazzi", "phone": "+96170111222", "role": "shop", "shop_id": "shop-techzone", "created_at": (now - timedelta(days=60)).isoformat()},
        {"id": "user-shop2", "email": "shop2@test.com", "password": hashed_pw, "name": "Maya Nassar", "phone": "+96171222333", "role": "shop", "shop_id": "shop-fashionhub", "created_at": (now - timedelta(days=50)).isoformat()},
        {"id": "user-shop3", "email": "shop3@test.com", "password": hashed_pw, "name": "Karim Saleh", "phone": "+96176333444", "role": "shop", "shop_id": "shop-homedecor", "created_at": (now - timedelta(days=40)).isoformat()},
        {"id": "user-shop4", "email": "shop4@test.com", "password": hashed_pw, "name": "Rami Karam", "phone": "+96170444555", "role": "user", "created_at": (now - timedelta(days=5)).isoformat()},
    ]
    
    for u in shop_owners:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            await db.users.insert_one(u)
    
    shops = [
        {
            "id": "shop-techzone", "user_id": "user-shop1", "name": "TechZone LB",
            "description": "Your one-stop destination for the latest electronics, gadgets, phones, and tech accessories in Lebanon.",
            "logo": "", "cover_image": "", "phone": "+96170111222",
            "email": "shop1@test.com", "address": "Hamra, Beirut",
            "city": "Beirut", "state": "Beirut",
            "latitude": 33.8959, "longitude": 35.4797, "location_address": "Hamra Street, Beirut",
            "subscription_status": "active", "tier": "pro",
            "subscription_required": True,
            "commission_type": "on_customer",
            "subscription_start": (now - timedelta(days=60)).isoformat(),
            "subscription_end": (now + timedelta(days=300)).isoformat(),
            "payment_method": "manual", "is_active": True, "status": "approved",
            "wallet_balance": 25.0,
            "free_sponsor_credits": 1,
            "welcome_bonus_granted": True,
            "created_at": (now - timedelta(days=60)).isoformat()
        },
        {
            "id": "shop-fashionhub", "user_id": "user-shop2", "name": "Fashion Hub",
            "description": "Curated fashion collections for men and women. Trendy, affordable, and stylish clothing for every occasion.",
            "logo": "", "cover_image": "", "phone": "+96171222333",
            "email": "shop2@test.com", "address": "Verdun, Beirut",
            "city": "Beirut", "state": "Beirut",
            "latitude": 33.8806, "longitude": 35.4881, "location_address": "Verdun Street, Beirut",
            "subscription_status": "active", "tier": "pro",
            "subscription_required": True,
            "commission_type": "on_customer",
            "subscription_start": (now - timedelta(days=50)).isoformat(),
            "subscription_end": (now + timedelta(days=310)).isoformat(),
            "payment_method": "manual", "is_active": True, "status": "approved",
            "wallet_balance": 10.0,
            "created_at": (now - timedelta(days=50)).isoformat()
        },
        {
            "id": "shop-homedecor", "user_id": "user-shop3", "name": "Home Decor Plus",
            "description": "Premium home furnishings, decor, and kitchen essentials. Transform your living space with our collections.",
            "logo": "", "cover_image": "", "phone": "+96176333444",
            "email": "shop3@test.com", "address": "Jounieh",
            "city": "Jounieh", "state": "Mount Lebanon",
            "latitude": 33.9808, "longitude": 35.6178, "location_address": "Jounieh Highway, Mount Lebanon",
            "subscription_status": "active", "tier": "starter",
            "subscription_required": False,
            "commission_type": "on_shop",
            "subscription_start": (now - timedelta(days=40)).isoformat(),
            "subscription_end": None,
            "payment_method": "manual", "is_active": True, "status": "approved",
            "wallet_balance": 15.0,
            "referred_by_agent_id": "agent-omar",
            "referred_by_agent_name": "Omar",
            "referral_code": "OMAR-IKL2L",
            "submitted_via": "agent_fill",
            "free_sponsor_credits": 2,
            "welcome_bonus_granted": True,
            "created_at": (now - timedelta(days=40)).isoformat()
        },
        {
            "id": "shop-newboutique", "user_id": "user-shop4", "name": "Beirut Boutique",
            "description": "A new boutique offering handmade crafts, artisan products, and unique gifts from Lebanese artisans.",
            "logo": "", "cover_image": "", "phone": "+96170444555",
            "email": "shop4@test.com", "address": "Gemmayze, Beirut",
            "city": "Beirut", "state": "Beirut",
            "latitude": 33.8954, "longitude": 35.5180, "location_address": "Gemmayze, Beirut",
            "subscription_status": "pending", "tier": "starter",
            "subscription_required": True,
            "commission_type": "on_customer",
            "subscription_start": None,
            "subscription_end": None,
            "payment_method": "manual", "is_active": False, "status": "pending",
            "wallet_balance": 0,
            "created_at": (now - timedelta(days=2)).isoformat()
        },
    ]
    
    for s in shops:
        existing = await db.shops.find_one({"id": s["id"]})
        if not existing:
            await db.shops.insert_one(s)
        else:
            # Ensure map coordinates exist on previously-seeded shops
            patch = {}
            for fld in ("latitude", "longitude", "location_address"):
                if s.get(fld) is not None and existing.get(fld) in (None, ""):
                    patch[fld] = s[fld]
            if patch:
                await db.shops.update_one({"id": s["id"]}, {"$set": patch})
    
    # ---- Products ----
    product_data = [
        # TechZone products
        {"id": "prod-iphone15", "shop_id": "shop-techzone", "name": "iPhone 15 Pro Max 256GB", "description": "The latest iPhone with A17 Pro chip, titanium design, and advanced camera system. Features a 6.7-inch Super Retina XDR display.", "price": 1199.0, "discount_price": 1099.0, "stock": 15, "category_ids": ["cat-phones"], "images": ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&h=600&fit=crop"], "is_active": True, "view_count": 245, "average_rating": 4.8, "review_count": 12},
        {"id": "prod-samsung-s24", "shop_id": "shop-techzone", "name": "Samsung Galaxy S24 Ultra", "description": "Samsung's flagship with Galaxy AI, S Pen, and 200MP camera. Titanium frame with 6.8-inch Dynamic AMOLED display.", "price": 1099.0, "discount_price": 999.0, "stock": 10, "category_ids": ["cat-phones"], "images": ["https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop"], "is_active": True, "view_count": 198, "average_rating": 4.7, "review_count": 8},
        {"id": "prod-macbook-air", "shop_id": "shop-techzone", "name": "MacBook Air M3 15-inch", "description": "Supercharged by M3 chip. Up to 18 hours of battery life, stunning Liquid Retina display, and incredibly thin design.", "price": 1299.0, "stock": 8, "category_ids": ["cat-laptops"], "images": ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1554412661-828c8d34bb9c?w=600&h=600&fit=crop"], "is_active": True, "view_count": 167, "average_rating": 4.9, "review_count": 6},
        {"id": "prod-airpods-pro", "shop_id": "shop-techzone", "name": "AirPods Pro 2nd Gen", "description": "Active Noise Cancellation, Adaptive Audio, USB-C charging. Premium sound in a compact design.", "price": 249.0, "discount_price": 219.0, "stock": 30, "category_ids": ["cat-accessories"], "images": ["https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1588423771073-b8903fde1c68?w=600&h=600&fit=crop"], "is_active": True, "view_count": 320, "average_rating": 4.6, "review_count": 18},
        {"id": "prod-ipad-air", "shop_id": "shop-techzone", "name": "iPad Air M2", "description": "Powerful M2 chip, 11-inch Liquid Retina display, supports Apple Pencil Pro. Perfect for work and play.", "price": 599.0, "stock": 12, "category_ids": ["cat-phones"], "images": ["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=600&h=600&fit=crop"], "is_active": True, "view_count": 134, "average_rating": 4.7, "review_count": 5},
        {"id": "prod-sony-headphones", "shop_id": "shop-techzone", "name": "Sony WH-1000XM5 Headphones", "description": "Industry-leading noise cancellation with Auto NC Optimizer. 30-hour battery life, crystal clear calls.", "price": 349.0, "discount_price": 299.0, "stock": 20, "category_ids": ["cat-accessories"], "images": ["https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop"], "is_active": True, "view_count": 256, "average_rating": 4.8, "review_count": 14},
        # Fashion Hub products
        {"id": "prod-leather-jacket", "shop_id": "shop-fashionhub", "name": "Premium Leather Jacket", "description": "Genuine leather biker jacket with quilted lining. Classic style meets modern comfort.", "price": 189.0, "discount_price": 149.0, "stock": 25, "category_ids": ["cat-men"], "images": ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1520975954732-35dd22299614?w=600&h=600&fit=crop"], "is_active": True, "view_count": 178, "average_rating": 4.5, "review_count": 9},
        {"id": "prod-silk-dress", "shop_id": "shop-fashionhub", "name": "Elegant Silk Evening Dress", "description": "Flowing silk dress perfect for special occasions. Available in multiple colors.", "price": 129.0, "stock": 18, "category_ids": ["cat-women"], "images": ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&h=600&fit=crop"], "is_active": True, "view_count": 210, "average_rating": 4.6, "review_count": 7},
        {"id": "prod-sneakers", "shop_id": "shop-fashionhub", "name": "Urban Street Sneakers", "description": "Comfortable and stylish sneakers for everyday wear. Lightweight with memory foam insole.", "price": 89.0, "discount_price": 69.0, "stock": 40, "category_ids": ["cat-shoes"], "images": ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&h=600&fit=crop"], "is_active": True, "view_count": 340, "average_rating": 4.4, "review_count": 22},
        {"id": "prod-denim-jeans", "shop_id": "shop-fashionhub", "name": "Classic Denim Jeans", "description": "Premium stretch denim with a relaxed fit. Timeless style that goes with everything.", "price": 59.0, "stock": 50, "category_ids": ["cat-men", "cat-women"], "images": ["https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&h=600&fit=crop"], "is_active": True, "view_count": 289, "average_rating": 4.3, "review_count": 15},
        {"id": "prod-handbag", "shop_id": "shop-fashionhub", "name": "Designer Crossbody Bag", "description": "Vegan leather crossbody bag with gold-tone hardware. Compact yet spacious.", "price": 79.0, "discount_price": 59.0, "stock": 30, "category_ids": ["cat-women"], "images": ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=600&fit=crop"], "is_active": True, "view_count": 195, "average_rating": 4.5, "review_count": 11},
        {"id": "prod-linen-shirt", "shop_id": "shop-fashionhub", "name": "Breathable Linen Shirt", "description": "100% premium linen, perfect for summer. Relaxed fit with a modern collar.", "price": 49.0, "stock": 35, "category_ids": ["cat-men"], "images": ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&h=600&fit=crop"], "is_active": True, "view_count": 156, "average_rating": 4.2, "review_count": 6},
        # Home Decor Plus products
        {"id": "prod-sofa", "shop_id": "shop-homedecor", "name": "Modern L-Shaped Sofa", "description": "Premium fabric L-shaped sofa with memory foam cushions. Seats 5 comfortably.", "price": 899.0, "discount_price": 749.0, "stock": 5, "category_ids": ["cat-furniture"], "images": ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&h=600&fit=crop"], "is_active": True, "view_count": 312, "average_rating": 4.7, "review_count": 8},
        {"id": "prod-coffee-table", "shop_id": "shop-homedecor", "name": "Marble Coffee Table", "description": "Elegant marble-top coffee table with brass legs. A statement piece for any living room.", "price": 299.0, "stock": 10, "category_ids": ["cat-furniture"], "images": ["https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=600&h=600&fit=crop"], "is_active": True, "view_count": 187, "average_rating": 4.6, "review_count": 5},
        {"id": "prod-espresso-machine", "shop_id": "shop-homedecor", "name": "Automatic Espresso Machine", "description": "Professional-grade espresso machine with built-in grinder. Make cafe-quality coffee at home.", "price": 449.0, "discount_price": 389.0, "stock": 8, "category_ids": ["cat-kitchen"], "images": ["https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop"], "is_active": True, "view_count": 267, "average_rating": 4.8, "review_count": 10},
        {"id": "prod-bedding-set", "shop_id": "shop-homedecor", "name": "Luxury Egyptian Cotton Bedding", "description": "800 thread count Egyptian cotton bedding set. Includes duvet cover, fitted sheet, and pillowcases.", "price": 179.0, "discount_price": 139.0, "stock": 20, "category_ids": ["cat-home"], "images": ["https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=600&fit=crop"], "is_active": True, "view_count": 198, "average_rating": 4.9, "review_count": 13},
        {"id": "prod-lamp", "shop_id": "shop-homedecor", "name": "Minimalist Floor Lamp", "description": "Scandinavian-inspired floor lamp with adjustable arm. Warm LED light included.", "price": 129.0, "stock": 15, "category_ids": ["cat-furniture"], "images": ["https://images.unsplash.com/photo-1507473885765-e6ed057ab3fe?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1543198126-a8ad8e47fb22?w=600&h=600&fit=crop"], "is_active": True, "view_count": 145, "average_rating": 4.4, "review_count": 4},
        {"id": "prod-knife-set", "shop_id": "shop-homedecor", "name": "Professional Chef Knife Set", "description": "8-piece Japanese steel knife set with magnetic block. Ultra-sharp and durable.", "price": 199.0, "discount_price": 169.0, "stock": 12, "category_ids": ["cat-kitchen"], "images": ["https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=600&h=600&fit=crop"], "is_active": True, "view_count": 223, "average_rating": 4.7, "review_count": 9},
        # Additional products for variety
        {"id": "prod-smart-watch", "shop_id": "shop-techzone", "name": "Smart Watch Pro 5", "description": "Advanced smartwatch with health tracking, GPS, and 5-day battery life. Water resistant.", "price": 349.0, "discount_price": 299.0, "stock": 22, "category_ids": ["cat-accessories"], "images": ["https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&h=600&fit=crop"], "is_active": True, "view_count": 189, "average_rating": 4.5, "review_count": 7, "gender": "none"},
        {"id": "prod-bluetooth-speaker", "shop_id": "shop-techzone", "name": "Portable Bluetooth Speaker", "description": "360° sound with deep bass. Waterproof, dustproof, and 20-hour battery life.", "price": 79.0, "stock": 45, "category_ids": ["cat-accessories"], "images": ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1589003077984-894e133dabab?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1558537348-c0f8e733989d?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&h=600&fit=crop"], "is_active": True, "view_count": 156, "average_rating": 4.3, "review_count": 11, "gender": "none"},
        {"id": "prod-summer-dress", "shop_id": "shop-fashionhub", "name": "Floral Summer Dress", "description": "Light and breezy floral print dress. Perfect for summer outings and vacations.", "price": 69.0, "discount_price": 49.0, "stock": 35, "category_ids": ["cat-women"], "images": ["https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=600&fit=crop"], "is_active": True, "view_count": 231, "average_rating": 4.6, "review_count": 8, "gender": "women"},
        {"id": "prod-polo-shirt", "shop_id": "shop-fashionhub", "name": "Classic Polo Shirt", "description": "Premium cotton polo in multiple colors. Timeless casual style for any occasion.", "price": 39.0, "stock": 60, "category_ids": ["cat-men"], "images": ["https://images.unsplash.com/photo-1625910513413-5fc421e0fd4f?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&h=600&fit=crop"], "is_active": True, "view_count": 145, "average_rating": 4.2, "review_count": 5, "gender": "men"},
        {"id": "prod-kids-backpack", "shop_id": "shop-fashionhub", "name": "Fun Kids Backpack", "description": "Colorful and durable backpack for kids. Multiple compartments and padded straps.", "price": 29.0, "discount_price": 22.0, "stock": 40, "category_ids": ["cat-fashion"], "images": ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1577733966973-d680bffd2e80?w=600&h=600&fit=crop"], "is_active": True, "view_count": 98, "average_rating": 4.4, "review_count": 6, "gender": "kids"},
        {"id": "prod-candle-set", "shop_id": "shop-homedecor", "name": "Aromatic Candle Collection", "description": "Set of 6 premium soy candles with calming scents. Long 40-hour burn time each.", "price": 49.0, "discount_price": 39.0, "stock": 30, "category_ids": ["cat-home"], "images": ["https://images.unsplash.com/photo-1602523961358-f9f03dd557db?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1572726729207-a78d6feb18d7?w=600&h=600&fit=crop"], "is_active": True, "view_count": 112, "average_rating": 4.8, "review_count": 4, "gender": "none"},
        {"id": "prod-yoga-mat", "shop_id": "shop-homedecor", "name": "Premium Yoga Mat", "description": "Extra thick non-slip yoga mat with carrying strap. Perfect for home workouts.", "price": 45.0, "stock": 25, "category_ids": ["cat-sports"], "images": ["https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=600&fit=crop"], "is_active": True, "view_count": 87, "average_rating": 4.5, "review_count": 3, "gender": "none"},
        {"id": "prod-wireless-charger", "shop_id": "shop-techzone", "name": "3-in-1 Wireless Charger", "description": "Charge phone, watch, and earbuds simultaneously. Fast charging compatible.", "price": 59.0, "discount_price": 45.0, "stock": 35, "category_ids": ["cat-accessories"], "images": ["https://images.unsplash.com/photo-1586816879360-004f5b0c51e5?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1622782914767-404fb9ab3f57?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1615526675159-e248c3021d3f?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&h=600&fit=crop","https://images.unsplash.com/photo-1601524909162-ae8725290836?w=600&h=600&fit=crop"], "is_active": True, "view_count": 201, "average_rating": 4.6, "review_count": 9, "gender": "none"},
    ]
    
    for p in product_data:
        existing = await db.products.find_one({"id": p["id"]})
        if not existing:
            p["created_at"] = (now - timedelta(days=random.randint(5, 45))).isoformat()
            await db.products.insert_one(p)

    # ---- Add Variant Data to selected products (Colors, Sizes, Shapes) ----
    variant_updates = {
        "prod-leather-jacket": {
            "has_color_variants": True, "has_size_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "Black", "color_code": "#0F172A", "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop", "stock": 10},
                {"color_name": "Brown", "color_code": "#7C2D12", "image_url": "https://images.unsplash.com/photo-1520975954732-35dd22299614?w=600&h=600&fit=crop", "stock": 8},
            ],
            "sizes": [
                {"size_name": "S", "stock": 4}, {"size_name": "M", "stock": 6}, {"size_name": "L", "stock": 8}, {"size_name": "XL", "stock": 5}, {"size_name": "2XL", "stock": 2},
            ],
        },
        "prod-silk-dress": {
            "has_color_variants": True, "has_size_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "Red", "color_code": "#DC2626", "image_url": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=600&fit=crop", "stock": 6},
                {"color_name": "Navy", "color_code": "#1E3A8A", "image_url": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&h=600&fit=crop", "stock": 4},
                {"color_name": "Emerald", "color_code": "#059669", "image_url": "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600&h=600&fit=crop", "stock": 5},
            ],
            "sizes": [
                {"size_name": "XS", "stock": 3}, {"size_name": "S", "stock": 5}, {"size_name": "M", "stock": 6}, {"size_name": "L", "stock": 4},
            ],
        },
        "prod-sneakers": {
            "has_color_variants": True, "has_size_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "White", "color_code": "#FFFFFF", "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop", "stock": 12},
                {"color_name": "Black", "color_code": "#0F172A", "image_url": "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&h=600&fit=crop", "stock": 14},
                {"color_name": "Red", "color_code": "#DC2626", "image_url": "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&h=600&fit=crop", "stock": 8},
            ],
            "sizes": [
                {"size_name": "39", "stock": 4}, {"size_name": "40", "stock": 6}, {"size_name": "41", "stock": 8}, {"size_name": "42", "stock": 10}, {"size_name": "43", "stock": 7}, {"size_name": "44", "stock": 5},
            ],
        },
        "prod-denim-jeans": {
            "has_color_variants": True, "has_size_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "Blue", "color_code": "#1D4ED8", "image_url": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=600&fit=crop", "stock": 20},
                {"color_name": "Black", "color_code": "#0F172A", "image_url": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&h=600&fit=crop", "stock": 15},
                {"color_name": "Gray", "color_code": "#6B7280", "image_url": "https://images.unsplash.com/photo-1602293589914-9b2b5d99a0a3?w=600&h=600&fit=crop", "stock": 10},
            ],
            "sizes": [
                {"size_name": "28", "stock": 5}, {"size_name": "30", "stock": 7}, {"size_name": "32", "stock": 10}, {"size_name": "34", "stock": 8}, {"size_name": "36", "stock": 4},
            ],
        },
        "prod-polo-shirt": {
            "has_color_variants": True, "has_size_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "White", "color_code": "#FFFFFF", "image_url": "https://images.unsplash.com/photo-1625910513413-5fc421e0fd4f?w=600&h=600&fit=crop", "stock": 18},
                {"color_name": "Navy", "color_code": "#1E3A8A", "image_url": "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&h=600&fit=crop", "stock": 15},
                {"color_name": "Forest", "color_code": "#166534", "image_url": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=600&fit=crop", "stock": 12},
                {"color_name": "Burgundy", "color_code": "#7F1D1D", "image_url": "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=600&h=600&fit=crop", "stock": 10},
            ],
            "sizes": [
                {"size_name": "S", "stock": 8}, {"size_name": "M", "stock": 14}, {"size_name": "L", "stock": 20}, {"size_name": "XL", "stock": 12}, {"size_name": "2XL", "stock": 6},
            ],
        },
        "prod-summer-dress": {
            "has_color_variants": True, "has_size_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "Pink", "color_code": "#EC4899", "image_url": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&h=600&fit=crop", "stock": 10},
                {"color_name": "Yellow", "color_code": "#FACC15", "image_url": "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&h=600&fit=crop", "stock": 12},
                {"color_name": "Sky Blue", "color_code": "#0EA5E9", "image_url": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=600&fit=crop", "stock": 8},
            ],
            "sizes": [
                {"size_name": "XS", "stock": 5}, {"size_name": "S", "stock": 10}, {"size_name": "M", "stock": 12}, {"size_name": "L", "stock": 8},
            ],
        },
        "prod-linen-shirt": {
            "has_color_variants": True, "has_size_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "White", "color_code": "#FFFFFF", "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=600&fit=crop", "stock": 12},
                {"color_name": "Beige", "color_code": "#D6BFA1", "image_url": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&h=600&fit=crop", "stock": 10},
                {"color_name": "Olive", "color_code": "#65A30D", "image_url": "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=600&h=600&fit=crop", "stock": 8},
            ],
            "sizes": [
                {"size_name": "S", "stock": 8}, {"size_name": "M", "stock": 12}, {"size_name": "L", "stock": 10}, {"size_name": "XL", "stock": 5},
            ],
        },
        "prod-iphone15": {
            "has_color_variants": True, "variant_selection_mode": "single",
            "colors": [
                {"color_name": "Natural Titanium", "color_code": "#9CA3AF", "image_url": "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=600&fit=crop", "stock": 5},
                {"color_name": "Blue Titanium", "color_code": "#3B82F6", "image_url": "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&h=600&fit=crop", "stock": 4},
                {"color_name": "Black Titanium", "color_code": "#1F2937", "image_url": "https://images.unsplash.com/photo-1592286927505-1def25115551?w=600&h=600&fit=crop", "stock": 6},
            ],
        },
        "prod-samsung-s24": {
            "has_color_variants": True, "variant_selection_mode": "single",
            "colors": [
                {"color_name": "Titanium Gray", "color_code": "#6B7280", "image_url": "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&h=600&fit=crop", "stock": 4},
                {"color_name": "Titanium Black", "color_code": "#1F2937", "image_url": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop", "stock": 3},
                {"color_name": "Titanium Violet", "color_code": "#7C3AED", "image_url": "https://images.unsplash.com/photo-1610792516307-ea5acd9c3b00?w=600&h=600&fit=crop", "stock": 3},
            ],
        },
        "prod-handbag": {
            "has_color_variants": True, "has_shape_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "Black", "color_code": "#0F172A", "image_url": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop", "stock": 10},
                {"color_name": "Tan", "color_code": "#C8A165", "image_url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=600&fit=crop", "stock": 12},
                {"color_name": "Burgundy", "color_code": "#7F1D1D", "image_url": "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=600&fit=crop", "stock": 8},
            ],
            "shapes": [
                {"shape_name": "Round", "image_url": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop", "stock": 10},
                {"shape_name": "Rectangle", "image_url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=600&fit=crop", "stock": 12},
                {"shape_name": "Tote", "image_url": "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=600&fit=crop", "stock": 8},
            ],
        },
        "prod-coffee-table": {
            "has_shape_variants": True, "has_color_variants": True, "variant_selection_mode": "multi",
            "shapes": [
                {"shape_name": "Round", "image_url": "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=600&h=600&fit=crop", "stock": 4},
                {"shape_name": "Rectangle", "image_url": "https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=600&h=600&fit=crop", "stock": 5},
                {"shape_name": "Oval", "image_url": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&h=600&fit=crop", "stock": 3},
            ],
            "colors": [
                {"color_name": "White Marble", "color_code": "#F5F5F4", "image_url": "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=600&h=600&fit=crop", "stock": 6},
                {"color_name": "Black Marble", "color_code": "#1F2937", "image_url": "https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=600&h=600&fit=crop", "stock": 4},
            ],
        },
        "prod-sofa": {
            "has_color_variants": True, "variant_selection_mode": "single",
            "colors": [
                {"color_name": "Gray", "color_code": "#6B7280", "image_url": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop", "stock": 2},
                {"color_name": "Beige", "color_code": "#D6BFA1", "image_url": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&h=600&fit=crop", "stock": 2},
                {"color_name": "Navy", "color_code": "#1E3A8A", "image_url": "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600&h=600&fit=crop", "stock": 1},
            ],
        },
        "prod-airpods-pro": {
            "has_color_variants": True, "variant_selection_mode": "single",
            "colors": [
                {"color_name": "White", "color_code": "#FFFFFF", "image_url": "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&h=600&fit=crop", "stock": 30},
            ],
        },
        "prod-smart-watch": {
            "has_color_variants": True, "has_shape_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "Black", "color_code": "#0F172A", "image_url": "https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=600&h=600&fit=crop", "stock": 8},
                {"color_name": "Silver", "color_code": "#C0C0C0", "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop", "stock": 7},
                {"color_name": "Rose Gold", "color_code": "#E0AB9A", "image_url": "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&h=600&fit=crop", "stock": 7},
            ],
            "shapes": [
                {"shape_name": "Round", "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop", "stock": 10},
                {"shape_name": "Square", "image_url": "https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=600&h=600&fit=crop", "stock": 12},
            ],
        },
        "prod-bluetooth-speaker": {
            "has_color_variants": True, "has_shape_variants": True, "variant_selection_mode": "multi",
            "colors": [
                {"color_name": "Black", "color_code": "#0F172A", "image_url": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop", "stock": 15},
                {"color_name": "Red", "color_code": "#DC2626", "image_url": "https://images.unsplash.com/photo-1589003077984-894e133dabab?w=600&h=600&fit=crop", "stock": 10},
                {"color_name": "Blue", "color_code": "#2563EB", "image_url": "https://images.unsplash.com/photo-1558537348-c0f8e733989d?w=600&h=600&fit=crop", "stock": 12},
                {"color_name": "White", "color_code": "#FFFFFF", "image_url": "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&h=600&fit=crop", "stock": 8},
            ],
            "shapes": [
                {"shape_name": "Cylinder", "image_url": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop", "stock": 25},
                {"shape_name": "Cube", "image_url": "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&h=600&fit=crop", "stock": 20},
            ],
        },
        "prod-kids-backpack": {
            "has_color_variants": True, "variant_selection_mode": "single",
            "colors": [
                {"color_name": "Pink", "color_code": "#EC4899", "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop", "stock": 12},
                {"color_name": "Blue", "color_code": "#2563EB", "image_url": "https://images.unsplash.com/photo-1577733966973-d680bffd2e80?w=600&h=600&fit=crop", "stock": 15},
                {"color_name": "Green", "color_code": "#22C55E", "image_url": "https://images.unsplash.com/photo-1546938576-6e6a64f317cc?w=600&h=600&fit=crop", "stock": 13},
            ],
        },
    }

    for pid, vdata in variant_updates.items():
        await db.products.update_one({"id": pid}, {"$set": vdata})

    # ---- Reviews ----
    sample_reviews = [
        {"product_id": "prod-iphone15", "user_id": "user-shopper1", "rating": 5, "comment": "Absolutely love this phone! The camera is incredible and the titanium design feels premium."},
        {"product_id": "prod-iphone15", "user_id": "user-shopper2", "rating": 4, "comment": "Great phone, but the price is a bit steep. Camera quality is outstanding though."},
        {"product_id": "prod-sneakers", "user_id": "user-shopper3", "rating": 5, "comment": "Most comfortable sneakers I've ever owned. The memory foam insole makes a huge difference!"},
        {"product_id": "prod-sofa", "user_id": "user-shopper1", "rating": 5, "comment": "Beautiful sofa! Very comfortable and looks amazing in our living room."},
        {"product_id": "prod-espresso-machine", "user_id": "user-shopper2", "rating": 5, "comment": "Makes incredible espresso. The built-in grinder is a game changer."},
        {"product_id": "prod-airpods-pro", "user_id": "user-shopper3", "rating": 4, "comment": "Great sound quality and noise cancellation. Battery life could be better."},
    ]
    
    for r in sample_reviews:
        existing = await db.reviews.find_one({"product_id": r["product_id"], "user_id": r["user_id"]})
        if not existing:
            user_doc = await db.users.find_one({"id": r["user_id"]}, {"_id": 0, "name": 1})
            review = {
                "id": str(uuid.uuid4()),
                "product_id": r["product_id"],
                "user_id": r["user_id"],
                "user_name": user_doc.get("name", "User") if user_doc else "User",
                "rating": r["rating"],
                "comment": r["comment"],
                "helpful_count": random.randint(0, 10),
                "created_at": (now - timedelta(days=random.randint(1, 20))).isoformat()
            }
            await db.reviews.insert_one(review)
    
    # ---- Sample Orders ----
    order_statuses = ["pending", "confirmed", "shipped", "delivered", "paid", "paid"]
    commission_rate_decimal = 0.10  # 10% — matches platform default
    for i in range(8):
        order_id = f"seed-order-{i+1}"
        existing = await db.orders.find_one({"id": order_id})
        if not existing:
            shopper = test_users[i % len(test_users)]
            product = product_data[i % len(product_data)]
            shop_id = product["shop_id"]
            qty = random.randint(1, 3)
            listed_price = product.get("discount_price") or product["price"]
            # Apply commission (on_customer mode by default — shop receives full listed, customer pays more)
            customer_factor = 1.0 + commission_rate_decimal
            shop_factor = 1.0
            customer_price = round(listed_price * customer_factor, 2)
            shop_price = round(listed_price * shop_factor, 2)
            subtotal_customer = round(customer_price * qty, 2)
            subtotal_shop = round(shop_price * qty, 2)
            commission_amount = round(subtotal_customer - subtotal_shop, 2)
            chosen_status = order_statuses[i % len(order_statuses)]
            is_paid = chosen_status == "paid"
            
            order = {
                "id": order_id,
                "user_id": shopper["id"],
                "customer_name": shopper["name"],
                "customer_email": shopper["email"],
                "customer_phone": shopper.get("phone", ""),
                "customer_address": shopper.get("address", ""),
                "customer_city": shopper.get("city", ""),
                "customer_state": shopper.get("state", ""),
                "shop_id": shop_id,
                "shop_ids": [shop_id],
                "items": [{
                    "product_id": product["id"],
                    "name": product["name"],
                    "quantity": qty,
                    "price": customer_price,
                    "original_price": shop_price,
                    "listed_price": listed_price,
                    "subtotal": subtotal_customer,
                    "original_subtotal": subtotal_shop,
                    "shop_id": shop_id,
                    "commission_type": "on_customer",
                    "commission_rate": commission_rate_decimal,
                }],
                "subtotal": subtotal_customer,
                "original_subtotal": subtotal_shop,
                "commission_amount": commission_amount,
                "commission_rate": commission_rate_decimal,
                "commission_type": "on_customer",
                "delivery_fee": 4.0,
                "total_amount": round(subtotal_customer + 4.0, 2),
                "order_status": chosen_status,
                "payment_status": "paid" if (is_paid or i < 6) else "pending",
                "payment_method": "cod",
                "revenue_distributed": is_paid,
                "revenue_distributed_at": now.isoformat() if is_paid else None,
                "created_at": (now - timedelta(days=random.randint(1, 30))).isoformat()
            }
            await db.orders.insert_one(order)
            
            # For paid orders, record admin commission revenue and credit shop wallet
            if is_paid and commission_amount > 0:
                await db.admin_revenue.insert_one({
                    "id": str(uuid.uuid4()),
                    "order_id": order_id,
                    "amount": commission_amount,
                    "type": "commission",
                    "created_at": (now - timedelta(days=random.randint(1, 5))).isoformat()
                })
                # Shop revenue
                await db.shops.update_one(
                    {"id": shop_id},
                    {"$inc": {"total_revenue": subtotal_shop, "wallet_balance": subtotal_shop}}
                )
    
    # ---- Promotions (sponsored products) ----
    promo_products = ["prod-iphone15", "prod-sneakers", "prod-sofa", "prod-espresso-machine"]
    for pid in promo_products:
        promo_id = f"promo-{pid}"
        existing = await db.promotions.find_one({"id": promo_id})
        if not existing:
            product = await db.products.find_one({"id": pid}, {"_id": 0})
            if product:
                promo = {
                    "id": promo_id,
                    "shop_id": product["shop_id"],
                    "product_id": pid,
                    "product_name": product["name"],
                    "status": "active",
                    "daily_price": 2.0,
                    "total_days": 14,
                    "total_cost": 28.0,
                    "start_date": (now - timedelta(days=3)).isoformat(),
                    "end_date": (now + timedelta(days=11)).isoformat(),
                    "views": random.randint(50, 200),
                    "clicks": random.randint(10, 50),
                    "created_at": (now - timedelta(days=3)).isoformat()
                }
                await db.promotions.insert_one(promo)
    
    # ---- Default TOS ----
    existing_tos = await db.tos.find_one({"id": "tos"})
    if not existing_tos:
        await db.tos.insert_one({
            "id": "tos",
            "content": """<h2>Terms of Service</h2>
<p>Welcome to OpenMarket Lebanon. By using our platform, you agree to the following terms and conditions.</p>

<h3>1. General Terms</h3>
<p>By accessing and placing an order with OpenMarket, you confirm that you are in agreement with and bound by the terms of service contained herein.</p>

<h3>2. Products and Pricing</h3>
<p>All prices are listed in USD. We reserve the right to modify prices at any time. Product availability is subject to change without notice.</p>

<h3>3. Orders and Payment</h3>
<p>By placing an order, you are offering to purchase a product on and subject to these terms. All orders are subject to availability and confirmation of the order price.</p>

<h3>4. Delivery</h3>
<p>Delivery times may vary depending on your location. We will make every effort to deliver within the estimated timeframe provided at checkout.</p>

<h3>5. Returns and Refunds</h3>
<p>If you are not satisfied with your purchase, you may request a return within 14 days of delivery. Items must be in their original condition.</p>

<h3>6. Privacy Policy</h3>
<p>Your personal information is collected and used in accordance with our privacy policy. We do not share your data with third parties without your consent.</p>

<h3>7. Contact</h3>
<p>For any questions or concerns, please contact our support team through the contact page.</p>""",
            "updated_at": now.isoformat()
        })
    
    # ---- Platform Settings (ensure exists) ----
    existing_settings = await db.platform_settings.find_one({"id": "platform"})
    if not existing_settings:
        await db.platform_settings.insert_one({
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
            "loyalty_enabled": True,
            "loyalty_points_per_dollar": 10,
            "loyalty_point_value": 0.01,
            "tiers": {
                "pro": {"name": "Pro", "monthly_price": 39, "yearly_price": round(39*12*0.85,2), "product_limit": 0, "commission_rate": 6, "analytics_level": "full", "monthly_wallet_credit": 3, "search_priority": "higher", "badge": "Pro Seller", "report_download": True, "trial_days": 7, "description": "For established sellers who want to maximize their potential."}
            },
            "seller_cta_sale_badge_enabled": False
        })
    
    # ---- Spin Wheel Settings ----
    existing_spin = await db.spin_settings.find_one({"id": "spin"})
    if not existing_spin:
        await db.spin_settings.insert_one({
            "id": "spin",
            "enabled": True,
            "spin_cost_usd": 7.0,
            "outcomes": [
                {"key": "free_sponsors_4", "label": "4 Free Sponsors", "weight": 5, "payload": {"count": 4}},
                {"key": "free_sponsor_10_days", "label": "1 Sponsor (10 days)", "weight": 15, "payload": {"count": 1, "days": 10}},
                {"key": "wallet_credit_small", "label": "+$3 Wallet", "weight": 20, "payload": {"amount": 3}},
                {"key": "wallet_credit_large", "label": "+$8 Wallet", "weight": 20, "payload": {"amount": 8}},
                {"key": "another_spin", "label": "Another Spin!", "weight": 15, "payload": {}},
                {"key": "try_again", "label": "Try Again", "weight": 25, "payload": {}}
            ]
        })
    
    # ---- Product Gifts (for pro shops) ----
    # Add gifts to 2 TechZone products (pro shop)
    gift_products = [
        {"product_id": "prod-iphone15", "shop_id": "shop-techzone", "gift_type": "gift_only", "gift_name": "Premium Phone Case", "gift_image": "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=300&h=300&fit=crop"},
        {"product_id": "prod-macbook-air", "shop_id": "shop-techzone", "gift_type": "gift_only", "gift_name": "USB-C Hub Adapter", "gift_image": "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=300&h=300&fit=crop"},
        {"product_id": "prod-sofa", "shop_id": "shop-homedecor", "gift_type": "gift_only", "gift_name": "Decorative Throw Pillow", "gift_image": "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=300&h=300&fit=crop"},
    ]
    for gp in gift_products:
        existing = await db.product_gifts.find_one({"product_id": gp["product_id"]})
        if not existing:
            await db.product_gifts.insert_one({
                "id": str(uuid.uuid4()),
                "shop_id": gp["shop_id"],
                "product_id": gp["product_id"],
                "gift_type": gp["gift_type"],
                "gift_product_id": None,
                "gift_name": gp["gift_name"],
                "gift_image": gp["gift_image"],
                "is_active": True,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            })
    
    # ---- Grant free spin to pro shops ----
    pro_shops_list = ["shop-techzone", "shop-homedecor"]
    for ps_id in pro_shops_list:
        existing_spin_state = await db.shop_spin_state.find_one({"shop_id": ps_id})
        if not existing_spin_state:
            await db.shop_spin_state.insert_one({
                "shop_id": ps_id,
                "free_spins_balance": 1,
                "last_monthly_grant_at": now.isoformat()
            })
    
    return {"status": "ok", "message": "Seed data created successfully", "data": {
        "categories": len(categories),
        "states": len(states),
        "users": len(test_users),
        "shops": len(shops),
        "products": len(product_data),
        "orders": 8,
        "promotions": len(promo_products)
    }}


@router.get("/admin/finance-center")
async def get_admin_finance_center(admin: Dict = Depends(require_admin), year: Optional[int] = None, month: Optional[int] = None):
    """Admin Finance Center: All money the admin has - admin revenue breakdown + shop order money.

    Optional ?year=YYYY&month=MM filters all time-based money flows (profit components +
    held-money flows like pending orders, held delivery fees, delivery-owed cash) to the
    selected period. Live wallet balances (shop/agent) are always current snapshots.
    """
    now = datetime.now(timezone.utc)

    # --- PERIOD FILTER HELPER (matches a doc's date against ?year/?month) ---
    period_active = year is not None

    def _inp(doc, *date_fields):
        """True if doc's date falls in the requested period (or no period requested)."""
        if year is None:
            return True
        v = ""
        for f in (date_fields or ("created_at",)):
            val = doc.get(f)
            if val:
                v = val
                break
        if not isinstance(v, str) or len(v) < 7:
            return False
        if month is None:
            return v[:4] == f"{year:04d}"
        return v[:7] == f"{year:04d}-{month:02d}"

    # Period label + bounds (for UI display)
    if year is None:
        period_label = "All time"
        period_range = {"start": None, "end": None}
    elif month is None:
        period_label = f"{year}"
        period_range = {"start": f"{year:04d}-01-01", "end": f"{year:04d}-12-31"}
    else:
        import calendar as _cal
        _last = _cal.monthrange(year, month)[1]
        period_label = datetime(year, month, 1).strftime("%B %Y")
        period_range = {"start": f"{year:04d}-{month:02d}-01", "end": f"{year:04d}-{month:02d}-{_last:02d}"}

    # --- ADMIN REVENUE ---
    # 1. Subscriptions (from subscription_payments collection)
    subscription_payments = await db.subscription_payments.find({}, {"_id": 0}).to_list(10000)
    subscription_payments = [p for p in subscription_payments if _inp(p, "created_at")]
    total_subscriptions = round(sum(p.get("amount", 0) for p in subscription_payments), 2)
    
    # Also include subscription revenue from admin_ledger (auto-renew from wallet)
    sub_ledger = await db.admin_ledger.find({"type": "subscriptions"}, {"_id": 0}).to_list(10000)
    sub_ledger = [e for e in sub_ledger if _inp(e, "created_at")]
    total_subscriptions += round(sum(e.get("amount", 0) for e in sub_ledger), 2)
    
    # 2. Commissions (from paid orders) with per-shop breakdown
    all_paid_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(10000)
    all_paid_orders = [o for o in all_paid_orders if _inp(o, "paid_at", "created_at")]
    total_commissions = round(sum(order.get("commission_amount", 0) for order in all_paid_orders), 2)
    
    # Build commission breakdown by shop
    commission_by_shop = {}
    for order in all_paid_orders:
        shop_id = order.get("shop_id", "unknown")
        comm = order.get("commission_amount", 0)
        if comm > 0:
            if shop_id not in commission_by_shop:
                commission_by_shop[shop_id] = {"shop_id": shop_id, "total_commission": 0, "order_count": 0, "total_order_value": 0}
            commission_by_shop[shop_id]["total_commission"] = round(commission_by_shop[shop_id]["total_commission"] + comm, 2)
            commission_by_shop[shop_id]["order_count"] += 1
            commission_by_shop[shop_id]["total_order_value"] = round(commission_by_shop[shop_id]["total_order_value"] + order.get("total_amount", 0), 2)
    
    # Enrich with shop names and commission types (batch query)
    all_breakdown_shop_ids = list(commission_by_shop.keys())
    if all_breakdown_shop_ids:
        breakdown_shops = await db.shops.find(
            {"id": {"$in": all_breakdown_shop_ids}},
            {"_id": 0, "id": 1, "name": 1, "commission_type": 1, "commission_percentage": 1, "tier": 1}
        ).to_list(len(all_breakdown_shop_ids))
        shop_info_map = {s["id"]: s for s in breakdown_shops}
    else:
        shop_info_map = {}
    
    for shop_id, breakdown in commission_by_shop.items():
        shop_doc = shop_info_map.get(shop_id)
        if shop_doc:
            breakdown["shop_name"] = shop_doc.get("name", "Unknown")
            breakdown["commission_type"] = shop_doc.get("commission_type", "on_customer")
            breakdown["commission_percentage"] = shop_doc.get("commission_percentage")
            breakdown["tier"] = shop_doc.get("tier", "starter")
        else:
            breakdown["shop_name"] = "Unknown"
            breakdown["commission_type"] = "on_customer"
            breakdown["commission_percentage"] = None
            breakdown["tier"] = "starter"
    
    commission_breakdown = sorted(commission_by_shop.values(), key=lambda x: x["total_commission"], reverse=True)
    
    # 3. Adjustments
    adjustments = await db.revenue_adjustments.find({}, {"_id": 0}).to_list(10000)
    adjustments = [a for a in adjustments if _inp(a, "created_at")]
    total_adjustments = round(sum(a.get("amount", 0) for a in adjustments), 2)
    
    # 4. Platform Services (spin wheel + product boost) - from admin_ledger
    platform_services = await db.admin_ledger.find({"type": "platform_services"}, {"_id": 0}).to_list(10000)
    platform_services = [e for e in platform_services if _inp(e, "created_at")]
    total_platform_services = round(sum(_ps_amount(e) for e in platform_services), 2)
    
    # 5. Monthly Credits given to shops (deduction) - from admin_ledger
    monthly_credits = await db.admin_ledger.find({"type": "monthly_credits"}, {"_id": 0}).to_list(10000)
    monthly_credits = [e for e in monthly_credits if _inp(e, "created_at")]
    total_monthly_credits = round(sum(e.get("amount", 0) for e in monthly_credits), 2)
    
    # 6. Admin Cash Out total (money admin has withdrawn from platform)
    admin_cashouts_list = await db.admin_cashouts.find({"status": {"$in": ["approved", "completed"]}}, {"_id": 0}).to_list(10000)
    admin_cashouts_list = [c for c in admin_cashouts_list if _inp(c, "created_at")]
    total_admin_cashouts = round(sum(c.get("amount", 0) for c in admin_cashouts_list), 2)
    
    # 7. Loyalty Points Deductions (money paid to shops for loyalty point usage)
    loyalty_deductions = await db.admin_ledger.find({"type": "loyalty_points_deduction"}, {"_id": 0}).to_list(10000)
    loyalty_deductions = [e for e in loyalty_deductions if _inp(e, "created_at")]
    total_loyalty_deductions = round(abs(sum(e.get("amount", 0) for e in loyalty_deductions)), 2)

    # 8. Agent Payouts (referral agent commissions + approval bonuses) – deduction from admin profit
    agent_payouts_entries = await db.admin_ledger.find({"type": "agent_payouts"}, {"_id": 0}).to_list(10000)
    agent_payouts_entries = [e for e in agent_payouts_entries if _inp(e, "created_at")]
    total_agent_payouts = round(sum(e.get("amount", 0) for e in agent_payouts_entries), 2)
    total_agent_commission_payouts = round(sum(e.get("amount", 0) for e in agent_payouts_entries if e.get("subtype") == "agent_commission"), 2)
    total_agent_approval_bonus = round(sum(e.get("amount", 0) for e in agent_payouts_entries if e.get("subtype") == "agent_approval_bonus"), 2)
    
    # Admin PROFIT = Subscriptions + Commissions + Adjustments + Platform Services - Monthly Credits - Loyalty Deductions - Agent Payouts
    admin_profit = round(total_subscriptions + total_commissions + total_adjustments + total_platform_services - total_monthly_credits - total_loyalty_deductions - total_agent_payouts, 2)
    
    # Net admin revenue alias for backward compat (same as profit)
    net_admin_revenue = admin_profit
    
    # Available admin balance = profit - cashouts
    available_admin_balance = round(admin_profit - total_admin_cashouts, 2)
    
    # --- SHOP ORDER MONEY (money from orders not yet cashed out, excluding delivery fees) ---
    approved_shops = await db.shops.find({"status": "approved"}, {"_id": 0}).to_list(1000)
    
    shop_order_money = []
    total_shop_order_money = 0
    
    for shop in approved_shops:
        # Get wallet balance (order money that hasn't been cashed out)
        wallet_balance = shop.get("wallet_balance", 0) or 0
        
        # Get total cashed out
        approved_cashouts = await db.cashout_requests.find(
            {"shop_id": shop["id"], "status": "approved"}, {"_id": 0, "amount": 1}
        ).to_list(1000)
        total_cashed_out = sum(c.get("amount", 0) for c in approved_cashouts)
        
        # Get pending cashouts
        pending_cashouts = await db.cashout_requests.find(
            {"shop_id": shop["id"], "status": "pending"}, {"_id": 0, "amount": 1}
        ).to_list(1000)
        total_pending_cashout = sum(c.get("amount", 0) for c in pending_cashouts)
        
        shop_order_money.append({
            "shop_id": shop["id"],
            "shop_name": shop.get("name", ""),
            "wallet_balance": wallet_balance,
            "total_cashed_out": total_cashed_out,
            "pending_cashout": total_pending_cashout,
            "tier": shop.get("tier", "starter"),
        })
        total_shop_order_money += wallet_balance
    
    # --- PENDING ORDERS (paid by card or wallet, not yet "paid" status) ---
    pending_wallet_card_orders = await db.orders.find(
        {
            "$or": [
                {"wallet_paid": True},
                {"payment_method": {"$in": ["wallet", "card"]}}
            ],
            "order_status": {"$nin": ["paid", "cancelled"]}
        },
        {"_id": 0}
    ).to_list(10000)
    pending_wallet_card_orders = [o for o in pending_wallet_card_orders if _inp(o, "created_at")]
    
    pending_orders_list = []
    total_pending_orders_money = 0
    for po in pending_wallet_card_orders:
        pending_orders_list.append({
            "order_id": po["id"],
            "total_amount": po.get("total_amount", 0),
            "commission_amount": po.get("commission_amount", 0),
            "delivery_fee": po.get("delivery_fee", 0),
            "shop_revenue": po.get("shop_revenue_amount", 0) or sum(item.get("original_subtotal", item.get("subtotal", 0)) for item in po.get("items", [])),
            "order_status": po.get("order_status", "pending"),
            "payment_method": po.get("payment_method", ""),
            "created_by_shop": po.get("created_by_shop", ""),
            "customer_name": po.get("customer_name", ""),
            "created_at": po.get("created_at", ""),
        })
        total_pending_orders_money += po.get("total_amount", 0)
    
    # --- DELIVERY FEES (held, from paid wallet/card orders) ---
    held_delivery_fees_list = await db.held_delivery_fees.find({}, {"_id": 0}).to_list(10000)
    held_delivery_fees_list = [f for f in held_delivery_fees_list if _inp(f, "created_at")]
    unreleased_delivery_fees = [f for f in held_delivery_fees_list if not f.get("released")]
    released_delivery_fees = [f for f in held_delivery_fees_list if f.get("released")]
    total_unreleased_delivery = round(sum(f.get("amount", 0) for f in unreleased_delivery_fees), 2)
    total_released_delivery = round(sum(f.get("amount", 0) for f in released_delivery_fees), 2)
    
    # Enrich delivery fees with order info
    delivery_fees_display = []
    for fee in held_delivery_fees_list:
        order_doc = await db.orders.find_one({"id": fee.get("order_id")}, {"_id": 0, "customer_name": 1, "order_status": 1, "payment_method": 1, "created_by_shop": 1})
        shop_doc = await db.shops.find_one({"id": fee.get("shop_id")}, {"_id": 0, "name": 1}) if fee.get("shop_id") else None
        delivery_fees_display.append({
            **fee,
            "customer_name": order_doc.get("customer_name", "") if order_doc else "",
            "order_status": order_doc.get("order_status", "") if order_doc else "",
            "payment_method": order_doc.get("payment_method", "") if order_doc else "",
            "shop_name": shop_doc.get("name", "") if shop_doc else "",
        })
    
    # --- DELIVERY-OWED CASH (money the delivery person collected from delivered orders, owes to admin, excluding delivery fees) ---
    # Fetch ALL delivered orders — whether marked delivered by a delivery agent
    # (delivery_status) or by the admin (order_status).
    delivered_orders = await db.orders.find(
        {"$or": [{"delivery_status": "delivered"}, {"order_status": "delivered"}]},
        {"_id": 0}
    ).to_list(20000)
    delivered_orders = [o for o in delivered_orders if _inp(o, "delivered_at", "updated_at", "created_at")]
    
    delivery_owed_by_agent = {}
    delivery_owed_orders = []  # flat list of ALL owed orders (no agent grouping)
    total_delivery_owed = 0.0
    total_orders_owed = 0
    total_settled_owed = 0.0
    total_settled_count = 0
    for o in delivered_orders:
        # Cash-on-delivery orders ONLY — delivery collects cash for these. Card/wallet
        # (and any other online method) are paid online, so they're excluded here.
        payment_method = (o.get("payment_method") or "").lower()
        payment_status = (o.get("payment_status") or "").lower()
        if payment_method not in ("cod", "cash", "cash_on_delivery", ""):
            continue
        total_amount = float(o.get("total_amount", 0) or 0)
        delivery_fee = float(o.get("delivery_fee", 0) or 0)
        amount_owed = round(max(0, total_amount - delivery_fee), 2)
        if amount_owed <= 0:
            continue
        agent_id = o.get("delivery_user_id", "") or "unassigned"
        agent_name = o.get("delivery_user_name", "") or "Unassigned"
        # Once an order is paid/settled it drops off this table entirely.
        settled = bool(o.get("delivery_cash_settled", False)) or payment_status == "paid"
        if settled:
            continue
        if agent_id not in delivery_owed_by_agent:
            delivery_owed_by_agent[agent_id] = {
                "delivery_user_id": agent_id,
                "delivery_user_name": agent_name,
                "amount_owed": 0.0,
                "settled_amount": 0.0,
                "order_count": 0,
                "settled_count": 0,
                "orders": [],
            }
        bucket = delivery_owed_by_agent[agent_id]
        bucket["order_count"] += 1
        if settled:
            bucket["settled_amount"] = round(bucket["settled_amount"] + amount_owed, 2)
            bucket["settled_count"] += 1
            total_settled_owed = round(total_settled_owed + amount_owed, 2)
            total_settled_count += 1
        else:
            bucket["amount_owed"] = round(bucket["amount_owed"] + amount_owed, 2)
            total_delivery_owed = round(total_delivery_owed + amount_owed, 2)
            total_orders_owed += 1
        order_entry = {
            "order_id": o.get("id"),
            "customer_name": o.get("customer_name") or o.get("guest_name") or "Customer",
            "total_amount": total_amount,
            "delivery_fee": delivery_fee,
            "amount_owed": amount_owed,
            "delivered_at": o.get("delivered_at") or o.get("updated_at") or "",
            "payment_method": payment_method,
            "settled": settled,
        }
        bucket["orders"].append(order_entry)
        # Flat list (no agent grouping)
        delivery_owed_orders.append(order_entry)
    
    delivery_owed_breakdown = sorted(delivery_owed_by_agent.values(), key=lambda x: x.get("amount_owed", 0), reverse=True)
    # Flat list: unsettled first, then by most-recent delivery
    delivery_owed_orders.sort(key=lambda x: (x.get("settled", False), x.get("delivered_at", "")), reverse=True)
    delivery_owed_orders.sort(key=lambda x: x.get("settled", False))
    
    # --- AGENT MONEY (referral agents — wallets held + pending cash-outs) ---
    all_referral_agents = await db.users.find(
        {"role": "agent"},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "first_name": 1, "last_name": 1, "wallet_balance": 1, "commission_share_percent": 1, "approval_bonus_amount": 1, "referral_code": 1, "phone": 1, "state": 1}
    ).to_list(2000)

    agent_money_list = []
    total_agent_money_held = 0.0
    for a in all_referral_agents:
        wallet_bal = round(float(a.get("wallet_balance") or 0), 2)
        # Earned (lifetime credits)
        earned_doc = await db.agent_wallet_transactions.aggregate([
            {"$match": {"agent_id": a["id"], "amount": {"$gt": 0}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(1)
        total_earned = round(earned_doc[0]["total"], 2) if earned_doc else 0.0
        # Cashed-out
        cashed_doc = await db.agent_wallet_transactions.aggregate([
            {"$match": {"agent_id": a["id"], "type": "agent_cashout"}},
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
        ]).to_list(1)
        total_cashed = round(cashed_doc[0]["total"], 2) if cashed_doc else 0.0
        # Pending cash-out requests
        pending_cashout_doc = await db.agent_cashout_requests.aggregate([
            {"$match": {"agent_id": a["id"], "status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(1)
        pending_cashout_amt = round(pending_cashout_doc[0]["total"], 2) if pending_cashout_doc else 0.0
        # Referred shop counts
        referred = await db.shops.count_documents({"referred_by_agent_id": a["id"]})
        referred_approved = await db.shops.count_documents({"referred_by_agent_id": a["id"], "status": "approved"})
        agent_money_list.append({
            "agent_id": a["id"],
            "name": a.get("name"),
            "email": a.get("email"),
            "phone": a.get("phone"),
            "state": a.get("state"),
            "referral_code": a.get("referral_code"),
            "commission_share_percent": float(a.get("commission_share_percent") if a.get("commission_share_percent") is not None else 30.0),
            "approval_bonus_amount": float(a.get("approval_bonus_amount") if a.get("approval_bonus_amount") is not None else 4.0),
            "wallet_balance": wallet_bal,
            "total_earned": total_earned,
            "total_cashed_out": total_cashed,
            "pending_cashout_amount": pending_cashout_amt,
            "referred_shops_count": referred,
            "referred_shops_approved": referred_approved,
        })
        total_agent_money_held += wallet_bal

    agent_pending_cashout_count = await db.agent_cashout_requests.count_documents({"status": "pending"})
    agent_pending_cashout_doc = await db.agent_cashout_requests.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    total_agent_pending_cashout = round(agent_pending_cashout_doc[0]["total"], 2) if agent_pending_cashout_doc else 0.0

    return {
        "admin_revenue": {
            "net_total": net_admin_revenue,
            "admin_profit": admin_profit,
            "available_balance": available_admin_balance,
            "subscriptions": total_subscriptions,
            "commissions": total_commissions,
            "adjustments": total_adjustments,
            "platform_services": total_platform_services,
            "monthly_credits": total_monthly_credits,
            "admin_cashouts": total_admin_cashouts,
            "loyalty_deductions": total_loyalty_deductions,
            "agent_payouts": total_agent_payouts,
            "agent_commission_payouts": total_agent_commission_payouts,
            "agent_approval_bonus_payouts": total_agent_approval_bonus,
            "commission_breakdown": commission_breakdown,
        },
        "shop_order_money": {
            "total": round(total_shop_order_money, 2),
            "shops": sorted(shop_order_money, key=lambda x: x.get("wallet_balance", 0), reverse=True),
        },
        "agent_money": {
            "total": round(total_agent_money_held, 2),
            "agents": sorted(agent_money_list, key=lambda x: x.get("wallet_balance", 0), reverse=True),
            "pending_cashout_count": agent_pending_cashout_count,
            "pending_cashout_amount": total_agent_pending_cashout,
        },
        "pending_orders": {
            "total": round(total_pending_orders_money, 2),
            "orders": sorted(pending_orders_list, key=lambda x: x.get("created_at", ""), reverse=True),
        },
        "delivery_fees": {
            "total_unreleased": total_unreleased_delivery,
            "total_released": total_released_delivery,
            "fees": sorted(delivery_fees_display, key=lambda x: x.get("created_at", ""), reverse=True),
        },
        "delivery_owed": {
            "total": round(total_delivery_owed, 2),
            "orders_owed_count": total_orders_owed,
            "settled_total": round(total_settled_owed, 2),
            "settled_count": total_settled_count,
            "orders": delivery_owed_orders,
            "by_agent": delivery_owed_breakdown,
        },
        "total_money_held": round(available_admin_balance + total_shop_order_money + total_agent_money_held + total_pending_orders_money + total_unreleased_delivery, 2),
        "period": {
            "active": period_active,
            "year": year,
            "month": month,
            "label": period_label,
            "range": period_range,
        },
    }


@router.get("/admin/finance-center/timeseries")
async def get_finance_timeseries(admin: Dict = Depends(require_admin), year: Optional[int] = None):
    """Per-month finance time series for the Finance Center analytics/graphs.

    Returns profit + its components + held-money flows for each month. If ?year is
    provided, returns the 12 months of that year; otherwise the most recent 12 months
    that have data (plus current month).
    """
    from collections import defaultdict

    def _mk(created):
        if isinstance(created, str) and len(created) >= 7:
            return created[:7]
        return None

    buckets = defaultdict(lambda: {
        "subscriptions": 0.0, "commissions": 0.0, "adjustments": 0.0,
        "platform_services": 0.0, "monthly_credits": 0.0, "loyalty_deductions": 0.0,
        "agent_payouts": 0.0, "pending_held": 0.0, "delivery_held": 0.0, "orders": 0,
    })

    # Subscriptions (payments + ledger)
    for p in await db.subscription_payments.find({}, {"_id": 0, "created_at": 1, "amount": 1}).to_list(20000):
        mk = _mk(p.get("created_at"))
        if mk: buckets[mk]["subscriptions"] += p.get("amount", 0) or 0
    for e in await db.admin_ledger.find({"type": "subscriptions"}, {"_id": 0, "created_at": 1, "amount": 1}).to_list(20000):
        mk = _mk(e.get("created_at"))
        if mk: buckets[mk]["subscriptions"] += e.get("amount", 0) or 0

    # Commissions + pending held (from orders)
    for o in await db.orders.find({"payment_status": "paid"}, {"_id": 0, "paid_at": 1, "created_at": 1, "commission_amount": 1}).to_list(50000):
        mk = _mk(o.get("paid_at") or o.get("created_at"))
        if mk:
            buckets[mk]["commissions"] += o.get("commission_amount", 0) or 0
            buckets[mk]["orders"] += 1

    # Adjustments
    for a in await db.revenue_adjustments.find({}, {"_id": 0, "created_at": 1, "amount": 1}).to_list(20000):
        mk = _mk(a.get("created_at"))
        if mk: buckets[mk]["adjustments"] += a.get("amount", 0) or 0

    # Ledger flows
    for e in await db.admin_ledger.find({"type": "platform_services"}, {"_id": 0, "created_at": 1, "amount": 1, "direction": 1}).to_list(50000):
        mk = _mk(e.get("created_at"))
        if mk: buckets[mk]["platform_services"] += _ps_amount(e)
    for e in await db.admin_ledger.find({"type": "monthly_credits"}, {"_id": 0, "created_at": 1, "amount": 1}).to_list(50000):
        mk = _mk(e.get("created_at"))
        if mk: buckets[mk]["monthly_credits"] += e.get("amount", 0) or 0
    for e in await db.admin_ledger.find({"type": "loyalty_points_deduction"}, {"_id": 0, "created_at": 1, "amount": 1}).to_list(50000):
        mk = _mk(e.get("created_at"))
        if mk: buckets[mk]["loyalty_deductions"] += abs(e.get("amount", 0) or 0)
    for e in await db.admin_ledger.find({"type": "agent_payouts"}, {"_id": 0, "created_at": 1, "amount": 1}).to_list(50000):
        mk = _mk(e.get("created_at"))
        if mk: buckets[mk]["agent_payouts"] += e.get("amount", 0) or 0

    # Pending held orders (wallet/card, not yet paid)
    for o in await db.orders.find(
        {"$or": [{"wallet_paid": True}, {"payment_method": {"$in": ["wallet", "card"]}}], "order_status": {"$nin": ["paid", "cancelled"]}},
        {"_id": 0, "created_at": 1, "total_amount": 1}
    ).to_list(50000):
        mk = _mk(o.get("created_at"))
        if mk: buckets[mk]["pending_held"] += o.get("total_amount", 0) or 0

    # Held delivery fees (unreleased)
    for f in await db.held_delivery_fees.find({}, {"_id": 0, "created_at": 1, "amount": 1, "released": 1}).to_list(50000):
        if f.get("released"):
            continue
        mk = _mk(f.get("created_at"))
        if mk: buckets[mk]["delivery_held"] += f.get("amount", 0) or 0

    # Determine which months to return
    all_keys = sorted(buckets.keys())
    now = datetime.now(timezone.utc)
    if year is not None:
        keys = [f"{year:04d}-{m:02d}" for m in range(1, 13)]
    else:
        # last 12 months ending current month
        keys = []
        y, m = now.year, now.month
        for _ in range(12):
            keys.append(f"{y:04d}-{m:02d}")
            m -= 1
            if m == 0:
                m = 12; y -= 1
        keys = sorted(keys)

    series = []
    for k in keys:
        b = buckets.get(k, None) or {
            "subscriptions": 0.0, "commissions": 0.0, "adjustments": 0.0,
            "platform_services": 0.0, "monthly_credits": 0.0, "loyalty_deductions": 0.0,
            "agent_payouts": 0.0, "pending_held": 0.0, "delivery_held": 0.0, "orders": 0,
        }
        profit = round(
            b["subscriptions"] + b["commissions"] + b["adjustments"] + b["platform_services"]
            - b["monthly_credits"] - b["loyalty_deductions"] - b["agent_payouts"], 2
        )
        try:
            label = datetime.strptime(k, "%Y-%m").strftime("%b %Y")
        except Exception:
            label = k
        series.append({
            "month": k,
            "label": label,
            "short": label.split(" ")[0],
            "subscriptions": round(b["subscriptions"], 2),
            "commissions": round(b["commissions"], 2),
            "adjustments": round(b["adjustments"], 2),
            "platform_services": round(b["platform_services"], 2),
            "monthly_credits": round(b["monthly_credits"], 2),
            "loyalty_deductions": round(b["loyalty_deductions"], 2),
            "agent_payouts": round(b["agent_payouts"], 2),
            "pending_held": round(b["pending_held"], 2),
            "delivery_held": round(b["delivery_held"], 2),
            "held_total": round(b["pending_held"] + b["delivery_held"], 2),
            "orders": b["orders"],
            "profit": profit,
        })

    available_years = sorted({int(k[:4]) for k in all_keys if k[:4].isdigit()})
    if now.year not in available_years:
        available_years.append(now.year)
    available_years = sorted(set(available_years))

    return {"series": series, "year": year, "available_years": available_years}


@router.post("/admin/delivery-fees/{fee_id}/release")
async def release_delivery_fee(fee_id: str, admin: Dict = Depends(require_admin)):
    """Release a held delivery fee - decrease from money held"""
    if not fee:
        raise HTTPException(status_code=404, detail="Delivery fee record not found")
    if fee.get("released"):
        raise HTTPException(status_code=400, detail="This delivery fee has already been released")
    
    await db.held_delivery_fees.update_one(
        {"id": fee_id},
        {"$set": {"released": True, "released_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Delivery fee released successfully", "amount": fee.get("amount", 0)}


@router.post("/admin/delivery-cash/settle/{order_id}")
async def settle_delivery_cash(order_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Confirm a delivered order's cash and mark the order PAID. This records the
    admin commission, credits the shop, and distributes the referral agent's share."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    is_delivered = order.get("delivery_status") == "delivered" or order.get("order_status") == "delivered"
    if not is_delivered:
        raise HTTPException(status_code=400, detail="Order is not yet delivered")
    if order.get("payment_status") == "paid" or order.get("delivery_cash_settled"):
        raise HTTPException(status_code=400, detail="This order is already paid")

    total_amount = float(order.get("total_amount", 0) or 0)
    delivery_fee = float(order.get("delivery_fee", 0) or 0)
    amount_owed = round(max(0, total_amount - delivery_fee), 2)
    now = datetime.now(timezone.utc).isoformat()

    await db.orders.update_one({"id": order_id}, {"$set": {
        "delivery_cash_settled": True,
        "delivery_cash_settled_at": now,
        "paid_at": now,
        "order_status": "paid",  # delivered -> paid
    }})
    # Mark the order PAID with the full distribution (commission -> admin profit,
    # shop revenue credit, 50% cashback, referral agent's commission share).
    from routers.orders_routes import settle_order_as_paid
    await settle_order_as_paid(order_id)

    return {"message": "Order marked as paid", "order_id": order_id, "amount_settled": amount_owed}


@router.post("/admin/delivery-cash/settle-bulk")
async def settle_delivery_cash_bulk(request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Mark all delivered + unpaid cash orders as paid (optionally for one agent).
    Each order is fully settled (commission -> admin profit, shop revenue, agent share)."""
    body = await request.json()
    agent_id = body.get("delivery_user_id")
    now = datetime.now(timezone.utc).isoformat()
    if not agent_id:
        raise HTTPException(status_code=400, detail="delivery_user_id is required")

    conditions = [
        {"$or": [{"delivery_status": "delivered"}, {"order_status": "delivered"}]},
        {"payment_status": {"$ne": "paid"}},
        {"delivery_cash_settled": {"$ne": True}},
        {"payment_method": {"$nin": ["card", "wallet"]}},
    ]
    if agent_id == "unassigned":
        conditions.append({"$or": [{"delivery_user_id": ""}, {"delivery_user_id": None}, {"delivery_user_id": {"$exists": False}}]})
    elif agent_id != "all":
        conditions.append({"delivery_user_id": agent_id})
    query = {"$and": conditions}

    orders = await db.orders.find(query, {"_id": 0, "id": 1}).to_list(20000)
    from routers.orders_routes import settle_order_as_paid
    count = 0
    for o in orders:
        await db.orders.update_one({"id": o["id"]}, {"$set": {"delivery_cash_settled": True, "delivery_cash_settled_at": now, "paid_at": now, "order_status": "paid"}})
        await settle_order_as_paid(o["id"])
        count += 1
    return {"message": f"Marked {count} order(s) as paid", "settled_count": count}


@router.get("/admin/finance/transactions")
async def get_finance_transactions(
    type: str = "all",
    page: int = 1,
    limit: int = 50,
    admin: Dict = Depends(require_admin)
):
    """Get transactions for a specific admin revenue section"""
    skip = (page - 1) * limit
    transactions = []
    total = 0
    
    if type == "subscriptions":
        # From subscription_payments + admin_ledger subscriptions
        payments = await db.subscription_payments.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        ledger_subs = await db.admin_ledger.find({"type": "subscriptions"}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        combined = []
        for p in payments:
            combined.append({**p, "source": "subscription_payment"})
        for l in ledger_subs:
            combined.append({**l, "source": "wallet_renewal"})
        combined.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        transactions = combined[skip:skip+limit]
        total = await db.subscription_payments.count_documents({}) + await db.admin_ledger.count_documents({"type": "subscriptions"})
    
    elif type == "commissions":
        orders = await db.orders.find(
            {"payment_status": "paid", "commission_amount": {"$gt": 0}},
            {"_id": 0, "id": 1, "commission_amount": 1, "total_amount": 1, "customer_name": 1, "created_at": 1, "shop_id": 1}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = [{
            "id": o.get("id"),
            "amount": o.get("commission_amount", 0),
            "order_total": o.get("total_amount", 0),
            "customer_name": o.get("customer_name", ""),
            "shop_id": o.get("shop_id", ""),
            "created_at": o.get("created_at", ""),
            "note": f"Commission from order #{o.get('id', '')}"
        } for o in orders]
        total = await db.orders.count_documents({"payment_status": "paid", "commission_amount": {"$gt": 0}})
    
    elif type == "adjustments":
        adjustments = await db.revenue_adjustments.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = adjustments
        total = await db.revenue_adjustments.count_documents({})
    
    elif type == "platform_services":
        entries = await db.admin_ledger.find({"type": "platform_services"}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = entries
        total = await db.admin_ledger.count_documents({"type": "platform_services"})
    
    elif type == "monthly_credits":
        entries = await db.admin_ledger.find({"type": "monthly_credits"}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = entries
        total = await db.admin_ledger.count_documents({"type": "monthly_credits"})
    
    elif type == "admin_cashouts":
        entries = await db.admin_cashouts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = [{
            "id": e.get("id"),
            "amount": e.get("amount", 0),
            "note": e.get("note", "Admin revenue cash out"),
            "status": e.get("status", "completed"),
            "created_at": e.get("created_at", ""),
        } for e in entries]
        total = await db.admin_cashouts.count_documents({})
    
    elif type == "loyalty_deductions":
        entries = await db.admin_ledger.find({"type": "loyalty_points_deduction"}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = entries
        total = await db.admin_ledger.count_documents({"type": "loyalty_points_deduction"})

    elif type in ("shop_referral_first_pay", "agent_approval_bonus"):
        # "Shop referrals first pay" = the $4 approval bonuses paid to agents when a referred shop is approved
        q = {"type": "agent_payouts", "subtype": "agent_approval_bonus"}
        entries = await db.admin_ledger.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = entries
        total = await db.admin_ledger.count_documents(q)

    elif type == "agent_commission":
        q = {"type": "agent_payouts", "subtype": "agent_commission"}
        entries = await db.admin_ledger.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = entries
        total = await db.admin_ledger.count_documents(q)

    elif type == "agent_payouts":
        q = {"type": "agent_payouts"}
        entries = await db.admin_ledger.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = entries
        total = await db.admin_ledger.count_documents(q)
    
    else:  # all
        all_entries = await db.admin_ledger.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        transactions = all_entries
        total = await db.admin_ledger.count_documents({})
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }


@router.post("/admin/revenue/cashout")
async def admin_cashout_revenue(request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Cash out from platform revenue"""
    body = await request.json()
    amount = body.get("amount", 0)
    note = body.get("note", "Admin revenue cash out")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # Calculate available admin revenue
    subscription_payments = await db.subscription_payments.find({}, {"_id": 0}).to_list(10000)
    total_subscriptions = round(sum(p.get("amount", 0) for p in subscription_payments), 2)
    sub_ledger = await db.admin_ledger.find({"type": "subscriptions"}, {"_id": 0}).to_list(10000)
    total_subscriptions += round(sum(e.get("amount", 0) for e in sub_ledger), 2)
    
    all_paid_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(10000)
    total_commissions = round(sum(order.get("commission_amount", 0) for order in all_paid_orders), 2)
    
    adjustments = await db.revenue_adjustments.find({}, {"_id": 0}).to_list(10000)
    total_adjustments = round(sum(a.get("amount", 0) for a in adjustments), 2)
    
    platform_services = await db.admin_ledger.find({"type": "platform_services"}, {"_id": 0}).to_list(10000)
    total_platform_services = round(sum(_ps_amount(e) for e in platform_services), 2)

    # Get total previous admin cashouts
    prev_cashouts = await db.admin_cashouts.find({"status": {"$in": ["approved", "completed"]}}, {"_id": 0}).to_list(10000)
    total_cashed_out = round(sum(c.get("amount", 0) for c in prev_cashouts), 2)
    
    net_revenue = round(total_subscriptions + total_commissions + total_adjustments + total_platform_services, 2)
    available_revenue = round(net_revenue - total_cashed_out, 2)
    
    if amount > available_revenue:
        raise HTTPException(status_code=400, detail=f"Insufficient available revenue. Available: ${available_revenue:.2f}")
    
    now = datetime.now(timezone.utc)
    cashout_doc = {
        "id": str(uuid.uuid4()),
        "admin_id": admin["user_id"],
        "amount": amount,
        "note": note,
        "status": "completed",
        "created_at": now.isoformat(),
    }
    await db.admin_cashouts.insert_one(cashout_doc)
    
    new_available = round(available_revenue - amount, 2)
    return {
        "message": f"Successfully cashed out ${amount:.2f}",
        "cashout": {k: v for k, v in cashout_doc.items() if k != "_id"},
        "available_revenue": new_available,
        "total_cashed_out": round(total_cashed_out + amount, 2)
    }


@router.get("/admin/revenue/cashouts")
async def get_admin_cashouts(admin: Dict = Depends(require_admin)):
    """Admin: Get all admin cash out history"""
    cashouts = await db.admin_cashouts.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    total = round(sum(c.get("amount", 0) for c in cashouts), 2)
    return {"cashouts": cashouts, "total_cashed_out": total}


@router.put("/admin/subscription-tiers/descriptions")
async def update_tier_descriptions(request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Update tier descriptions shown to users"""
    body = await request.json()
    
    update_fields = {}
    if "starter_description" in body:
        update_fields["tiers.starter.description"] = body["starter_description"]
    if "pro_description" in body:
        update_fields["tiers.pro.description"] = body["pro_description"]
    if "yearly_discount_percent" in body:
        update_fields["yearly_discount_percent"] = float(body["yearly_discount_percent"])
    if "seller_cta_sale_badge_enabled" in body:
        update_fields["seller_cta_sale_badge_enabled"] = bool(body["seller_cta_sale_badge_enabled"])
    # Per-tier yearly sale percentage
    if "starter_yearly_sale_percent" in body:
        update_fields["tiers.starter.yearly_sale_percent"] = float(body["starter_yearly_sale_percent"])
    if "pro_yearly_sale_percent" in body:
        update_fields["tiers.pro.yearly_sale_percent"] = float(body["pro_yearly_sale_percent"])
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.platform_settings.find_one_and_update(
        {"id": "platform"},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0}
    )
    return {"message": "Tier settings updated", "settings": result}


@router.get("/admin/finance/export-csv")
async def export_finance_csv(type: str = "all", admin: Dict = Depends(require_admin)):
    """Export finance transactions as CSV"""
    transactions = []
    
    if type == "subscriptions":
        payments = await db.subscription_payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
        ledger = await db.admin_ledger.find({"type": "subscriptions"}, {"_id": 0}).sort("created_at", -1).to_list(10000)
        for p in payments:
            transactions.append({"date": p.get("created_at",""), "type": "subscription", "subtype": p.get("plan_type",""), "amount": p.get("amount",0), "shop": p.get("shop_name",""), "note": f"Payment from {p.get('shop_name','')}", "source": "payment"})
        for l in ledger:
            transactions.append({"date": l.get("created_at",""), "type": l.get("type",""), "subtype": l.get("subtype",""), "amount": l.get("amount",0), "shop": l.get("shop_name",""), "note": l.get("note",""), "source": "wallet_renewal"})
    elif type == "commissions":
        orders = await db.orders.find({"payment_status": "paid", "commission_amount": {"$gt": 0}}, {"_id": 0}).sort("created_at", -1).to_list(10000)
        for o in orders:
            transactions.append({"date": o.get("created_at",""), "type": "commission", "subtype": "", "amount": o.get("commission_amount",0), "shop": o.get("shop_id",""), "note": f"Order #{o.get('id','')}", "source": "order"})
    elif type == "adjustments":
        adjs = await db.revenue_adjustments.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
        for a in adjs:
            transactions.append({"date": a.get("created_at",""), "type": "adjustment", "subtype": a.get("type",""), "amount": a.get("amount",0), "shop": "", "note": a.get("description",""), "source": "manual"})
    elif type in ["platform_services", "monthly_credits"]:
        entries = await db.admin_ledger.find({"type": type}, {"_id": 0}).sort("created_at", -1).to_list(10000)
        for e in entries:
            transactions.append({"date": e.get("created_at",""), "type": e.get("type",""), "subtype": e.get("subtype",""), "amount": e.get("amount",0), "shop": e.get("shop_name",""), "note": e.get("note",""), "source": "ledger"})
    else:
        entries = await db.admin_ledger.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
        for e in entries:
            transactions.append({"date": e.get("created_at",""), "type": e.get("type",""), "subtype": e.get("subtype",""), "amount": e.get("amount",0), "shop": e.get("shop_name",""), "note": e.get("note",""), "source": "ledger"})
    
    output = io.StringIO()
    writer = csv_module.DictWriter(output, fieldnames=["date", "type", "subtype", "amount", "shop", "note", "source"])
    writer.writeheader()
    writer.writerows(transactions)
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=finance_{type}_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/admin/themes")
async def admin_get_themes(admin: Dict = Depends(require_admin)):
    """Admin: Get all themes with management options"""
    themes = await db.storefront_themes.find({}, {"_id": 0}).to_list(100)
    if not themes:
        await seed_storefront_themes()
        themes = await db.storefront_themes.find({}, {"_id": 0}).to_list(100)
    return {"themes": themes}


@router.put("/admin/themes/{theme_key}/toggle")
async def admin_toggle_theme(theme_key: str, admin: Dict = Depends(require_admin)):
    """Admin: Enable/disable a theme"""
    theme = await db.storefront_themes.find_one({"key": theme_key})
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    new_status = not theme.get("enabled", True)
    await db.storefront_themes.update_one(
        {"key": theme_key},
        {"$set": {"enabled": new_status}}
    )
    return {"message": f"Theme {'enabled' if new_status else 'disabled'}", "enabled": new_status}


@router.get("/admin/storefront/themes")
async def admin_get_themes(admin: Dict = Depends(require_admin)):
    """Admin: Get all storefront themes with pricing"""
    themes = await db.storefront_themes.find({}, {"_id": 0}).to_list(100)
    if not themes:
        await seed_storefront_themes()
        themes = await db.storefront_themes.find({}, {"_id": 0}).to_list(100)
    return {"themes": themes}


@router.put("/admin/storefront/themes/{theme_key}")
async def admin_update_theme(theme_key: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Update theme pricing, enabled state"""
    body = await request.json()
    update = {}
    if "price_usd" in body:
        update["price_usd"] = float(body["price_usd"])
    if "enabled" in body:
        update["enabled"] = bool(body["enabled"])
    if "pro_only" in body:
        update["pro_only"] = bool(body["pro_only"])
    
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.storefront_themes.find_one_and_update(
        {"key": theme_key}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Theme not found")
    return {"message": "Theme updated", "theme": result}


@router.put("/admin/theme-sale-percent")
async def set_theme_sale_percent(request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Set global theme sale percent (0-100)"""
    body = await request.json()
    sale_percent = body.get("theme_sale_percent", 0)
    if sale_percent < 0 or sale_percent > 100:
        raise HTTPException(status_code=400, detail="Sale percent must be between 0 and 100")
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": {"theme_sale_percent": sale_percent}},
        upsert=True
    )
    return {"message": f"Theme sale set to {sale_percent}%", "theme_sale_percent": sale_percent}


@router.get("/admin/verification-requests")
async def get_verification_requests(status: Optional[str] = None, admin: Dict = Depends(require_admin)):
    """Admin: Get all shop verification requests"""
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["pending", "approved", "rejected"]}
    
    requests = await db.shop_verifications.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with shop data
    for req in requests:
        shop = await db.shops.find_one({"id": req["shop_id"]}, {"_id": 0, "id": 1, "name": 1, "logo": 1, "email": 1, "tier": 1, "state": 1, "city": 1, "latitude": 1, "longitude": 1, "location_address": 1})
        if shop:
            req["shop"] = shop
    
    # Sort: pending first, then by submitted_at desc
    requests.sort(key=lambda r: (0 if r.get("status") == "pending" else 1, r.get("submitted_at", "") or ""), reverse=False)
    pending_first = [r for r in requests if r.get("status") == "pending"]
    others = [r for r in requests if r.get("status") != "pending"]
    others.sort(key=lambda r: r.get("submitted_at", ""), reverse=True)
    
    return {"requests": pending_first + others, "total": len(requests)}


@router.put("/admin/verification-requests/{shop_id}/approve")
async def approve_verification_request(shop_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Approve shop verification"""
    verification = await db.shop_verifications.find_one({"shop_id": shop_id})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification request not found")
    
    await db.shop_verifications.update_one(
        {"shop_id": shop_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": admin["user_id"],
            "rejection_reason": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Mark shop as verified
    await db.shops.update_one(
        {"id": shop_id},
        {"$set": {"is_verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Send notification to shop
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "name": 1, "user_id": 1})
    if shop:
        await create_notification(
            recipient_type="shop",
            title="Verification Approved!",
            message=f"Congratulations! Your shop '{shop.get('name', '')}' is now a Verified Seller. You have higher ranking in search results.",
            notification_type="system",
            link="/shop/verification",
            recipient_id=shop_id
        )
    
    return {"message": "Verification approved", "shop_id": shop_id}


@router.put("/admin/verification-requests/{shop_id}/reject")
async def reject_verification_request(shop_id: str, reason: str = "Does not meet requirements", admin: Dict = Depends(require_admin)):
    """Admin: Reject shop verification"""
    verification = await db.shop_verifications.find_one({"shop_id": shop_id})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification request not found")
    
    await db.shop_verifications.update_one(
        {"shop_id": shop_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Keep shop unverified
    await db.shops.update_one({"id": shop_id}, {"$set": {"is_verified": False}})
    
    # Send notification to shop
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0, "name": 1, "user_id": 1})
    if shop:
        await create_notification(
            recipient_type="shop",
            title="Verification Rejected",
            message=f"Your verification request was not approved. Reason: {reason}. You can re-submit after addressing the issues.",
            notification_type="system",
            link="/shop/verification",
            recipient_id=shop_id
        )
    
    return {"message": "Verification rejected", "shop_id": shop_id}


# ============== GUEST SHOP APPLICATIONS ==============

@router.get("/admin/guest-applications")
async def get_guest_applications(admin: Dict = Depends(require_admin), status: Optional[str] = None):
    """Admin: Get all guest shop applications"""
    query = {}
    if status:
        query["status"] = status
    applications = await db.guest_shop_applications.find(query, {"_id": 0}).to_list(1000)
    return applications


@router.put("/admin/guest-applications/{app_id}")
async def update_guest_application(app_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Edit a guest shop application"""
    body = await request.json()
    application = await db.guest_shop_applications.find_one({"id": app_id}, {"_id": 0})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    update_fields = {}
    allowed_fields = ["shop_name", "guest_name", "email", "phone", "address", "state", "description", "logo", "category_ids"]
    for field in allowed_fields:
        if field in body:
            update_fields[field] = body[field]
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.guest_shop_applications.find_one_and_update(
        {"id": app_id},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0}
    )
    return result


@router.post("/admin/guest-applications/{app_id}/approve")
async def approve_guest_application(app_id: str, request: Request, admin: Dict = Depends(require_admin)):
    """Admin: Approve a guest shop application - creates user account + shop"""
    body = await request.json()
    password = (body.get("password") or "").strip()
    commission_percentage = body.get("commission_percentage")
    commission_type = body.get("commission_type", "on_customer")
    subscription_required = body.get("subscription_required", False)
    # Admin can assign/override the referring agent at approval time, and set that
    # agent's commission-share % (the cut of admin commission the agent earns).
    override_agent_id = (body.get("referred_by_agent_id") or "").strip() or None
    override_agent_code = (body.get("referral_code") or "").strip() or None
    agent_commission_share = body.get("agent_commission_share_percent")
    
    application = await db.guest_shop_applications.find_one({"id": app_id}, {"_id": 0})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Application already processed")
    
    email = application.get("email", "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Application has no email")
    
    # A logged-in applicant already has a user account — we just upgrade it (no password).
    is_logged_in_app = bool(application.get("is_logged_in_user") or application.get("user_id"))
    shop_id = str(uuid.uuid4())
    
    if is_logged_in_app:
        user_id = application.get("user_id")
        existing_user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not existing_user:
            # Fallback: locate by email
            existing_user = await db.users.find_one({"email": email}, {"_id": 0})
            user_id = existing_user.get("id") if existing_user else user_id
        if not existing_user:
            raise HTTPException(status_code=400, detail="Applicant user account no longer exists")
        if existing_user.get("role") == "shop" or existing_user.get("shop_id"):
            raise HTTPException(status_code=400, detail="This user already owns a shop")
        # Upgrade the existing account to a shop owner
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"role": "shop", "shop_id": shop_id}}
        )
    else:
        # True guest — create a brand new user account using the provided password.
        if not password:
            raise HTTPException(status_code=400, detail="Password is required for the new user account")
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        # Check if user with this email already exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        if existing_user:
            raise HTTPException(status_code=400, detail=f"A user with email {email} already exists")
        # Create user account
        hashed_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user_id = str(uuid.uuid4())
        user_doc = {
            "id": user_id,
            "email": email,
            "password": hashed_pw,
            "name": application.get("guest_name", application.get("shop_name", "")),
            "role": "shop",
            "shop_id": shop_id,
            "phone": application.get("phone", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Create shop
    now = datetime.now(timezone.utc)
    # Calculate subscription details
    subscription_amount = 0.0
    subscription_end = None
    subscription_status = "active"
    plan_type = "free"
    
    platform_settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if subscription_required:
        # Determine subscription fee from settings (default $19)
        sub_months = int(body.get("months", 1) or 1)
        tiers = (platform_settings or {}).get("tiers", {})
        pro_tier = tiers.get("pro", {})
        # Use admin-overridable subscription fee with a default of $19
        custom_fee = body.get("subscription_fee")
        if custom_fee is not None:
            try:
                monthly_price = float(custom_fee)
            except (TypeError, ValueError):
                monthly_price = 19.0
        else:
            monthly_price = float(pro_tier.get("monthly_price", 19.0))
        subscription_amount = round(monthly_price * sub_months, 2)
        subscription_end = (now + timedelta(days=30 * sub_months)).isoformat()
        plan_type = "monthly" if sub_months < 12 else "yearly"
    
    # ---- Resolve referral attribution BEFORE building the shop so the welcome
    # bonus can branch on referred vs non-referred. ----
    _ref_agent_id = application.get("referred_by_agent_id")
    _ref_agent_name = application.get("referred_by_agent_name")
    _ref_code = application.get("referral_code")

    # Admin override: explicit agent id, or a referral code resolved to an agent
    if override_agent_code and not override_agent_id:
        try:
            from services.referral_helpers import get_agent_by_referral_code
            _ag = await get_agent_by_referral_code(override_agent_code) or await get_agent_by_referral_code(override_agent_code.upper())
            if _ag:
                override_agent_id = _ag.get("id")
        except Exception:
            pass
    if override_agent_id:
        _ovr = await db.users.find_one({"id": override_agent_id, "role": "agent"}, {"_id": 0})
        if _ovr:
            _ref_agent_id = _ovr.get("id")
            _ref_agent_name = _ovr.get("name")
            _ref_code = _ovr.get("referral_code")

    is_referred = bool(_ref_agent_id)
    # Welcome bonus: referred -> $3 + 2 sponsors ; non-referred -> $2 + 1 sponsor
    welcome = get_welcome_bonus(is_referred, platform_settings)
    welcome_wallet = welcome["wallet"]
    welcome_sponsors = welcome["sponsors"]

    shop_doc = {
        "id": shop_id,
        "user_id": user_id,
        "name": application.get("shop_name", ""),
        "description": application.get("description", ""),
        "logo": application.get("logo", ""),
        "phone": application.get("phone", ""),
        "email": email,
        "address": application.get("address", ""),
        "state": application.get("state", ""),
        "category_ids": application.get("category_ids", []),
        "status": "approved",
        "subscription_status": subscription_status,
        "subscription_start": now.isoformat(),
        "subscription_end": subscription_end,
        "subscription_required": subscription_required,
        "subscription_price_paid": subscription_amount,
        "plan_type": plan_type,
        "payment_method": "manual",
        "tier": "starter" if not subscription_required else "pro",
        # Welcome bonus (NO free spin). Referred shops get a richer bonus.
        "wallet_balance": welcome_wallet,
        "commission_type": commission_type,
        "free_sponsor_credits": welcome_sponsors,
        "free_spins_balance": 0,
        "welcome_bonus_granted": True,
        "welcome_bonus_granted_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    if commission_percentage is not None:
        shop_doc["commission_percentage"] = commission_percentage

    if _ref_agent_id:
        shop_doc["referred_by_agent_id"] = _ref_agent_id
        shop_doc["referred_by_agent_name"] = _ref_agent_name
        shop_doc["referral_code"] = _ref_code
        # If admin specified a commission-share % for the attributed agent, persist it.
        if agent_commission_share is not None:
            try:
                _share = float(agent_commission_share)
                if 0 <= _share <= 100:
                    await db.users.update_one(
                        {"id": _ref_agent_id},
                        {"$set": {"commission_share_percent": _share}},
                    )
            except (TypeError, ValueError):
                pass
    
    await db.shops.insert_one(shop_doc)
    
    # NOTE: No free spin is granted on guest approval (welcome bonus = 1 free sponsor + $2 wallet credit).
    # Initialize spin wheel state with 0 balance so the shop starts clean.
    try:
        await db.shop_spin_state.insert_one({
            "shop_id": shop_id,
            "balance": 0,
            "last_spin_at": None,
            "total_spins": 0,
            "created_at": now.isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to init spin state for guest-approved shop {shop_id}: {e}")

    # ---- Welcome bonus accounting: wallet credit recorded as "New Shop Credits" (deducted from admin profit) ----
    try:
        txn_id = str(uuid.uuid4())
        if welcome_wallet > 0:
            await db.wallet_transactions.insert_one({
                "id": txn_id,
                "shop_id": shop_id,
                "shop_name": shop_doc["name"],
                "type": "welcome_bonus",
                "amount": welcome_wallet,
                "balance_after": welcome_wallet,
                "status": "completed",
                "note": f"New shop welcome bonus: {welcome['summary']}",
                "created_at": now.isoformat()
            })
            # admin_ledger debit -> counted under "New Shop Credits" (type kept as monthly_credits for accounting compatibility)
            await db.admin_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "type": "monthly_credits",
                "subtype": "new_shop_credits_referred" if is_referred else "new_shop_credits",
                "amount": welcome_wallet,
                "direction": "debit",
                "shop_id": shop_id,
                "shop_name": shop_doc["name"],
                "ref_id": txn_id,
                "note": f"New shop credits (welcome bonus{' - referred' if is_referred else ''}) for {shop_doc['name']}",
                "created_at": now.isoformat()
            })
    except Exception as e:
        logger.error(f"Failed to record new-shop welcome credit for {shop_id}: {e}")

    # ---- Notify the shop owner about the welcome bonus ----
    try:
        await create_notification(
            user_id,
            "🎁 Welcome Bonus Unlocked!",
            f"Your shop was approved! You received {welcome['summary']} as a welcome gift. Use them in your shop dashboard!",
            "bonus",
            "/shop/dashboard"
        )
    except Exception:
        pass

    # ---- Referral agent: pay approval bonus to the referring agent ----
    if shop_doc.get("referred_by_agent_id"):
        try:
            from services.referral_helpers import on_referred_shop_approved
            await on_referred_shop_approved(
                shop_id=shop_id,
                shop_name=shop_doc.get("name", ""),
                referral_agent_id=shop_doc["referred_by_agent_id"],
            )
        except Exception as _ref_err:
            logger.error(f"Failed to credit agent approval bonus for shop {shop_id}: {_ref_err}")

    # ---- Send approval email to the shop (from openmarketlb@gmail.com) ----
    try:
        shop_name = shop_doc.get("name", "your shop")
        login_hint = (
            "<p>Your existing account has been upgraded to a <b>Shop</b> account — just log in with your usual credentials.</p>"
            if is_logged_in_app
            else f"<p>You can now log in using your email <b>{email}</b> and the password set during approval.</p>"
        )
        approval_html = f"""
        <div style=\"font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;\">
          <div style=\"background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px;border-radius:16px 16px 0 0;text-align:center;\">
            <h1 style=\"color:#fff;margin:0;font-size:22px;\">🎉 Your Shop is Approved!</h1>
          </div>
          <div style=\"padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;\">
            <p style=\"font-size:16px;\">Hello <b>{shop_name}</b>,</p>
            <p>Congratulations! Your application to sell on <b>OpenMarket Lebanon</b> has been <b>approved</b>.</p>
            {login_hint}
            <div style=\"background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;margin:20px 0;\">
              <p style=\"margin:0 0 6px;font-weight:bold;color:#6d28d9;\">🎁 Welcome Bonus</p>
              <ul style=\"margin:0;padding-left:18px;\">
                {('<li><b>$' + format(welcome_wallet, '.2f') + '</b> wallet credit</li>') if welcome_wallet > 0 else ''}
                {('<li><b>' + str(welcome_sponsors) + '</b> free product sponsor' + ('s' if welcome_sponsors != 1 else '') + '</li>') if welcome_sponsors > 0 else ''}
              </ul>
            </div>
            <p>Head over to your <b>Shop Dashboard</b> to add products, set up your storefront, and start selling.</p>
            <p style=\"margin-top:24px;color:#64748b;font-size:13px;\">Thank you for joining OpenMarket Lebanon.</p>
          </div>
        </div>
        """
        await send_email_async(email, "Your OpenMarket Lebanon shop application is approved! 🎉", approval_html, shop_name)
    except Exception as e:
        logger.error(f"Failed to send guest approval email to {email}: {e}")

    
    # Record subscription fee as admin profit (only when subscription required)
    if subscription_required and subscription_amount > 0:
        try:
            await db.admin_revenue.insert_one({
                "id": str(uuid.uuid4()),
                "type": "subscription_fee",
                "source": "shop_subscription_guest_approval",
                "shop_id": shop_id,
                "shop_name": shop_doc["name"],
                "amount": subscription_amount,
                "plan_type": plan_type,
                "months": int(body.get("months", 1) or 1),
                "description": f"Subscription fee from guest-approved shop {shop_doc['name']}",
                "created_at": now.isoformat()
            })
            await db.subscription_payments.insert_one({
                "id": str(uuid.uuid4()),
                "shop_id": shop_id,
                "shop_name": shop_doc["name"],
                "amount": subscription_amount,
                "months": int(body.get("months", 1) or 1),
                "plan_type": plan_type,
                "tier": "pro",
                "payment_intent_id": None,
                "payment_method": "manual_admin",
                "type": "subscription",
                "created_at": now.isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to record guest subscription revenue: {e}")
    
    # Mark application as approved
    await db.guest_shop_applications.update_one(
        {"id": app_id},
        {"$set": {"status": "approved", "approved_at": now.isoformat(), "user_id": user_id, "shop_id": shop_id}}
    )
    
    logger.info(f"Admin approved guest application {app_id}: {'upgraded existing user' if is_logged_in_app else 'created user'} {email}, shop {application.get('shop_name')}")
    
    return {
        "message": (
            f"Application approved! {email}'s account upgraded to a shop"
            if is_logged_in_app
            else f"Application approved! User account created for {email}"
        ),
        "user_id": user_id,
        "shop_id": shop_id,
        "email": email,
        "password_set": (not is_logged_in_app),
        "was_logged_in_user": is_logged_in_app
    }


@router.delete("/admin/guest-applications/{app_id}")
async def reject_guest_application(app_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Reject/delete a guest shop application"""
    application = await db.guest_shop_applications.find_one({"id": app_id}, {"_id": 0})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    await db.guest_shop_applications.update_one(
        {"id": app_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Application rejected"}




# ============ ADMIN: SHOP SALES ============

class AdminShopSaleUpdate(BaseModel):
    discount_percent: Optional[float] = None
    end_date: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/admin/shop-sales")
async def get_all_shop_sales(admin: Dict = Depends(require_admin)):
    """Admin: Get all shop sales"""
    sales = await db.shop_sales.find({}, {"_id": 0, "original_prices": 0}).sort("created_at", -1).to_list(500)
    # Check which are expired
    now = datetime.now(timezone.utc).isoformat()
    for sale in sales:
        sale["is_expired"] = sale.get("end_date", "") < now
    return sales


@router.put("/admin/shop-sales/{sale_id}")
async def admin_update_shop_sale(sale_id: str, sale_data: AdminShopSaleUpdate, admin: Dict = Depends(require_admin)):
    """Admin: Update any shop sale"""
    sale = await db.shop_sales.find_one({"id": sale_id}, {"_id": 0})
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
        {"id": sale_id}, {"$set": update}, return_document=True, projection={"_id": 0, "original_prices": 0}
    )
    
    # Re-apply prices if discount changed
    if "discount_percent" in update and sale.get("is_active"):
        original_prices = sale.get("original_prices", {})
        discount_factor = 1 - (update["discount_percent"] / 100)
        for pid, prices in original_prices.items():
            base_price = prices.get("price", 0)
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
    
    # Notify shop
    await create_notification(
        "shop",
        "Sale Updated by Admin",
        f"Your sale '{sale.get('title', 'Sale')}' was updated by admin.",
        "system",
        recipient_id=sale.get("shop_id")
    )
    
    return result


@router.delete("/admin/shop-sales/{sale_id}")
async def admin_delete_shop_sale(sale_id: str, admin: Dict = Depends(require_admin)):
    """Admin: Delete any shop sale and restore original prices"""
    sale = await db.shop_sales.find_one({"id": sale_id}, {"_id": 0})
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
    
    # Notify shop
    await create_notification(
        "shop",
        "Sale Removed by Admin",
        f"Your sale '{sale.get('title', 'Sale')}' was removed by admin. Prices have been restored.",
        "system",
        recipient_id=sale.get("shop_id")
    )
    
    return {"message": "Sale deleted and prices restored"}


# ============================================================================
# DATABASE EXPLORER (admin-only) — view every collection ("table") of the site
# ============================================================================
from fastapi.encoders import jsonable_encoder as _jsonable_encoder

# Fields that must never be exposed in the database explorer
_DB_SENSITIVE_FIELDS = {"password", "hashed_password", "password_hash", "pwd", "secret", "token", "access_token", "refresh_token", "reset_token", "otp"}

# Friendly descriptions for known collections
_DB_COLLECTION_INFO = {
    "users": "All platform accounts (admins, agents, shop owners, customers, employees).",
    "shops": "Seller shops with subscription, wallet, tier, referral & verification data.",
    "products": "Products listed by shops.",
    "orders": "Customer orders, payments, delivery & commission details.",
    "categories": "Product categories and sub-categories.",
    "reviews": "Customer reviews and ratings for products/shops.",
    "promotions": "Active/expired product boost (sponsorship) campaigns.",
    "notifications": "In-app notifications sent to users.",
    "platform_settings": "Global platform configuration (single document).",
    "admin_ledger": "Admin accounting ledger (revenue & deductions).",
    "admin_revenue": "Aggregated admin revenue records.",
    "admin_events": "Sponsored events & banners managed by admin.",
    "wallet_transactions": "Shop wallet credit/debit history.",
    "agent_wallet_transactions": "Agent wallet commission & payout history.",
    "guest_shop_applications": "Become-a-seller / agent referral applications awaiting approval.",
    "storefront_themes": "Available storefront themes shops can buy/apply.",
    "spin_settings": "Spin-the-wheel configuration.",
    "shop_spin_state": "Per-shop spin wheel state & history.",
    "product_gifts": "Gift-with-purchase configurations.",
    "states": "Lebanese regions/governorates list.",
    "tos": "Terms of service documents.",
    "held_delivery_fees": "Delivery fees held by the platform pending release.",
    "revenue_adjustments": "Manual admin revenue adjustments.",
    "subscription_payments": "Shop subscription payment records.",
    "admin_cashouts": "Admin cash-out (withdrawal) records.",
}


def _infer_type(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _redact_doc(doc: dict) -> dict:
    """Remove _id and redact sensitive fields from a document."""
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        if k.lower() in _DB_SENSITIVE_FIELDS:
            out[k] = "•••••• (hidden)"
        else:
            out[k] = v
    return out


@router.get("/admin/database/overview")
async def get_database_overview(admin: Dict = Depends(require_admin)):
    """Return every collection in the database with row counts + inferred schema.

    Powers the admin "Database" page that shows all tables of the website on one page.
    """
    try:
        names = await db.list_collection_names()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list collections: {e}")

    collections = []
    total_documents = 0
    for name in sorted(names):
        if name.startswith("system."):
            continue
        try:
            count = await db[name].count_documents({})
        except Exception:
            count = 0
        total_documents += count

        # Infer schema from a sample of up to 25 docs (union of keys)
        schema = {}  # field -> {types:set, sample}
        try:
            sample = await db[name].find({}, {"_id": 0}).limit(25).to_list(25)
        except Exception:
            sample = []
        for doc in sample:
            if not isinstance(doc, dict):
                continue
            for k, v in doc.items():
                if k not in schema:
                    schema[k] = {"types": set(), "sample": None}
                schema[k]["types"].add(_infer_type(v))
                if schema[k]["sample"] is None and v not in (None, "", [], {}):
                    s = v
                    if isinstance(v, (dict, list)):
                        s = f"<{_infer_type(v)}>"
                    else:
                        s = str(v)
                    if isinstance(s, str) and len(s) > 60:
                        s = s[:60] + "…"
                    schema[k]["sample"] = s

        fields = []
        for fname, meta in schema.items():
            is_sensitive = fname.lower() in _DB_SENSITIVE_FIELDS
            fields.append({
                "name": fname,
                "type": "/".join(sorted(meta["types"])) or "unknown",
                "sample": "••••••" if is_sensitive else meta["sample"],
                "sensitive": is_sensitive,
            })
        fields.sort(key=lambda f: (f["name"] != "id", f["name"]))

        collections.append({
            "name": name,
            "count": count,
            "field_count": len(fields),
            "fields": fields,
            "description": _DB_COLLECTION_INFO.get(name, ""),
        })

    return {
        "database": os.environ.get("DB_NAME", "database"),
        "total_collections": len(collections),
        "total_documents": total_documents,
        "collections": collections,
    }


@router.get("/admin/database/collection/{name}")
async def get_database_collection(
    name: str,
    page: int = 1,
    limit: int = 25,
    search: Optional[str] = None,
    admin: Dict = Depends(require_admin),
):
    """Return paginated documents (rows) of a single collection for the admin Database page."""
    try:
        existing = await db.list_collection_names()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list collections: {e}")
    if name not in existing or name.startswith("system."):
        raise HTTPException(status_code=404, detail="Collection not found")

    page = max(1, int(page or 1))
    limit = min(100, max(1, int(limit or 25)))
    skip = (page - 1) * limit

    query = {}
    if search and search.strip():
        s = search.strip()
        # Best-effort text search across common string fields
        candidates = ["name", "title", "email", "id", "shop_name", "status", "phone", "note", "type", "description"]
        ors = []
        for f in candidates:
            ors.append({f: {"$regex": s, "$options": "i"}})
        query = {"$or": ors}

    try:
        total = await db[name].count_documents(query)
        docs = await db[name].find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    except Exception:
        # Fallback if regex query fails on a field type
        total = await db[name].count_documents({})
        docs = await db[name].find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)

    docs = [_redact_doc(d) if isinstance(d, dict) else d for d in docs]

    # Build column list from the returned docs (union of keys, id first)
    columns = []
    seen = set()
    for d in docs:
        if isinstance(d, dict):
            for k in d.keys():
                if k not in seen:
                    seen.add(k)
                    columns.append(k)
    columns.sort(key=lambda c: (c != "id", c))

    return {
        "name": name,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": max(1, (total + limit - 1) // limit),
        "columns": columns,
        "documents": _jsonable_encoder(docs),
    }
