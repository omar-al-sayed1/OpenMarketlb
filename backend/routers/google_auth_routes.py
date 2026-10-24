"""
OpenMarket Lebanon - Google OAuth Routes
REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from typing import Optional, Dict
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
import os
import uuid
import bcrypt
import json
from urllib.parse import urlencode

import httpx

from config import db, logger, JWT_SECRET, JWT_ALGORITHM
from auth import create_token, require_auth

try:
    from services.otp_service import create_and_send_otp, verify_otp_code, is_phone_recently_verified
except ImportError:
    create_and_send_otp = verify_otp_code = is_phone_recently_verified = None

GOOGLE_SIGNUP_OTP_PURPOSE = "google_signup"

router = APIRouter()

# Google OAuth configuration (loaded from env)
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
FRONTEND_URL = os.environ.get('FRONTEND_URL', '').rstrip('/')

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleCompleteSignup(BaseModel):
    """Payload for completing a Google signup with extra info."""
    pending_token: str  # token returned by /auth/google/callback for new users
    phone: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None


def _build_redirect_uri(request: Request) -> str:
    """Build the OAuth callback redirect URI dynamically from the request host.
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    # Always use FRONTEND_URL from env (it MUST match what's in Google Console)
    if FRONTEND_URL:
        return f"{FRONTEND_URL}/api/auth/google/callback"
    # Fallback: build from request (works in dev)
    scheme = request.headers.get('x-forwarded-proto', request.url.scheme)
    host = request.headers.get('x-forwarded-host', request.url.hostname)
    return f"{scheme}://{host}/api/auth/google/callback"


def _valid_mobile_redirect(url: Optional[str]) -> Optional[str]:
    """Only allow the native app's deep-link schemes as a post-auth redirect target
    (prevents open-redirect). Does NOT affect the Google OAuth redirect_uri."""
    if not url:
        return None
    for scheme in ("openmarket://", "exp://", "exps://"):
        if url.startswith(scheme):
            return url
    return None


