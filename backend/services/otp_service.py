"""
OTP (One-Time Password) service for phone verification.
"""
import asyncio
import hashlib
import random
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from fastapi import HTTPException

from config import (
    db, logger, UNIMATRIX_API_KEY, UNIMATRIX_SIGNATURE, OTP_EXPIRY_MINUTES, OTP_COOLDOWN_SECONDS,
    OTP_MAX_ATTEMPTS, OTP_EXPOSE_CODE, OTP_DOUBLE_SEND, OTP_RESEND_DELAY_SECONDS,
)

# Keep references to background resend tasks so they aren't garbage-collected mid-flight.
_bg_tasks = set()


async def _delayed_resend(phone: str, otp_code: str, delay: int):
    """Re-send the SAME OTP code once, after a short delay, to beat carrier first-message
    filtering. Runs in the background; the DB record is untouched so verification is unaffected."""
    try:
        await asyncio.sleep(delay)
        res = await send_sms_otp(phone, otp_code)
        logger.info(f"OTP double-send (retry) for {phone}: status={res.get('status')}")
    except Exception as e:
        logger.warning(f"OTP double-send retry failed for {phone}: {e}")



def generate_otp() -> str:
    """Generate a random 6-digit OTP"""
    return str(random.randint(100000, 999999))


def hash_otp(code: str) -> str:
    """Hash OTP code for secure storage"""
    return hashlib.sha256(code.encode()).hexdigest()


def verify_otp_hash(code: str, code_hash: str) -> bool:
    """Verify OTP code against stored hash"""
    return hashlib.sha256(code.encode()).hexdigest() == code_hash


async def send_sms_otp(phone: str, otp_code: str) -> dict:
    """Send OTP via Unimatrix SMS API, with fallback to returning code directly"""
    if not UNIMATRIX_API_KEY:
        # Fallback: return code directly (development mode)
        logger.warning(f"No Unimatrix credentials configured. OTP for {phone}: {otp_code}")
        return {"message_id": "dev-mode", "status": "DEV_MODE", "otp_code": otp_code}
    
    # Ensure phone format (E.164)
    if not phone.startswith('+'):
        phone = '+' + phone
    
    url = "https://api.unimtx.com/"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    payload = {
        "to": phone,
        "code": otp_code,
        "digits": 6,
        "channel": "sms",
        "ttl": OTP_EXPIRY_MINUTES * 60,
    }
    # Send from the registered Sender ID so carriers deliver the first message (not filter it).
    if UNIMATRIX_SIGNATURE:
        payload["signature"] = UNIMATRIX_SIGNATURE

    params = {"action": "otp.send", "accessKeyId": UNIMATRIX_API_KEY}
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            response = await http_client.post(url, json=payload, headers=headers, params=params)
        
        logger.info(f"Unimatrix response for {phone}: status={response.status_code}, body={response.text[:500]}")
        
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get("code") == "0":
                message_id = response_data.get("data", {}).get("id", "unimatrix-ok")
                logger.info(f"SMS OTP sent to {phone} via Unimatrix, messageId: {message_id}")
                return {"message_id": message_id, "status": "sent"}
            else:
                logger.warning(f"Unimatrix send failed: {response_data}. Returning code directly.")
                return {"message_id": "fallback", "status": "FALLBACK", "otp_code": otp_code}
        else:
            logger.warning(f"Unimatrix SMS failed ({response.status_code}) for {phone}: {response.text[:300]}. Returning code directly.")
            return {"message_id": "fallback", "status": "FALLBACK", "otp_code": otp_code}
    except Exception as e:
        logger.warning(f"SMS send failed for {phone}: {e}. Returning code directly.")
        return {"message_id": "fallback", "status": "FALLBACK", "otp_code": otp_code}


async def create_and_send_otp(phone: str, purpose: str) -> dict:
    """Create OTP, store in DB, and send via WhatsApp"""
    if not phone.startswith('+'):
        phone = '+' + phone
    
    # Rate limit check
    recent = await db.otp_codes.find_one(
        {"phone": phone, "purpose": purpose},
        sort=[("created_at", -1)]
    )
    if recent:
        last_sent = datetime.fromisoformat(recent["created_at"]) if isinstance(recent["created_at"], str) else recent["created_at"]
        if isinstance(last_sent, datetime) and last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last_sent).total_seconds()
        if elapsed < OTP_COOLDOWN_SECONDS:
            remaining = int(OTP_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(status_code=429, detail=f"Please wait {remaining} seconds before requesting a new code")
    
    # Generate and hash OTP
    otp_code = generate_otp()
    otp_hash_value = hash_otp(otp_code)
    
    # Invalidate old OTPs for same phone+purpose
    await db.otp_codes.update_many(
        {"phone": phone, "purpose": purpose, "status": "pending"},
        {"$set": {"status": "invalidated"}}
    )
    
    # Store new OTP
    otp_doc = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "purpose": purpose,
        "code_hash": otp_hash_value,
        "attempts": 0,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat(),
    }
    await db.otp_codes.insert_one(otp_doc)
    
    # Send via SMS (or fallback)
    result = await send_sms_otp(phone, otp_code)

    # Carrier first-message workaround: fire the SAME code a second time shortly after, in the
    # background, so a dropped first message doesn't leave the user without a code.
    if OTP_DOUBLE_SEND and result.get("status") not in ("DEV_MODE",):
        task = asyncio.create_task(_delayed_resend(phone, otp_code, OTP_RESEND_DELAY_SECONDS))
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)

    response = {"otp_id": otp_doc["id"], "message_status": result["status"], "expires_in": OTP_EXPIRY_MINUTES * 60}
    # SECURITY: never return the OTP code in the HTTP response outside development. Returning it
    # makes phone verification trivially bypassable. In production OTP_EXPOSE_CODE is always False,
    # so this stays server-side only (it is still logged in send_sms_otp for local debugging).
    if result.get("otp_code") and OTP_EXPOSE_CODE:
        response["otp_code"] = result["otp_code"]
    return response


async def verify_otp_code(phone: str, code: str, purpose: str) -> bool:
    """Verify OTP code for a phone number and purpose"""
    if not phone.startswith('+'):
        phone = '+' + phone
    
    otp_doc = await db.otp_codes.find_one(
        {"phone": phone, "purpose": purpose, "status": "pending"},
        sort=[("created_at", -1)]
    )
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="No pending verification found. Please request a new code.")
    
    # Check expiry
    expires_at = datetime.fromisoformat(otp_doc["expires_at"]) if isinstance(otp_doc["expires_at"], str) else otp_doc["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) >= expires_at:
        await db.otp_codes.update_one({"id": otp_doc["id"]}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
    
    # Check max attempts
    if otp_doc.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await db.otp_codes.update_one({"id": otp_doc["id"]}, {"$set": {"status": "blocked"}})
        raise HTTPException(status_code=400, detail="Too many failed attempts. Please request a new code.")
    
    # Increment attempts
    await db.otp_codes.update_one({"id": otp_doc["id"]}, {"$inc": {"attempts": 1}})
    
    # Verify hash
    if verify_otp_hash(code, otp_doc["code_hash"]):
        await db.otp_codes.update_one(
            {"id": otp_doc["id"]},
            {"$set": {"status": "verified", "verified_at": datetime.now(timezone.utc).isoformat()}}
        )
        return True
    
    return False


async def is_phone_recently_verified(phone: str, purpose: str, minutes: int = 30) -> bool:
    """Check if a phone was verified recently"""
    if not phone.startswith('+'):
        phone = '+' + phone
    
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
    doc = await db.otp_codes.find_one({
        "phone": phone,
        "purpose": purpose,
        "status": "verified",
        "verified_at": {"$gte": cutoff}
    })
    return doc is not None
