"""
OpenMarket Lebanon - Auth Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
import uuid, bcrypt, hashlib, random, os, asyncio, shutil, json
from pathlib import Path

from config import db, logger, UPLOADS_DIR, STRIPE_SECRET_KEY, ROOT_DIR, JWT_SECRET, JWT_ALGORITHM, client, SMTP_USER, SMTP_PASS, OTP_EXPIRY_MINUTES
from auth import create_token, verify_token, get_current_user, require_auth, require_admin, require_shop, require_delivery, require_shop_or_admin, security
from models import *
from services.helpers import auto_credit_bonus_events

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



@router.post("/otp/send")
async def send_otp(request: PhoneOTPRequest):
    """Send OTP to phone number via WhatsApp for guest checkout verification"""
    phone = request.phone_number.strip()
    if not phone.startswith('+'):
        phone = '+' + phone
    
    result = await create_and_send_otp(phone, request.purpose or "checkout")
    return {"status": "sent", "message": "Verification code sent", **result}


@router.post("/otp/verify")
async def verify_otp_endpoint(request: PhoneOTPVerify, authorization: Optional[str] = Header(None)):
    """Verify OTP code for guest checkout - also marks phone as verified for logged-in users"""
    phone = request.phone_number.strip()
    is_valid = await verify_otp_code(phone, request.code, request.purpose or "checkout")
    
    # If valid and user is logged in, mark phone as verified in their profile
    if is_valid and authorization:
        try:
            token = authorization.replace("Bearer ", "")
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            if user_id:
                await db.users.update_one({"id": user_id}, {"$set": {"phone_verified": True}})
        except Exception:
            pass  # Silent fail - OTP is still valid
    
    return {"valid": is_valid, "status": "approved" if is_valid else "failed"}


@router.get("/otp/check/{phone_number}")
async def check_phone_verified(phone_number: str):
    """Check if a phone number has been verified recently (within 30 minutes)"""
    phone = phone_number.strip()
    verified = await is_phone_recently_verified(phone, "checkout", minutes=30)
    return {"verified": verified}


@router.get("/geocode/reverse")
async def reverse_geocode(lat: float, lng: float):
    """Reverse geocode coordinates to address using Nominatim"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json", "addressdetails": 1, "zoom": 18},
                headers={"User-Agent": "OpenMarketLB/1.0 (contact@openmarketlb.com)", "Accept-Language": "en"}
            )
            if resp.status_code == 200:
                data = resp.json()
                addr = data.get("address", {})
                return {
                    "address": data.get("display_name", ""),
                    "road": addr.get("road", ""),
                    "city": addr.get("city") or addr.get("town") or addr.get("village") or addr.get("suburb", ""),
                    "state": addr.get("state") or addr.get("governorate", ""),
                    "zip": addr.get("postcode", ""),
                    "country": addr.get("country", ""),
                }
    except Exception as e:
        logger.error(f"Reverse geocode failed: {e}")
    return {"address": "", "road": "", "city": "", "state": "", "zip": "", "country": ""}


@router.get("/geocode/search")
async def geocode_search(q: str):
    """Forward geocode a free-text query to coordinates using Nominatim (map search)."""
    if not q or not q.strip():
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q.strip(), "format": "json", "addressdetails": 1, "limit": 6},
                headers={"User-Agent": "OpenMarketLB/1.0 (contact@openmarketlb.com)", "Accept-Language": "en"}
            )
            if resp.status_code == 200:
                results = resp.json()
                out = []
                for r in results:
                    try:
                        out.append({
                            "lat": float(r["lat"]),
                            "lng": float(r["lon"]),
                            "label": r.get("display_name", ""),
                        })
                    except (KeyError, ValueError, TypeError):
                        continue
                return out
    except Exception as e:
        logger.error(f"Geocode search failed: {e}")
    return []