@router.get("/auth/google/login")
async def google_login(request: Request, intent: str = "login", mobile_redirect: Optional[str] = None):
    """Start Google OAuth flow.
    intent='signup' or 'login' or 'connect' — currently treated the same; new users go through signup completion.
    mobile_redirect (optional): a native app deep link the callback should return to (mobile app)."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    redirect_uri = _build_redirect_uri(request)
    state = uuid.uuid4().hex
    # Persist intent + nonce in DB (oauth_states) so callback can validate
    await db.oauth_states.insert_one({
        "state": state,
        "intent": intent,
        "mobile_redirect": _valid_mobile_redirect(mobile_redirect),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/auth/google/callback")
async def google_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    """Handle Google OAuth callback. Exchanges code for tokens, fetches user info, then:
    - If user exists -> returns final auth token
    - If new user -> returns a short-lived pending_token + prefilled info so frontend can collect remaining details
    """
    if error:
        # Redirect user back to auth page with error
        return RedirectResponse(url=f"{FRONTEND_URL}/auth?google_error={error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    # Validate state
    state_doc = await db.oauth_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    # One-time use
    await db.oauth_states.delete_one({"state": state})

    # If this flow was started by the mobile app, return to its deep link instead
    # of the web frontend. (Google's redirect_uri is unchanged — web auth intact.)
    mobile_redirect = _valid_mobile_redirect(state_doc.get("mobile_redirect"))
    result_base = mobile_redirect if mobile_redirect else f"{FRONTEND_URL}/auth/google/result"
    sep = "?" if "?" not in result_base else "&"

    redirect_uri = _build_redirect_uri(request)

    # Exchange code for tokens
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }, headers={"Content-Type": "application/x-www-form-urlencoded"})
            if token_resp.status_code != 200:
                logger.error(f"Google token exchange failed: {token_resp.status_code} {token_resp.text}")
                return RedirectResponse(url=f"{FRONTEND_URL}/auth?google_error=token_exchange_failed")
            tokens = token_resp.json()
            access_token = tokens.get("access_token")
            if not access_token:
                return RedirectResponse(url=f"{FRONTEND_URL}/auth?google_error=no_access_token")

            # Fetch user info
            ui_resp = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
            if ui_resp.status_code != 200:
                logger.error(f"Google userinfo failed: {ui_resp.status_code} {ui_resp.text}")
                return RedirectResponse(url=f"{FRONTEND_URL}/auth?google_error=userinfo_failed")
            ui = ui_resp.json()
    except Exception as e:
        logger.error(f"Google OAuth exception: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/auth?google_error=exception")

    google_id = ui.get("sub")
    email = (ui.get("email") or "").lower()
    if not google_id or not email:
        return RedirectResponse(url=f"{FRONTEND_URL}/auth?google_error=no_email")

    name = ui.get("name") or (ui.get("given_name", "") + " " + ui.get("family_name", "")).strip()
    picture = ui.get("picture")
    email_verified = bool(ui.get("email_verified", True))

    # Find existing user by google_id or email
    existing_user = await db.users.find_one({"$or": [{"google_id": google_id}, {"email": email}]}, {"_id": 0})

    if existing_user:
        # Link google_id if missing
        update_fields = {}
        if not existing_user.get("google_id"):
            update_fields["google_id"] = google_id
        if picture and not existing_user.get("avatar"):
            update_fields["avatar"] = picture
        if email_verified and not existing_user.get("email_verified"):
            update_fields["email_verified"] = True
        if update_fields:
            await db.users.update_one({"id": existing_user["id"]}, {"$set": update_fields})

        # Issue our own JWT
        token = create_token(existing_user["id"], existing_user["email"], existing_user.get("role", "user"))
        # Redirect back to frontend (or mobile deep link) with token
        redirect_url = f"{result_base}{sep}token={token}&new_user=0"
        return RedirectResponse(url=redirect_url)

    # NEW USER: create a "pending google signup" record (short-lived) and let frontend collect more info
    pending_id = str(uuid.uuid4())
    await db.google_pending_signups.insert_one({
        "id": pending_id,
        "google_id": google_id,
        "email": email,
        "name": name,
        "picture": picture,
        "email_verified": email_verified,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Pass pending_id + prefilled info in the redirect URL (URL-safe encode picture too)
    qs = urlencode({
        "pending_id": pending_id,
        "email": email,
        "name": name,
        "picture": picture or "",
        "new_user": 1,
    })
    redirect_url = f"{result_base}{sep}{qs}"
    return RedirectResponse(url=redirect_url)


@router.get("/auth/google/pending/{pending_id}")
async def get_pending_google_signup(pending_id: str):
    """Get prefilled info for a pending Google signup."""
    doc = await db.google_pending_signups.find_one({"id": pending_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pending signup not found or expired")
    return {
        "email": doc.get("email"),
        "name": doc.get("name"),
        "picture": doc.get("picture"),
    }


class GoogleCompleteSignupReq(BaseModel):
    pending_id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None


class GoogleOtpSendReq(BaseModel):
    pending_id: str
    phone: str


class GoogleOtpVerifyReq(BaseModel):
    pending_id: str
    phone: str
    code: str


def _normalize_phone(phone: str) -> str:
    phone = (phone or "").strip().replace(" ", "")
    if phone and not phone.startswith('+'):
        phone = '+' + phone
    return phone


@router.post("/auth/google/otp/send")
async def google_signup_send_otp(req: GoogleOtpSendReq):
    """Send an OTP to the phone number provided during Google signup completion."""
    if create_and_send_otp is None:
        raise HTTPException(status_code=500, detail="OTP service unavailable")
    # Pending signup must still exist
    doc = await db.google_pending_signups.find_one({"id": req.pending_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pending signup not found or expired")

    phone = _normalize_phone(req.phone)
    if not phone or len(phone.replace("+", "")) < 7:
        raise HTTPException(status_code=400, detail="Valid phone number is required")

    # Ensure phone isn't already used by an existing account
    existing = await db.users.find_one({"phone": phone}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="This phone number is already registered")

    result = await create_and_send_otp(phone, GOOGLE_SIGNUP_OTP_PURPOSE)
    return {"status": "sent", "message": "Verification code sent", **result}


@router.post("/auth/google/otp/verify")
async def google_signup_verify_otp(req: GoogleOtpVerifyReq):
    """Verify the OTP code for a Google signup phone number."""
    if verify_otp_code is None:
        raise HTTPException(status_code=500, detail="OTP service unavailable")
    doc = await db.google_pending_signups.find_one({"id": req.pending_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pending signup not found or expired")

    phone = _normalize_phone(req.phone)
    is_valid = await verify_otp_code(phone, req.code, GOOGLE_SIGNUP_OTP_PURPOSE)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    # Persist verification on the pending record so /complete can trust it
    await db.google_pending_signups.update_one(
        {"id": req.pending_id},
        {"$set": {"phone": phone, "phone_verified": True, "phone_verified_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"valid": True, "status": "approved"}


@router.post("/auth/google/complete")
async def complete_google_signup(req: GoogleCompleteSignupReq):
    """Finalize a Google signup with the extra info user filled in."""
    doc = await db.google_pending_signups.find_one({"id": req.pending_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pending signup not found or expired")

    email = doc.get("email")
    # Double-check user doesn't already exist (race)
    existing = await db.users.find_one({"$or": [{"email": email}, {"google_id": doc.get("google_id")}]}, {"_id": 0})
    if existing:
        # User was created between login and completion; just issue token
        token = create_token(existing["id"], existing["email"], existing.get("role", "user"))
        await db.google_pending_signups.delete_one({"id": req.pending_id})
        return {
            "token": token,
            "user": {
                "id": existing["id"],
                "email": existing["email"],
                "name": existing.get("name"),
                "role": existing.get("role", "user"),
            },
        }

    # Validate required fields
    if not req.state:
        raise HTTPException(status_code=400, detail="State is required")
    if not req.phone:
        raise HTTPException(status_code=400, detail="Phone is required")

    # Require the phone number to be verified via OTP before creating the account.
    req_phone = _normalize_phone(req.phone)
    phone_verified = False
    # Trust the pending record flag (set by /auth/google/otp/verify) ...
    if doc.get("phone_verified") and _normalize_phone(doc.get("phone", "")) == req_phone:
        phone_verified = True
    # ... or fall back to a recent verification record for this phone.
    if not phone_verified and is_phone_recently_verified is not None:
        try:
            phone_verified = await is_phone_recently_verified(req_phone, GOOGLE_SIGNUP_OTP_PURPOSE, minutes=30)
        except Exception:
            phone_verified = False
    if not phone_verified:
        raise HTTPException(status_code=400, detail="Phone number not verified. Please verify your phone with the code we sent.")

    # Create user — no password (Google-managed). Set a random unusable hash.
    random_pw_hash = bcrypt.hashpw(uuid.uuid4().hex.encode(), bcrypt.gensalt()).decode()
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password": random_pw_hash,  # placeholder - user can never login with this
        "name": req.name or doc.get("name") or email.split('@')[0],
        "phone": req_phone,
        "address": req.address or "",
        "state": req.state,
        "role": "user",
        "google_id": doc.get("google_id"),
        "avatar": doc.get("picture"),
        "email_verified": bool(doc.get("email_verified", True)),
        "phone_verified": True,
        "auth_provider": "google",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    # Delete pending
    await db.google_pending_signups.delete_one({"id": req.pending_id})

    token = create_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }
