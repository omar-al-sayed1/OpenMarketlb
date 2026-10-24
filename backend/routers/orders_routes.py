"""
OpenMarket Lebanon - Orders Routes
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
from services.helpers import apply_commission_to_product, calc_points_earned, calc_redemption_value, calc_tier, create_notification, get_customer_markup_factor, get_default_loyalty_settings, get_loyalty_settings, get_shop_commission_info, get_shop_revenue_factor

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



def calc_points_earned(order_subtotal: float, multiplier: float, points_per_dollar: float, bonus_multiplier: float = 1.0) -> int:
    """Calculate points earned from an order"""
    return int(order_subtotal * points_per_dollar * multiplier * bonus_multiplier)


async def _apply_shop_cashback_on_paid(order: Dict, user: Optional[Dict] = None) -> bool:
    """Apply 50% commission cashback to the shop wallet when an order is marked paid.
    Idempotent: only credits when shop_cashback_status is 'pending'.
    Returns True if cashback was applied.
    """
    cashback_amount = order.get("shop_cashback_amount", 0) or 0
    cashback_shop_id = order.get("shop_cashback_shop_id")
    cashback_status = order.get("shop_cashback_status", "pending")
    if cashback_amount <= 0 or not cashback_shop_id or cashback_status == "credited":
        return False
    try:
        # Mark as credited first to prevent race conditions
        result = await db.orders.update_one(
            {"id": order["id"], "shop_cashback_status": {"$ne": "credited"}},
            {"$set": {"shop_cashback_status": "credited", "shop_cashback_credited_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count == 0:
            # Another process already credited
            return False
        # Credit the shop wallet
        await db.shops.update_one(
            {"id": cashback_shop_id},
            {"$inc": {"wallet_balance": cashback_amount}}
        )
        shop_after_cashback = await db.shops.find_one({"id": cashback_shop_id}, {"_id": 0, "wallet_balance": 1, "name": 1, "user_id": 1})
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "shop_id": cashback_shop_id,
            "shop_name": shop_after_cashback.get("name", "") if shop_after_cashback else "",
            "type": "shop_order_cashback",
            "amount": cashback_amount,
            "balance_after": shop_after_cashback.get("wallet_balance", 0) if shop_after_cashback else 0,
            "status": "completed",
            "note": f"Shop cashback (commission) for paid order #{order['id'][:8]}",
            "order_id": order["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        # Notify shop owner about the cashback
        try:
            target_user_id = (user.get("user_id") if user else None) or (shop_after_cashback.get("user_id") if shop_after_cashback else None)
            if target_user_id:
                await create_notification(
                    user_id=target_user_id,
                    title="Shop Cashback Received!",
                    message=f"Your order is paid! You received ${cashback_amount:.2f} cashback (50% of order commission) credited to your shop wallet.",
                    notif_type="cashback",
                    reference_id=order["id"]
                )
        except Exception:
            pass
        return True
    except Exception as e:
        logger.error(f"Failed to apply shop cashback on paid for order {order.get('id')}: {e}")
        return False


async def settle_order_as_paid(order_id: str, user: Optional[Dict] = None) -> None:
    """Mark an order paid and run the one-time revenue/commission distribution:
    credit each shop's revenue + wallet, record the admin commission revenue, hold
    delivery fees (wallet/card), apply the shop's 50% cashback, and distribute the
    referral agent's commission share. Idempotent — the heavy distribution runs only
    once (guarded by `revenue_distributed`), so it's safe to call from multiple flows
    (admin "mark paid", COD delivered, payment webhook).
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return

    update_fields = {"payment_status": "paid"}

    if not order.get("revenue_distributed", False):
        is_wallet_or_card_payment = order.get("payment_method") in ("wallet", "card") or order.get("wallet_paid")
        commission_amount = order.get("commission_amount", 0)

        # Group revenue by shop (use original, pre-markup subtotal — markup is admin commission)
        shop_revenues = {}
        order_shop_id = order.get("shop_id")
        for item in order.get("items", []):
            sid = item.get("shop_id") or order_shop_id
            if sid:
                original_subtotal = item.get("original_subtotal", item.get("subtotal", 0))
                shop_revenues[sid] = shop_revenues.get(sid, 0) + original_subtotal
        if not shop_revenues and order_shop_id:
            order_subtotal = order.get("subtotal", 0)
            if order_subtotal > 0:
                shop_revenues[order_shop_id] = order_subtotal

        # Credit each shop's revenue + wallet
        for sid, amount in shop_revenues.items():
            await db.shops.update_one({"id": sid}, {"$inc": {"total_revenue": amount, "wallet_balance": amount}})
            shop_doc = await db.shops.find_one({"id": sid}, {"_id": 0, "name": 1, "wallet_balance": 1})
            await db.wallet_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "shop_id": sid,
                "shop_name": shop_doc.get("name", "") if shop_doc else "",
                "type": "order_revenue",
                "amount": amount,
                "balance_after": shop_doc.get("wallet_balance", 0) if shop_doc else amount,
                "status": "completed",
                "note": f"Revenue from order #{order_id[:8]}",
                "order_id": order_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

        # Record admin commission revenue (this is what feeds the Admin Profit / Commissions section)
        if commission_amount > 0:
            await db.admin_revenue.insert_one({
                "id": str(uuid.uuid4()),
                "order_id": order_id,
                "amount": commission_amount,
                "type": "commission",
                "created_at": datetime.now(timezone.utc).isoformat()
            })

        if is_wallet_or_card_payment:
            delivery_fee = order.get("delivery_fee", 0)
            if delivery_fee > 0:
                await db.held_delivery_fees.insert_one({
                    "id": str(uuid.uuid4()),
                    "order_id": order_id,
                    "amount": delivery_fee,
                    "released": False,
                    "shop_id": order.get("created_by_shop") or (order.get("shop_ids", [None])[0] if order.get("shop_ids") else None),
                    "created_at": datetime.now(timezone.utc).isoformat()
                })

        update_fields["revenue_distributed"] = True
        update_fields["revenue_distributed_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.orders.find_one_and_update(
        {"id": order_id},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0}
    )

    # Shop cashback (50% of commission) — idempotent
    try:
        await _apply_shop_cashback_on_paid(result or order, user)
    except Exception as e:
        logger.error(f"Failed to apply shop cashback on order {order_id}: {e}")

    # Referral-agent commission share (idempotent) — gives the agent their % (default 30%)
    try:
        from services.referral_helpers import on_referred_order_settled
        await on_referred_order_settled(order=result or order)
    except Exception as e:
        logger.error(f"Failed to distribute agent commission on order {order_id}: {e}")




