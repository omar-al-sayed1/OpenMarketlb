"""
Authentication middleware: token creation/verification, role-based access control.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from typing import Optional, Dict, List
from datetime import datetime, timezone, timedelta
import jwt

from config import JWT_SECRET, JWT_ALGORITHM, security


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[Dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict]:
    if not credentials:
        return None
    payload = verify_token(credentials.credentials)
    return payload


async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


async def require_admin(user: Dict = Depends(require_auth)) -> Dict:
    """Allow admin OR employee. Employees inherit most admin privileges; sensitive actions
    use `require_admin_strict`.
    """
    if user.get("role") not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_admin_strict(user: Dict = Depends(require_auth)) -> Dict:
    """Strictly admins only - used for employee/agent management, platform settings, etc."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_employee(user: Dict = Depends(require_auth)) -> Dict:
    """Internal staff (formerly 'agent')."""
    if user.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Employee access required")
    return user


async def require_agent(user: Dict = Depends(require_auth)) -> Dict:
    """Referral agent (new entity)."""
    if user.get("role") != "agent":
        raise HTTPException(status_code=403, detail="Agent access required")
    return user


async def require_shop(user: Dict = Depends(require_auth)) -> Dict:
    if user.get("role") != "shop":
        raise HTTPException(status_code=403, detail="Shop access required")
    return user


async def require_delivery(user: Dict = Depends(require_auth)) -> Dict:
    if user.get("role") != "delivery":
        raise HTTPException(status_code=403, detail="Delivery access required")
    return user


async def require_shop_or_admin(user: Dict = Depends(require_auth)) -> Dict:
    if user.get("role") not in ["shop", "admin", "employee"]:
        raise HTTPException(status_code=403, detail="Shop or Admin access required")
    return user


def is_employee(user: Dict) -> bool:
    return bool(user) and user.get("role") == "employee"


# Backward-compat alias used in older code paths (will be deprecated)
def is_agent(user: Dict) -> bool:
    """DEPRECATED: returns True for the legacy internal staff role.
    Use `is_employee` going forward.
    """
    return is_employee(user)


# Default allowed pages for new employees (internal staff)
DEFAULT_EMPLOYEE_PAGES = [
    "dashboard",
    "shops",
    "map",
    "products",
    "orders",
    "cancel_requests",
    "shops_verifications",
    "shop_sales",
    "categories",
    "users",
    "contact_form",
    "promotions",
    "gallery",
]

# Backward-compat alias
DEFAULT_AGENT_PAGES = DEFAULT_EMPLOYEE_PAGES
