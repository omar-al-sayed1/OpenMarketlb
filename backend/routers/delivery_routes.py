"""
OpenMarket Lebanon - Delivery Routes
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



@router.get("/delivery/available-orders")
async def get_available_orders(user: Dict = Depends(require_delivery)):
    """Get orders available for delivery (not yet claimed)"""
    orders = await db.orders.find(
        {
            "delivery_user_id": None,
            "order_status": {"$in": ["pending", "paid", "processing", "ready", "shipped"]},
            "delivery_status": "pending"
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with shop names for items
    for order in orders:
        for item in order.get("items", []):
            if item.get("shop_id") and not item.get("shop_name"):
                shop = await db.shops.find_one({"id": item["shop_id"]}, {"_id": 0, "name": 1})
                if shop:
                    item["shop_name"] = shop.get("name", "Unknown")
    
    return orders


@router.get("/delivery/my-orders")
async def get_delivery_user_orders(user: Dict = Depends(require_delivery)):
    """Get orders assigned to this delivery user"""
    orders = await db.orders.find(
        {"delivery_user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with shop names for items
    for order in orders:
        for item in order.get("items", []):
            if item.get("shop_id") and not item.get("shop_name"):
                shop = await db.shops.find_one({"id": item["shop_id"]}, {"_id": 0, "name": 1})
                if shop:
                    item["shop_name"] = shop.get("name", "Unknown")
    
    return orders


@router.post("/delivery/claim/{order_id}")
async def claim_order(order_id: str, user: Dict = Depends(require_delivery)):
    """Claim an order for delivery"""
    order = await db.orders.find_one({"id": order_id, "delivery_user_id": None})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or already claimed")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "delivery_user_id": user["user_id"],
            "delivery_status": "assigned"
        }}
    )
    
    return {"message": "Order claimed successfully"}


@router.put("/delivery/orders/{order_id}/status")
async def update_delivery_status(order_id: str, status: str, notes: Optional[str] = None, user: Dict = Depends(require_delivery)):
    """Update delivery status"""
    order = await db.orders.find_one({"id": order_id, "delivery_user_id": user["user_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")
    
    valid_statuses = ["assigned", "picked_up", "in_transit", "delivered", "failed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {"delivery_status": status}
    if notes:
        update_data["delivery_notes"] = notes
    
    # If delivered, update order status too. The order stays UNPAID here — the admin
    # confirms the cash and marks it Paid from the Finance Center "Delivery Cash Owed
    # to Admin" section (which is what records the commission + agent share).
    if status == "delivered":
        update_data["order_status"] = "delivered"
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()

    await db.orders.update_one({"id": order_id}, {"$set": update_data})

    return {"message": "Delivery status updated"}


@router.get("/delivery/orders/{order_id}/details")
async def get_delivery_order_details(order_id: str, user: Dict = Depends(require_delivery)):
    """Delivery: Get order details with shop locations and customer location for map"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get shop details with coordinates
    shops_info = []
    for shop_id in order.get("shop_ids", []):
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
        if shop:
            shop_items = [item for item in order.get("items", []) if item.get("shop_id") == shop_id]
            shops_info.append({
                "shop_id": shop_id,
                "shop_name": shop.get("name"),
                "shop_address": shop.get("address"),
                "shop_state": shop.get("state"),
                "shop_phone": shop.get("phone"),
                "shop_latitude": shop.get("latitude"),
                "shop_longitude": shop.get("longitude"),
                "items_count": len(shop_items),
                "items_subtotal": sum(item.get("subtotal", 0) for item in shop_items)
            })
    
    delivery_info = {
        "from_shops": shops_info,
        "to_customer": {
            "name": order.get("customer_name") or order.get("guest_name"),
            "phone": order.get("customer_phone") or order.get("user_phone") or order.get("guest_phone"),
            "address": order.get("shipping_address", {}).get("address") if isinstance(order.get("shipping_address"), dict) else order.get("shipping_address", ""),
            "city": order.get("shipping_address", {}).get("city") if isinstance(order.get("shipping_address"), dict) else order.get("shipping_city", ""),
            "state": order.get("shipping_address", {}).get("state") if isinstance(order.get("shipping_address"), dict) else order.get("shipping_state", ""),
            "location": order.get("customer_location")
        }
    }
    
    # Agent commission breakdown (for delivery view, expose share % + $ per shop)
    agent_breakdown = {"has_agent": False, "entries": []}
    try:
        from services.referral_helpers import get_order_agent_breakdown
        agent_breakdown = await get_order_agent_breakdown(order)
    except Exception as _e:
        logger.error(f"delivery agent_breakdown error: {_e}")

    return {
        **order,
        "delivery_info": delivery_info,
        "agent_breakdown": agent_breakdown,
    }