@router.post("/cart/merge")
async def merge_guest_cart(request: Request, user: Dict = Depends(require_auth)):
    """Merge guest cart (by session_id) into authenticated user's cart"""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        return {"message": "No session to merge"}
    
    guest_cart = await db.carts.find_one({"session_id": session_id}, {"_id": 0})
    if not guest_cart or not guest_cart.get("items"):
        return {"message": "No guest cart found"}
    
    user_cart = await db.carts.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    if not user_cart:
        # Just transfer the guest cart to the user
        await db.carts.update_one(
            {"session_id": session_id},
            {"$set": {"user_id": user["user_id"], "session_id": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Cart transferred", "items_merged": len(guest_cart["items"])}
    
    # Merge items: add guest items to user cart, increase quantity for duplicates
    merged_items = list(user_cart.get("items", []))
    items_added = 0
    for guest_item in guest_cart.get("items", []):
        existing = None
        for ui in merged_items:
            if ui["product_id"] == guest_item["product_id"] and ui.get("selected_color") == guest_item.get("selected_color"):
                existing = ui
                break
        if existing:
            existing["quantity"] = max(existing["quantity"], guest_item["quantity"])
        else:
            merged_items.append(guest_item)
            items_added += 1
    
    await db.carts.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"items": merged_items, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    # Delete the guest cart
    await db.carts.delete_one({"session_id": session_id})
    
    return {"message": "Carts merged", "items_merged": items_added}


@router.get("/cart")
async def get_cart(session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    query = {}
    if user:
        query["user_id"] = user["user_id"]
    elif session_id:
        query["session_id"] = session_id
    else:
        return {"items": []}
    
    cart = await db.carts.find_one(query, {"_id": 0})
    if not cart:
        return {"items": []}
    
    product_ids = [item["product_id"] for item in cart.get("items", [])]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
    
    # Apply commission to prices for customer view (per-shop commission rate)
    products_map = {}
    for p in products:
        info = await get_shop_commission_info(p.get("shop_id"))
        products_map[p["id"]] = apply_commission_to_product(p, info["rate"], info["type"])
    
    # Check for gifts on these products
    gift_docs = await db.product_gifts.find(
        {"product_id": {"$in": product_ids}, "is_active": True}, {"_id": 0}
    ).to_list(100)
    gifts_map = {g["product_id"]: g for g in gift_docs}
    
    cart_items = []
    for item in cart.get("items", []):
        product = products_map.get(item["product_id"])
        if product:
            gift = gifts_map.get(item["product_id"])
            cart_items.append({
                "product": product,
                "quantity": item["quantity"],
                "selected_color": item.get("selected_color"),
                "has_free_gift": gift is not None,
                "gift_name": gift.get("gift_name") if gift else None,
                "gift_image": gift.get("gift_image") if gift else None
            })
    
    return {"items": cart_items}


@router.post("/cart")
async def add_to_cart(item: AddToCart, session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Prevent shop from adding own products to cart
    if user and user.get("role") == "shop":
        shop = await db.shops.find_one({"user_id": user["user_id"]}, {"_id": 0, "id": 1})
        if shop and product.get("shop_id") == shop["id"]:
            raise HTTPException(status_code=400, detail="You cannot add your own products to cart")
    
    # Check if product has variants - user only needs to select ONE variant type, not ALL
    has_variants = (product.get("has_color_variants") or product.get("has_size_variants") or product.get("has_shape_variants")
                    or (product.get("colors") and len(product.get("colors", [])) > 0))
    if has_variants:
        # Require at least one variant selection (any of color/size/shape)
        if not (item.selected_color or item.selected_size or item.selected_shape):
            types = []
            if product.get("colors") and len(product.get("colors", [])) > 0: types.append("color")
            if product.get("has_size_variants") and product.get("sizes"): types.append("size")
            if product.get("has_shape_variants") and product.get("shapes"): types.append("shape")
            raise HTTPException(status_code=400, detail=f"Please select at least one: {' / '.join(types)}")
    
    # Check stock - variant-specific or general
    if item.selected_color and product.get("colors"):
        color_variant = next((c for c in product["colors"] if c["color_name"] == item.selected_color), None)
        if not color_variant:
            raise HTTPException(status_code=400, detail=f"Color '{item.selected_color}' not available")
        if color_variant.get("stock", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for color '{item.selected_color}'")
    elif item.selected_size and product.get("sizes"):
        size_variant = next((s for s in product["sizes"] if s["size_name"] == item.selected_size), None)
        if not size_variant:
            raise HTTPException(status_code=400, detail=f"Size '{item.selected_size}' not available")
        if size_variant.get("stock", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for size '{item.selected_size}'")
    elif item.selected_shape and product.get("shapes"):
        shape_variant = next((s for s in product["shapes"] if s["shape_name"] == item.selected_shape), None)
        if not shape_variant:
            raise HTTPException(status_code=400, detail=f"Shape '{item.selected_shape}' not available")
        if shape_variant.get("stock", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for shape '{item.selected_shape}'")
    else:
        if product["stock"] < item.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")
    
    query = {}
    if user:
        query["user_id"] = user["user_id"]
    elif session_id:
        query["session_id"] = session_id
    else:
        session_id = str(uuid.uuid4())
        query["session_id"] = session_id
    
    cart = await db.carts.find_one(query, {"_id": 0})
    
    if not cart:
        cart = {
            "id": str(uuid.uuid4()),
            "user_id": user["user_id"] if user else None,
            "session_id": session_id if not user else None,
            "items": [],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.carts.insert_one(cart)
    
    # Check if same product + variant combo exists
    existing_item = None
    for cart_item in cart["items"]:
        if (cart_item["product_id"] == item.product_id and 
            cart_item.get("selected_color") == item.selected_color and
            cart_item.get("selected_size") == item.selected_size and
            cart_item.get("selected_shape") == item.selected_shape):
            existing_item = cart_item
            break
    
    if existing_item:
        new_quantity = existing_item["quantity"] + item.quantity
        # Re-check stock for new quantity
        if item.selected_color and product.get("colors"):
            color_variant = next((c for c in product["colors"] if c["color_name"] == item.selected_color), None)
            if color_variant.get("stock", 0) < new_quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for color '{item.selected_color}'")
        elif item.selected_size and product.get("sizes"):
            size_variant = next((s for s in product["sizes"] if s["size_name"] == item.selected_size), None)
            if size_variant and size_variant.get("stock", 0) < new_quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for size '{item.selected_size}'")
        elif item.selected_shape and product.get("shapes"):
            shape_variant = next((s for s in product["shapes"] if s["shape_name"] == item.selected_shape), None)
            if shape_variant and shape_variant.get("stock", 0) < new_quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for shape '{item.selected_shape}'")
        else:
            if product["stock"] < new_quantity:
                raise HTTPException(status_code=400, detail="Insufficient stock")
        existing_item["quantity"] = new_quantity
    else:
        cart["items"].append({
            "product_id": item.product_id, 
            "quantity": item.quantity,
            "selected_color": item.selected_color,
            "selected_size": item.selected_size,
            "selected_shape": item.selected_shape
        })
    
    cart["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.carts.update_one(query, {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}})
    
    return {"message": "Item added to cart", "session_id": session_id}


@router.put("/cart")
async def update_cart_item(item: UpdateCart, session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    query = {}
    if user:
        query["user_id"] = user["user_id"]
    elif session_id:
        query["session_id"] = session_id
    else:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    cart = await db.carts.find_one(query, {"_id": 0})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    if item.quantity <= 0:
        cart["items"] = [ci for ci in cart["items"] if ci["product_id"] != item.product_id]
    else:
        product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Check stock - color-specific or general
        cart_item_ref = next((ci for ci in cart["items"] if ci["product_id"] == item.product_id), None)
        selected_color = cart_item_ref.get("selected_color") if cart_item_ref else None
        
        if selected_color and product.get("colors"):
            color_variant = next((c for c in product["colors"] if c["color_name"] == selected_color), None)
            max_stock = color_variant.get("stock", 0) if color_variant else 0
            if max_stock < item.quantity:
                raise HTTPException(status_code=400, detail=f"Only {max_stock} available for color '{selected_color}'")
        else:
            if product["stock"] < item.quantity:
                raise HTTPException(status_code=400, detail="Insufficient stock")
        
        found = False
        for cart_item in cart["items"]:
            if cart_item["product_id"] == item.product_id:
                cart_item["quantity"] = item.quantity
                found = True
                break
        
        if not found:
            raise HTTPException(status_code=404, detail="Item not in cart")
    
    cart["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.carts.update_one(query, {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}})
    
    return {"message": "Cart updated"}


@router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    query = {}
    if user:
        query["user_id"] = user["user_id"]
    elif session_id:
        query["session_id"] = session_id
    else:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    cart = await db.carts.find_one(query, {"_id": 0})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart["items"] = [item for item in cart["items"] if item["product_id"] != product_id]
    cart["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.carts.update_one(query, {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}})
    
    return {"message": "Item removed from cart"}


@router.post("/orders")
async def create_order(order_data: OrderCreate, session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    query = {}
    if user:
        query["user_id"] = user["user_id"]
    elif session_id:
        query["session_id"] = session_id
    else:
        raise HTTPException(status_code=400, detail="Cart not found")
    
    cart = await db.carts.find_one(query, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # For guest orders, verify phone was OTP-verified (if OTP enabled)
    if not user:
        settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
        otp_enabled = settings.get("otp_verification_enabled", True) if settings else True
        
        if otp_enabled:
            guest_phone = order_data.guest_phone
            if guest_phone:
                clean_phone = guest_phone.replace(" ", "")
                if not clean_phone.startswith('+'):
                    clean_phone = '+' + clean_phone
                verified = await is_phone_recently_verified(clean_phone, "checkout", minutes=30)
                if not verified:
                    raise HTTPException(status_code=403, detail="Phone number not verified. Please verify your phone with OTP before placing an order.")
    
    # Get user info if logged in
    user_info = None
    if user:
        user_info = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    
    product_ids = [item["product_id"] for item in cart["items"]]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
    products_map = {p["id"]: p for p in products}
    
    order_items = []
    total_amount = 0.0
    original_total = 0.0
    shop_ids = set()  # Track all shops involved in this order
    
    for cart_item in cart["items"]:
        product = products_map.get(cart_item["product_id"])
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {cart_item['product_id']} not found")
        
        # Per-shop commission rate and type
        info = await get_shop_commission_info(product.get("shop_id"))
        commission_rate = info["rate"]
        commission_type = info["type"]
        
        selected_color = cart_item.get("selected_color")
        selected_size = cart_item.get("selected_size")
        selected_shape = cart_item.get("selected_shape")
        color_image = None
        has_variant_stock = False
        
        # Check stock - color-specific
        if selected_color and product.get("colors"):
            color_variant = next((c for c in product["colors"] if c["color_name"] == selected_color), None)
            if not color_variant:
                raise HTTPException(status_code=400, detail=f"Color '{selected_color}' not available for {product['name']}")
            if color_variant.get("stock", 0) < cart_item["quantity"]:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']} in {selected_color}")
            color_image = color_variant.get("image_url")
            has_variant_stock = True
        
        # Check stock - size-specific
        if selected_size and product.get("sizes"):
            size_variant = next((s for s in product["sizes"] if s["size_name"] == selected_size), None)
            if not size_variant:
                raise HTTPException(status_code=400, detail=f"Size '{selected_size}' not available for {product['name']}")
            if size_variant.get("stock", 0) < cart_item["quantity"]:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']} in size {selected_size}")
            has_variant_stock = True
        
        # Check stock - shape-specific
        if selected_shape and product.get("shapes"):
            shape_variant = next((sh for sh in product["shapes"] if sh["shape_name"] == selected_shape), None)
            if not shape_variant:
                raise HTTPException(status_code=400, detail=f"Shape '{selected_shape}' not available for {product['name']}")
            if shape_variant.get("stock", 0) < cart_item["quantity"]:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']} in shape {selected_shape}")
            has_variant_stock = True
        
        # If no variant selected, check general stock
        if not has_variant_stock:
            if product["stock"] < cart_item["quantity"]:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']}")
        
        # Get product image - prioritize color image, then first product image
        product_image = color_image or (product.get("images", [None])[0] if product.get("images") else None)
        
        # Listed/shop price from DB (what the shop set)
        listed_price = product.get("discount_price") or product["price"]
        
        # Calculate prices based on commission_type
        customer_factor = get_customer_markup_factor(commission_rate, commission_type)
        shop_factor = get_shop_revenue_factor(commission_rate, commission_type)
        customer_price = round(listed_price * customer_factor, 2)
        shop_price = round(listed_price * shop_factor, 2)
        
        order_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "image": product_image,  # Product/color image
            "selected_color": selected_color,  # Selected color name
            "selected_size": selected_size,  # Selected size name
            "selected_shape": selected_shape,  # Selected shape name
            "price": customer_price,
            "original_price": shop_price,  # what shop earns per unit
            "listed_price": listed_price,
            "quantity": cart_item["quantity"],
            "subtotal": round(customer_price * cart_item["quantity"], 2),
            "original_subtotal": round(shop_price * cart_item["quantity"], 2),  # shop revenue subtotal
            "shop_id": product.get("shop_id"),
            "shop_name": product.get("shop_name"),
            "commission_type": commission_type,
            "commission_rate": commission_rate,
            "shop_sale_discount": product.get("shop_sale_discount"),
            "shop_sale_title": product.get("shop_sale_title"),
        })
        total_amount += customer_price * cart_item["quantity"]
        original_total += shop_price * cart_item["quantity"]
        
        # Track shop
        if product.get("shop_id"):
            shop_ids.add(product["shop_id"])
    
    # Commission amount = customer total - shop total (this works for all 3 commission types)
    commission_amount = round(total_amount - original_total, 2)
    
    # Look up delivery fee from selected state
    delivery_fee = 1.0  # default fallback
    shipping_state = order_data.shipping_address.get("state", "") if isinstance(order_data.shipping_address, dict) else ""
    if shipping_state:
        state_doc = await db.states.find_one(
            {"name": {"$regex": f"^{shipping_state}$", "$options": "i"}, "is_active": True},
            {"_id": 0}
        )
        if state_doc:
            delivery_fee = state_doc.get("delivery_fee", 1.0)
    total_amount += delivery_fee
    
    # ---- Loyalty: Redeem points (NO commission cap — admin pays shop if discount > commission) ----
    loyalty_discount = 0.0
    loyalty_points_redeemed = 0
    loyalty_points_earned = 0
    admin_owes_shop_amount = 0.0
    original_commission_amount = commission_amount  # save before discount
    loyalty_settings = await get_loyalty_settings()
    loyalty_enabled = loyalty_settings.get("loyalty_enabled", False)
    
    if user and loyalty_enabled and order_data.loyalty_points_to_redeem and order_data.loyalty_points_to_redeem > 0:
        user_loyalty = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "loyalty_points_balance": 1})
        balance = user_loyalty.get("loyalty_points_balance", 0) if user_loyalty else 0
        pts = min(order_data.loyalty_points_to_redeem, balance)
        
        if pts > 0:
            redeem_rate = loyalty_settings.get("redeem_points_per_dollar", 100)
            raw_discount = calc_redemption_value(pts, redeem_rate)
            # Cap discount at item total (total_amount - delivery_fee), user always pays delivery
            items_total = total_amount - delivery_fee
            loyalty_discount = min(raw_discount, items_total)
            loyalty_points_redeemed = pts
            total_amount -= loyalty_discount
            # If discount exceeds commission, admin owes shop the difference
            if loyalty_discount > commission_amount:
                admin_owes_shop_amount = round(loyalty_discount - commission_amount, 2)
                commission_amount = 0.0
            else:
                commission_amount -= loyalty_discount
    
    # ---- Loyalty: Calculate points to earn ----
    if user and loyalty_enabled:
        user_data_for_tier = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "loyalty_points_lifetime": 1})
        lifetime = user_data_for_tier.get("loyalty_points_lifetime", 0) if user_data_for_tier else 0
        tiers = loyalty_settings.get("tiers", get_default_loyalty_settings()["tiers"])
        current_tier = calc_tier(lifetime, tiers)
        multiplier = current_tier.get("multiplier", 1.0)
        ppd = loyalty_settings.get("points_per_dollar", 1)
        bonus_mult = 1.0
        if loyalty_settings.get("double_points_weekend_enabled"):
            today = datetime.now(timezone.utc)
            if today.weekday() in [5, 6]:
                bonus_mult = 2.0
        first_purchase_bonus = 0
        if loyalty_settings.get("first_purchase_bonus_enabled"):
            existing_orders = await db.orders.count_documents({"user_id": user["user_id"]})
            if existing_orders == 0:
                first_purchase_bonus = loyalty_settings.get("first_purchase_bonus_points", 100)
        order_subtotal = total_amount - delivery_fee + loyalty_discount
        loyalty_points_earned = calc_points_earned(order_subtotal, multiplier, ppd, bonus_mult) + first_purchase_bonus
    
    order_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"] if user else None,
        # For registered users, use their profile info
        "customer_name": user_info.get("name") if user_info else order_data.guest_name,
        "customer_email": user_info.get("email") if user_info else order_data.guest_email,
        "customer_phone": order_data.user_phone or (user_info.get("phone") if user_info else order_data.guest_phone),
        # Keep guest fields for backward compatibility
        "guest_name": order_data.guest_name,
        "guest_email": order_data.guest_email,
        "guest_phone": order_data.guest_phone,
        "user_phone": order_data.user_phone,
        "shipping_address": dict(order_data.shipping_address),
        "items": order_items,
        "delivery_fee": delivery_fee,
        "commission_amount": commission_amount,
        "total_amount": total_amount,
        "payment_method": order_data.payment_method,
        "payment_status": "pending",
        "order_status": "pending",
        "payout_status": "pending",  # For card payments - tracking shop payouts
        "shop_ids": list(shop_ids),
        "delivery_user_id": None,
        "delivery_status": "pending",
        "loyalty_points_earned": loyalty_points_earned,
        "loyalty_first_purchase_bonus": first_purchase_bonus if user and loyalty_enabled else 0,
        "loyalty_points_redeemed": loyalty_points_redeemed,
        "loyalty_discount_amount": loyalty_discount,
        "original_commission_amount": original_commission_amount,
        "admin_owes_shop_amount": admin_owes_shop_amount,
        "customer_location": dict(order_data.customer_location) if order_data.customer_location else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # ---- Collect gifts for products in this order ----
    order_product_ids = [item["product_id"] for item in order_items]
    gift_docs = await db.product_gifts.find(
        {"product_id": {"$in": order_product_ids}, "is_active": True}, {"_id": 0}
    ).to_list(100)
    gifts_map = {g["product_id"]: g for g in gift_docs}
    
    order_gifts = []
    for item in order_items:
        gift = gifts_map.get(item["product_id"])
        if gift:
            order_gifts.append({
                "product_id": item["product_id"],
                "product_name": item["name"],
                "gift_name": gift.get("gift_name", "Mystery Gift"),
                "gift_image": gift.get("gift_image", ""),
                "quantity": item["quantity"]
            })
    
    order_dict["gifts"] = order_gifts
    
    # ---- Shop Cashback: If logged-in user is a shop, mark cashback eligibility (applied on PAID) ----
    shop_cashback_amount = 0.0
    shop_cashback_shop_id = None
    if user and user_info and user_info.get("role") == "shop" and user_info.get("shop_id"):
        # A configurable % of the original commission goes to the shop's wallet as
        # cashback (admin sets shop_cashback_percent; default 50%). The rest stays as
        # admin profit.
        if original_commission_amount > 0:
            _cb = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0, "shop_cashback_percent": 1})
            cashback_pct = float((_cb or {}).get("shop_cashback_percent", 50) or 0)
            shop_cashback_amount = round(original_commission_amount * (cashback_pct / 100.0), 2)
            shop_cashback_shop_id = user_info.get("shop_id")
            # Mark cashback as PENDING - will be credited when order is marked paid
            order_dict["shop_cashback_amount"] = shop_cashback_amount
            order_dict["shop_cashback_shop_id"] = shop_cashback_shop_id
            order_dict["shop_cashback_status"] = "pending"
            order_dict["is_shop_order"] = True
            # Adjust effective admin commission (half goes to shop as cashback)
            order_dict["effective_admin_commission"] = round(commission_amount - shop_cashback_amount, 2) if commission_amount >= shop_cashback_amount else 0.0
    
    # ---- Handle wallet payment (for shop users) ----
    wallet_paid = False
    if order_data.payment_method == "wallet" and user:
        # Get user's shop info
        user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
        shop_id = user_doc.get("shop_id") if user_doc else None
        if not shop_id:
            raise HTTPException(status_code=400, detail="Wallet payment is only available for shop owners")
        
        shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
        if not shop:
            raise HTTPException(status_code=400, detail="Shop not found for wallet payment")
        
        wallet_balance = shop.get("wallet_balance", 0) or 0
        if wallet_balance < total_amount:
            raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. You have ${wallet_balance:.2f} but need ${total_amount:.2f}")
        
        # Debit shop wallet
        await db.shops.update_one({"id": shop_id}, {"$inc": {"wallet_balance": -total_amount}})
        shop_after = await db.shops.find_one({"id": shop_id}, {"_id": 0, "wallet_balance": 1})
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "shop_id": shop_id,
            "shop_name": shop.get("name", ""),
            "type": "order_wallet_payment",
            "amount": -total_amount,
            "balance_after": shop_after.get("wallet_balance", 0),
            "status": "completed",
            "note": f"Wallet payment for checkout order",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        wallet_paid = True
        order_dict["wallet_paid"] = True
        order_dict["wallet_shop_id"] = shop_id
    
    await db.orders.insert_one(order_dict.copy())
    
    # ---- Shop Cashback is now applied when order is marked as PAID (see _apply_shop_cashback_on_paid) ----
    # We auto-credit cashback only if the order was already paid at creation (e.g., wallet/card paid)
    if shop_cashback_amount > 0 and shop_cashback_shop_id and order_dict.get("payment_status") == "paid":
        try:
            await _apply_shop_cashback_on_paid(order_dict, user)
        except Exception as e:
            logger.error(f"Failed to apply shop cashback on paid: {e}")

    # If the order was paid at creation (wallet/card), also distribute referral-agent commission
    if order_dict.get("payment_status") == "paid":
        try:
            from services.referral_helpers import on_referred_order_settled
            await on_referred_order_settled(order=order_dict)
        except Exception as e:
            logger.error(f"Failed to distribute agent commission on order creation: {e}")
    
    # ---- Loyalty: Apply point changes ----
    if user and loyalty_enabled:
        if loyalty_points_redeemed > 0:
            await db.users.update_one(
                {"id": user["user_id"]},
                {"$inc": {"loyalty_points_balance": -loyalty_points_redeemed}}
            )
            await db.loyalty_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["user_id"],
                "order_id": order_dict["id"],
                "type": "redeem",
                "points": -loyalty_points_redeemed,
                "dollar_value": loyalty_discount,
                "description": f"Redeemed for ${loyalty_discount:.2f} discount on order #{order_dict['id'][:8]}",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        if loyalty_points_earned > 0:
            await db.users.update_one(
                {"id": user["user_id"]},
                {"$inc": {
                    "loyalty_points_balance": loyalty_points_earned,
                    "loyalty_points_lifetime": loyalty_points_earned
                }}
            )
            # Update tier
            updated_user = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "loyalty_points_lifetime": 1})
            new_lt = updated_user.get("loyalty_points_lifetime", 0) if updated_user else 0
            tiers = loyalty_settings.get("tiers", get_default_loyalty_settings()["tiers"])
            new_tier = calc_tier(new_lt, tiers)
            await db.users.update_one({"id": user["user_id"]}, {"$set": {"loyalty_tier": new_tier["name"]}})
            
            await db.loyalty_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["user_id"],
                "order_id": order_dict["id"],
                "type": "earn",
                "points": loyalty_points_earned,
                "description": f"Earned from order #{order_dict['id'][:8]} (${order_subtotal:.2f})",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    for cart_item in cart["items"]:
        selected_color = cart_item.get("selected_color")
        selected_size = cart_item.get("selected_size")
        selected_shape = cart_item.get("selected_shape")
        qty = cart_item["quantity"]
        pid = cart_item["product_id"]
        
        has_variant = False
        
        if selected_color:
            # Decrease color-specific variant stock
            await db.products.update_one(
                {"id": pid, "colors.color_name": selected_color},
                {"$inc": {"colors.$.stock": -qty}}
            )
            has_variant = True
        
        if selected_size:
            # Decrease size-specific variant stock
            await db.products.update_one(
                {"id": pid, "sizes.size_name": selected_size},
                {"$inc": {"sizes.$.stock": -qty}}
            )
            has_variant = True
        
        if selected_shape:
            # Decrease shape-specific variant stock
            await db.products.update_one(
                {"id": pid, "shapes.shape_name": selected_shape},
                {"$inc": {"shapes.$.stock": -qty}}
            )
            has_variant = True
        
        # Always decrease the general product stock
        await db.products.update_one(
            {"id": pid},
            {"$inc": {"stock": -qty}}
        )
    
    await db.carts.delete_one(query)
    
    # Send order confirmation email
    asyncio.create_task(send_order_confirmation_email(order_dict))
    
    # Notify admin about new order
    await create_notification(
        "admin",
        "New Order Received",
        f"Order #{order_dict['id'][:8]} - Total: ${order_dict.get('total_amount', 0):.2f}",
        "order",
        "/admin/orders"
    )
    
    # Notify each shop about their items in the order
    for shop_id in shop_ids:
        shop_items = [item for item in order_dict.get("items", []) if item.get("shop_id") == shop_id]
        shop_total = sum(item.get("original_subtotal", item.get("subtotal", 0)) for item in shop_items)
        items_count = len(shop_items)
        await create_notification(
            "shop",
            "New Order Received",
            f"You have {items_count} item(s) in Order #{order_dict['id'][:8]}. Revenue: ${shop_total:.2f}",
            "order",
            "/shop/orders",
            shop_id
        )
    
    return {k: v for k, v in order_dict.items() if k != "_id"}


@router.get("/orders")
async def get_orders(user: Dict = Depends(require_auth)):
    if user["role"] == "admin":
        orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    else:
        orders = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    
    # Pre-fetch all shops we'll need
    all_shop_ids = set()
    for order in orders:
        for sid in (order.get('shop_ids') or []):
            if sid: all_shop_ids.add(sid)
        for item in (order.get('items') or []):
            sid = item.get('shop_id')
            if sid: all_shop_ids.add(sid)
    
    shop_name_map = {}
    if all_shop_ids:
        shops = await db.shops.find({"id": {"$in": list(all_shop_ids)}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
        shop_name_map = {s["id"]: s.get("name") for s in shops}
    
    # Enrich orders with shop names
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        
        # Enrich each item with shop_name (so Revenue Breakdown works)
        for item in (order.get('items') or []):
            sid = item.get('shop_id')
            if sid and not item.get('shop_name'):
                item['shop_name'] = shop_name_map.get(sid, 'Unknown Shop')
        
        # Get shop names from items
        shop_ids = order.get('shop_ids', [])
        if shop_ids:
            # If single shop, get its name
            if len(shop_ids) == 1:
                order['shop_name'] = shop_name_map.get(shop_ids[0], 'Unknown Shop')
            else:
                # Multiple shops
                order['shop_name'] = f"{len(shop_ids)} Shops"
        elif order.get('shop_id'):
            # Legacy: single shop_id field
            order['shop_name'] = shop_name_map.get(order['shop_id'], 'Unknown Shop')
    
    return orders


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: Optional[Dict] = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if user and user["role"] != "admin" and order.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return order


@router.get("/orders/track/{order_id}")
async def track_order_public(order_id: str):
    """Public endpoint for order tracking - no auth required"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    # Return limited info for public tracking
    return {
        "id": order.get("id"),
        "order_status": order.get("order_status"),
        "payment_status": order.get("payment_status"),
        "payment_method": order.get("payment_method"),
        "total_amount": order.get("total_amount"),
        "delivery_fee": order.get("delivery_fee", 0),
        "delivery_status": order.get("delivery_status", "pending"),
        "items": order.get("items", []),
        "shipping_address": order.get("shipping_address"),
        "created_at": order.get("created_at")
    }


@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, order_status: str, admin: Dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.get("order_status")
    old_payment_status = order.get("payment_status", "pending")

    update_fields = {
        "order_status": order_status,
        "payment_status": "paid" if order_status == "paid" else old_payment_status,
    }

    result = await db.orders.find_one_and_update(
        {"id": order_id},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0}
    )

    # On first transition to paid: distribute shop revenue + admin commission,
    # apply shop cashback, and pay the referral agent's share (all idempotent).
    if order_status == "paid":
        await settle_order_as_paid(order_id)
    
    # Handle wallet/card refund on cancellation
    if order_status == "cancelled" and old_status != "cancelled":
        if (order.get("wallet_paid") or order.get("payment_method") in ("wallet", "card")) and not order.get("refund_processed"):
            refund_amount = order.get("total_amount", 0)
            created_by_shop = order.get("created_by_shop") or order.get("wallet_shop_id") or (order.get("shop_ids", [None])[0] if order.get("shop_ids") else None)
            if refund_amount > 0 and created_by_shop:
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
                    for item in order.get("items", []):
                        sid = item.get("shop_id")
                        if sid:
                            orig_subtotal = item.get("original_subtotal", item.get("subtotal", 0))
                            await db.shops.update_one(
                                {"id": sid},
                                {"$inc": {"total_revenue": -orig_subtotal, "wallet_balance": -orig_subtotal}}
                            )
                    await db.admin_revenue.delete_many({"order_id": order_id})
                    await db.held_delivery_fees.delete_many({"order_id": order_id})
                # Mark refund as processed to prevent double refund
                await db.orders.update_one({"id": order_id}, {"$set": {"refund_processed": True, "refund_processed_at": datetime.now(timezone.utc).isoformat()}})
    
    # Send status update email if status changed
    if old_status != order_status:
        customer_email = None
        if order.get("user_id"):
            user_data = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
            customer_email = user_data.get("email") if user_data else None
        elif order.get("guest_email"):
            customer_email = order["guest_email"]
        
        if customer_email and order_status.lower() in ["processing", "shipped", "delivered", "cancelled"]:
            try:
                await send_order_status_email(customer_email, order_id, order_status)
            except Exception as e:
                logging.error(f"Failed to send order status email: {e}")
    
    return result


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str, admin: Dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("payment_status") == "paid":
        for item in order.get("items", []):
            await db.products.update_one(
                {"id": item["product_id"]},
                {"$inc": {"stock": item["quantity"]}}
            )
    
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Order deleted", "was_paid": order.get("payment_status") == "paid"}


@router.post("/wishlist/{product_id}")
async def add_to_wishlist(product_id: str, session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if user:
        wishlist = await db.wishlists.find_one({"user_id": user["user_id"]}, {"_id": 0})
        query = {"user_id": user["user_id"]}
    else:
        if not session_id:
            session_id = str(uuid.uuid4())
        wishlist = await db.wishlists.find_one({"session_id": session_id}, {"_id": 0})
        query = {"session_id": session_id}
    
    if not wishlist:
        wishlist = {
            "id": str(uuid.uuid4()),
            "user_id": user["user_id"] if user else None,
            "session_id": session_id if not user else None,
            "product_ids": [product_id],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wishlists.insert_one(wishlist)
    else:
        if product_id not in wishlist.get("product_ids", []):
            await db.wishlists.update_one(
                query,
                {"$push": {"product_ids": product_id}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    return {"message": "Product added to wishlist", "session_id": session_id if not user else None}


@router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    if user:
        query = {"user_id": user["user_id"]}
    elif session_id:
        query = {"session_id": session_id}
    else:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    await db.wishlists.update_one(
        query,
        {"$pull": {"product_ids": product_id}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Product removed from wishlist"}


@router.get("/wishlist")
async def get_wishlist(session_id: Optional[str] = None, user: Optional[Dict] = Depends(get_current_user)):
    query = {}
    if user:
        query["user_id"] = user["user_id"]
    elif session_id:
        query["session_id"] = session_id
    else:
        return {"products": []}
    
    wishlist = await db.wishlists.find_one(query, {"_id": 0})
    if not wishlist:
        return {"products": []}
    
    product_ids = wishlist.get("product_ids", [])
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
    
    return {"products": products}


@router.post("/payment/checkout")
async def create_checkout_session(
    request: Request,
    order_id: str,
    origin_url: str,
    user: Optional[Dict] = Depends(get_current_user)
):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["payment_method"] != "card":
        raise HTTPException(status_code=400, detail="This order uses cash on delivery")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{origin_url}/order-success?session_id={{{{CHECKOUT_SESSION_ID}}}}"
    cancel_url = f"{origin_url}/checkout"
    
    metadata = {
        "order_id": order_id,
        "user_id": user["user_id"] if user else "guest"
    }
    
    checkout_request = CheckoutSessionRequest(
        amount=float(order["total_amount"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["user_id"] if user else None,
        "order_id": order_id,
        "amount": float(order["total_amount"]),
        "currency": "usd",
        "metadata": metadata,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)
    
    return {"url": session.url, "session_id": session.session_id}


@router.get("/payment/status/{session_id}")
async def check_payment_status(session_id: str):
    host_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if status.payment_status == "paid" and transaction["payment_status"] != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": "completed"}}
        )
        
        order_id = transaction["metadata"].get("order_id")
        if order_id:
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"payment_status": "paid", "order_status": "paid"}}
            )
            # Apply shop cashback now that order is paid
            paid_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
            if paid_order:
                try:
                    await _apply_shop_cashback_on_paid(paid_order)
                except Exception as e:
                    logger.error(f"Failed to apply cashback (check_status): {e}")
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            transaction = await db.payment_transactions.find_one(
                {"session_id": webhook_response.session_id},
                {"_id": 0}
            )
            
            if transaction and transaction["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "status": "completed"}}
                )
                
                order_id = transaction["metadata"].get("order_id")
                if order_id:
                    await db.orders.update_one(
                        {"id": order_id},
                        {"$set": {"payment_status": "paid", "order_status": "paid"}}
                    )
                    # Apply shop cashback now that order is paid
                    paid_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
                    if paid_order:
                        try:
                            await _apply_shop_cashback_on_paid(paid_order)
                        except Exception as e:
                            logger.error(f"Failed to apply cashback (webhook): {e}")
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{order_id}/cancel-request")
async def request_cancel_order(order_id: str, request: Request, user: Optional[Dict] = Depends(get_current_user)):
    """User submits a cancellation request for their order (instead of directly cancelling)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check ownership
    if user:
        if order.get("user_id") != user["user_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to request cancellation of this order")
    
    # Check if order can be cancelled (only pending and confirmed orders, NOT processing)
    if order.get("order_status") not in ["pending", "confirmed"]:
        raise HTTPException(status_code=400, detail="Only pending or confirmed orders can be requested for cancellation. Processing orders cannot be cancelled.")
    
    if order.get("delivery_status") not in ["pending", None]:
        raise HTTPException(status_code=400, detail="Order is already being processed for delivery.")
    
    # Check for existing pending request
    existing = await db.cancel_requests.find_one({"order_id": order_id, "status": "pending"}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="A cancellation request is already pending for this order.")
    
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    
    cancel_request = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "user_id": user["user_id"] if user else None,
        "customer_name": order.get("customer_name") or order.get("guest_name"),
        "customer_email": order.get("customer_email") or order.get("guest_email"),
        "customer_phone": order.get("customer_phone") or order.get("user_phone") or order.get("guest_phone"),
        "reason": body.get("reason", ""),
        "status": "pending",  # pending, approved, rejected
        "order_total": order.get("total_amount", 0),
        "order_items_count": len(order.get("items", [])),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "decided_at": None,
        "decided_by": None,
        "admin_note": None
    }
    
    await db.cancel_requests.insert_one(cancel_request.copy())
    
    # Mark the order as having a pending cancel request
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"cancel_request_status": "pending"}}
    )
    
    # Notify admin
    await create_notification(
        "admin",
        "New Cancellation Request",
        f"Customer requested cancellation for order #{order_id[:8]}. Total: ${order.get('total_amount', 0):.2f}",
        "order",
        "/admin/cancel-requests"
    )
    
    return {"message": "Cancellation request submitted successfully", "request_id": cancel_request["id"]}


@router.get("/orders/{order_id}/cancel-request-status")
async def get_cancel_request_status(order_id: str, user: Optional[Dict] = Depends(get_current_user)):
    """Get the status of a cancellation request for an order"""
    req = await db.cancel_requests.find_one(
        {"order_id": order_id},
        {"_id": 0}
    )
    if not req:
        return {"has_request": False}
    return {"has_request": True, "request": req}
