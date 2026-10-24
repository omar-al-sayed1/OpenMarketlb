"""
OpenMarket Lebanon - Modular Server Entry Point
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import asyncio
import json
from datetime import datetime, timezone

from config import db, client, logger, UPLOADS_DIR
from auth import verify_token

app = FastAPI(title="OpenMarket Lebanon API", version="2.0")

# Import routers
from routers.auth_routes import router as auth_router
from routers.products_routes import router as product_router
from routers.orders_routes import router as order_router
from routers.shop_routes import router as shop_router
from routers.admin_routes import router as admin_router
from routers.delivery_routes import router as delivery_router
from routers.public_routes import router as public_router
from routers.seed_routes import router as seed_router
from routers.advertising_routes import router as advertising_router
from routers.google_auth_routes import router as google_auth_router
from routers.referral_routes import router as referral_router

# Include all routers with /api prefix
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(google_auth_router, prefix="/api", tags=["google_auth"])
app.include_router(product_router, prefix="/api", tags=["products"])
app.include_router(order_router, prefix="/api", tags=["orders"])
app.include_router(shop_router, prefix="/api", tags=["shop"])
app.include_router(admin_router, prefix="/api", tags=["admin"])
app.include_router(delivery_router, prefix="/api", tags=["delivery"])
app.include_router(public_router, prefix="/api", tags=["public"])
app.include_router(seed_router, prefix="/api", tags=["seed"])
app.include_router(advertising_router, prefix="/api", tags=["advertising"])
app.include_router(referral_router, prefix="/api", tags=["referral"])

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "OpenMarketlb API", "architecture": "modular"}

# Static files
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup/shutdown events
@app.on_event("startup")
async def startup_tasks():
    """Run startup migrations and periodic tasks"""
    await asyncio.sleep(2)
    from services.helpers import run_seller_model_migration, check_and_run_monthly_credit, check_and_run_auto_renewals, periodic_auto_renewal_check, check_and_send_renewal_reminders, periodic_renewal_reminder_check
    await run_seller_model_migration()
    await check_and_run_monthly_credit()
    await check_and_run_auto_renewals()
    await check_and_send_renewal_reminders()
    asyncio.create_task(periodic_auto_renewal_check())
    asyncio.create_task(periodic_renewal_reminder_check())
    asyncio.create_task(periodic_sale_expiry_check())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ============ PERIODIC SHOP SALE EXPIRY ============
async def periodic_sale_expiry_check():
    """Check and expire shop sales every 5 minutes"""
    while True:
        await asyncio.sleep(300)
        try:
            now = datetime.now(timezone.utc).isoformat()
            expired_sales = await db.shop_sales.find(
                {"is_active": True, "end_date": {"$lte": now}},
                {"_id": 0}
            ).to_list(100)
            for sale in expired_sales:
                original_prices = sale.get("original_prices", {})
                for pid, prices in original_prices.items():
                    restore_fields = {"discount_price": prices.get("discount_price")}
                    await db.products.update_one(
                        {"id": pid},
                        {"$set": restore_fields, "$unset": {"shop_sale_id": "", "shop_sale_discount": "", "shop_sale_title": ""}}
                    )
                await db.shop_sales.update_one(
                    {"id": sale["id"]}, {"$set": {"is_active": False}}
                )
                logger.info(f"Expired shop sale {sale['id']} for shop {sale.get('shop_name')}")
        except Exception as e:
            logger.error(f"Sale expiry check error: {e}")


# ============ WEBSOCKET: DELIVERY TRACKING ============
class TrackingConnectionManager:
    def __init__(self):
        self.active_connections = {}  # order_id -> list of websockets

    async def connect(self, websocket: WebSocket, order_id: str):
        await websocket.accept()
        if order_id not in self.active_connections:
            self.active_connections[order_id] = []
        self.active_connections[order_id].append(websocket)

    def disconnect(self, websocket: WebSocket, order_id: str):
        if order_id in self.active_connections:
            self.active_connections[order_id] = [
                ws for ws in self.active_connections[order_id] if ws != websocket
            ]
            if not self.active_connections[order_id]:
                del self.active_connections[order_id]

    async def broadcast(self, order_id: str, message: dict):
        if order_id in self.active_connections:
            dead = []
            for ws in self.active_connections[order_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(ws, order_id)

tracking_manager = TrackingConnectionManager()


def _can_write_tracking(user: dict, order: dict) -> bool:
    """Only the admin/employee or the delivery driver actually assigned to THIS order may push
    location/status updates. Everyone else (including anonymous viewers) is read-only."""
    if not user or not order:
        return False
    role = user.get("role")
    if role in ("admin", "employee"):
        return True
    return role == "delivery" and order.get("delivery_user_id") == user.get("user_id")


@app.websocket("/ws/tracking/{order_id}")
async def tracking_websocket(websocket: WebSocket, order_id: str):
    await tracking_manager.connect(websocket, order_id)
    # A token may be supplied as ?token=... to authorize writes. Reads stay open so the customer
    # (including guests, who have no account) can still track their order via the order-id link.
    token = websocket.query_params.get("token")
    auth_user = verify_token(token) if token else None
    try:
        # Send current status immediately
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order:
            await websocket.send_json({
                "type": "status",
                "delivery_status": order.get("delivery_status", "pending"),
                "driver_location": order.get("driver_current_location"),
                "customer_location": order.get("customer_location"),
            })
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except (ValueError, TypeError):
                continue
            msg_type = msg.get("type")

            if msg_type in ("driver_location", "status_update"):
                # Writes require an authorized, assigned driver (or admin) — this prevents anyone
                # from spoofing a driver's GPS or delivery status for an arbitrary order.
                assigned = await db.orders.find_one({"id": order_id}, {"_id": 0, "delivery_user_id": 1})
                if not _can_write_tracking(auth_user, assigned):
                    await websocket.send_json({"type": "error", "error": "unauthorized"})
                    continue

            if msg_type == "driver_location":
                lat, lng = msg.get("lat"), msg.get("lng")
                if lat is None or lng is None:
                    continue
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {
                        "driver_current_location": {"lat": lat, "lng": lng},
                        "driver_location_updated": datetime.now(timezone.utc).isoformat()
                    }}
                )
                await tracking_manager.broadcast(order_id, {
                    "type": "location_update",
                    "lat": lat,
                    "lng": lng,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            elif msg_type == "status_update":
                await tracking_manager.broadcast(order_id, {
                    "type": "status",
                    "delivery_status": msg.get("status", "in_transit"),
                })
    except WebSocketDisconnect:
        tracking_manager.disconnect(websocket, order_id)
    except Exception:
        tracking_manager.disconnect(websocket, order_id)