@router.post("/auth/login/start")
async def login_start(credentials: LoginStart):
    """Step 1: Validate credentials and send OTP to user's phone"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode(), user["password"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if OTP is enabled in platform settings
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    otp_enabled = settings.get("otp_verification_enabled", True) if settings else True
    
    if not otp_enabled:
        # OTP disabled - issue token directly
        token = create_token(user["id"], user["email"], user["role"])
        # Auto-credit active bonus events on login
        if user.get("role") == "user":
            asyncio.create_task(auto_credit_bonus_events(user["id"]))
        return {
            "otp_required": False,
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"]
            }
        }
    
    # Check if user has phone number
    phone = user.get("phone", "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="No phone number on file. Please contact support.")
    
    # Normalize phone
    clean_phone = phone.replace(" ", "")
    if not clean_phone.startswith('+'):
        clean_phone = '+' + clean_phone
    
    # Create login challenge
    challenge_id = str(uuid.uuid4())
    
    # Send OTP
    result = await create_and_send_otp(clean_phone, "login")
    
    # Store challenge linking user to this OTP flow
    await db.login_challenges.insert_one({
        "id": challenge_id,
        "user_id": user["id"],
        "phone": clean_phone,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat(),
    })
    
    # Mask phone for display
    masked_phone = clean_phone[:4] + "****" + clean_phone[-4:] if len(clean_phone) > 8 else "****" + clean_phone[-4:]
    
    return {
        "otp_required": True,
        "challenge_id": challenge_id,
        "masked_phone": masked_phone,
        "message": "Verification code sent via WhatsApp",
        "expires_in": OTP_EXPIRY_MINUTES * 60
    }


@router.post("/auth/login/verify")
async def login_verify(data: LoginVerifyOTP):
    """Step 2: Verify OTP and complete login"""
    challenge = await db.login_challenges.find_one({"id": data.challenge_id, "status": "pending"})
    
    if not challenge:
        raise HTTPException(status_code=400, detail="Invalid or expired login challenge")
    
    # Check challenge expiry
    expires_at = datetime.fromisoformat(challenge["expires_at"]) if isinstance(challenge["expires_at"], str) else challenge["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) >= expires_at:
        await db.login_challenges.update_one({"id": data.challenge_id}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Login challenge has expired. Please try again.")
    
    # Verify OTP
    is_valid = await verify_otp_code(challenge["phone"], data.code, "login")
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Mark challenge as completed
    await db.login_challenges.update_one({"id": data.challenge_id}, {"$set": {"status": "completed"}})
    
    # Get user and issue token
    user = await db.users.find_one({"id": challenge["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    token = create_token(user["id"], user["email"], user["role"])
    
    # Auto-credit active bonus events on login
    if user.get("role") == "user":
        asyncio.create_task(auto_credit_bonus_events(user["id"]))
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }


@router.post("/auth/login/resend")
async def login_resend_otp(challenge_id: str):
    """Resend OTP for an existing login challenge"""
    challenge = await db.login_challenges.find_one({"id": challenge_id, "status": "pending"})
    
    if not challenge:
        raise HTTPException(status_code=400, detail="Invalid or expired login challenge")
    
    # Check challenge expiry
    expires_at = datetime.fromisoformat(challenge["expires_at"]) if isinstance(challenge["expires_at"], str) else challenge["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) >= expires_at:
        await db.login_challenges.update_one({"id": challenge_id}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Login challenge has expired. Please try again.")
    
    # Send new OTP (rate limiting handled inside)
    result = await create_and_send_otp(challenge["phone"], "login")
    
    # Extend challenge expiry
    new_expiry = (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()
    await db.login_challenges.update_one({"id": challenge_id}, {"$set": {"expires_at": new_expiry}})
    
    return {"message": "New verification code sent", "expires_in": OTP_EXPIRY_MINUTES * 60}


@router.post("/auth/signup/send-otp")
async def signup_send_otp(user_data: UserSignup):
    """Step 1: Validate signup data and send OTP to phone number"""
    # Validate email not taken
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Phone is required for OTP signup
    if not user_data.phone or len(user_data.phone.replace(" ", "").replace("+", "")) < 7:
        raise HTTPException(status_code=400, detail="Valid phone number is required")
    
    # Format phone
    phone = user_data.phone.replace(" ", "")
    if not phone.startswith('+'):
        phone = '+' + phone
    
    # Store pending signup data (hashed password)
    hashed_password = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt()).decode()
    pending_id = str(uuid.uuid4())
    
    # Remove old pending signups for same email
    await db.pending_signups.delete_many({"email": user_data.email})
    
    pending_doc = {
        "id": pending_id,
        "email": user_data.email,
        "password": hashed_password,
        "name": user_data.name,
        "phone": phone,
        "address": user_data.address or "",
        "city": user_data.city or "",
        "state": user_data.state or "",
        "zip": user_data.zip or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    }
    await db.pending_signups.insert_one(pending_doc)
    
    # Send OTP
    result = await create_and_send_otp(phone, "signup")
    
    response = {
        "pending_id": pending_id,
        "phone_masked": phone[:4] + "****" + phone[-3:],
        "message": "Verification code sent",
        "expires_in": OTP_EXPIRY_MINUTES * 60
    }
    # OTP code is only present here in development (create_and_send_otp strips it in production).
    if result.get("otp_code"):
        response["otp_code"] = result["otp_code"]
    return response


@router.post("/auth/signup/verify")
async def signup_verify_otp(request: Request):
    """Step 2: Verify OTP and create user account"""
    body = await request.json()
    pending_id = body.get("pending_id")
    code = body.get("code")
    
    if not pending_id or not code:
        raise HTTPException(status_code=400, detail="Missing pending_id or code")
    
    # Get pending signup
    pending = await db.pending_signups.find_one({"id": pending_id}, {"_id": 0})
    if not pending:
        raise HTTPException(status_code=400, detail="Signup session expired or invalid. Please start over.")
    
    # Check expiry
    expires_at = datetime.fromisoformat(pending["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) >= expires_at:
        await db.pending_signups.delete_one({"id": pending_id})
        raise HTTPException(status_code=400, detail="Signup session expired. Please start over.")
    
    # Verify OTP
    is_valid = await verify_otp_code(pending["phone"], code, "signup")
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Double-check email still available
    existing_user = await db.users.find_one({"email": pending["email"]}, {"_id": 0})
    if existing_user:
        await db.pending_signups.delete_one({"id": pending_id})
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create the user
    user = {
        "id": str(uuid.uuid4()),
        "email": pending["email"],
        "password": pending["password"],
        "name": pending["name"],
        "phone": pending["phone"],
        "address": pending["address"],
        "city": pending["city"],
        "state": pending["state"],
        "zip": pending["zip"],
        "role": "user",
        "phone_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    await db.pending_signups.delete_one({"id": pending_id})
    
    token = create_token(user["id"], user["email"], user["role"])
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }


@router.post("/auth/signup/resend-otp")
async def signup_resend_otp(request: Request):
    """Resend OTP for pending signup"""
    body = await request.json()
    pending_id = body.get("pending_id")
    
    if not pending_id:
        raise HTTPException(status_code=400, detail="Missing pending_id")
    
    pending = await db.pending_signups.find_one({"id": pending_id}, {"_id": 0})
    if not pending:
        raise HTTPException(status_code=400, detail="Signup session expired or invalid. Please start over.")
    
    # Resend OTP
    result = await create_and_send_otp(pending["phone"], "signup")
    
    return {
        "message": "New verification code sent",
        "expires_in": OTP_EXPIRY_MINUTES * 60
    }


@router.post("/auth/signup")
async def signup(user_data: UserSignup):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt()).decode()
    user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hashed_password,
        "name": user_data.name,
        "phone": user_data.phone,
        "address": user_data.address,
        "city": user_data.city,
        "state": user_data.state,
        "zip": user_data.zip,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    token = create_token(user["id"], user["email"], user["role"])
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }


@router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode(), user["password"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    
    # Auto-credit active bonus events on login
    if user.get("role") == "user":
        asyncio.create_task(auto_credit_bonus_events(user["id"]))
    
    # If shop owner, attach shop_id so frontend can identify ownership
    shop_id = None
    if user.get("role") == "shop":
        try:
            shop = await db.shops.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
            if shop:
                shop_id = shop.get("id")
        except Exception:
            shop_id = None
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "shop_id": shop_id,
        }
    }


@router.get("/auth/me")
async def get_me(user: Dict = Depends(require_auth)):
    user_data = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "password": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # For shop users: ensure shop_id is populated by looking it up from shops collection
    if user_data.get("role") == "shop" and not user_data.get("shop_id"):
        shop_lookup = await db.shops.find_one({"user_id": user_data["id"]}, {"_id": 0, "id": 1})
        if shop_lookup:
            user_data["shop_id"] = shop_lookup.get("id")
    
    # Enrich with shop tier info
    if user_data.get("role") == "shop" and user_data.get("shop_id"):
        shop = await db.shops.find_one({"id": user_data["shop_id"]}, {"_id": 0})
        if shop:
            user_data["tier"] = shop.get("tier", "starter")
            user_data["subscription_status"] = shop.get("subscription_status")
            # Get badge info
            settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
            if settings:
                tiers = settings.get("tiers", {})
                tier_config = tiers.get(shop.get("tier", "starter"), {})
                user_data["tier_badge"] = tier_config.get("badge", "")
    
    return user_data
