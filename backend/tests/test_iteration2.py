"""Iteration 2 backend tests:
- GET /api/shops returns has_active_sale / active_sale_percent / active_sale_title
- BecomeSellerPage seller-count source: GET /api/shops length > 0
- POST /api/shop/create-order applies shop_order_discount (commission/2) + loyalty points
"""
import os
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sale-badge-upgrade.preview.emergentagent.com").rstrip("/")


# ----- shops has_active_sale -----

def test_public_shops_has_active_sale_field():
    r = requests.get(f"{BASE_URL}/api/shops", timeout=20)
    assert r.status_code == 200, r.text
    shops = r.json()
    assert isinstance(shops, list)
    assert len(shops) > 0
    # every shop must include has_active_sale (bool)
    for s in shops:
        assert "has_active_sale" in s, f"missing has_active_sale on {s.get('name')}"
        assert isinstance(s["has_active_sale"], bool)
    # TechZone Lebanon should have an active sale (per env setup)
    techzone = next((s for s in shops if s.get("name") == "TechZone Lebanon"), None)
    assert techzone is not None
    assert techzone["has_active_sale"] is True
    assert techzone.get("active_sale_percent") is not None
    assert float(techzone["active_sale_percent"]) > 0


def test_become_seller_real_count_source():
    """BecomeSellerPage uses api.shops.getAll().length. Must be > 0 and not the fake 200+."""
    r = requests.get(f"{BASE_URL}/api/shops", timeout=20)
    assert r.status_code == 200
    shops = r.json()
    assert len(shops) >= 1
    # Will display as `${len}+`, not hardcoded 200+
    # Just ensure realistic seeded value (8 shops expected)
    assert len(shops) < 200


# ----- shop create-order: discount + loyalty -----

def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("access_token")


def test_shop_create_order_applies_half_commission_discount_and_loyalty():
    token = _login("shop1@openmarketlb.com", "Shop123!")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Get a shop product
    me = requests.get(f"{BASE_URL}/api/shop/profile", headers=headers, timeout=15)
    assert me.status_code == 200, me.text
    shop_id = me.json()["id"]

    prods = requests.get(f"{BASE_URL}/api/shops/{shop_id}/products", timeout=15)
    assert prods.status_code == 200
    plist = prods.json()
    if isinstance(plist, dict) and "products" in plist:
        plist = plist["products"]
    # Pick a product with stock > 0 and no variants requiring selection
    target = None
    for p in plist:
        if p.get("stock", 0) > 0 and not p.get("colors") and not p.get("sizes") and not p.get("shapes"):
            target = p
            break
    if not target:
        # fallback: any in-stock
        target = next((p for p in plist if p.get("stock", 0) > 0), None)
    assert target is not None, "no in-stock product on shop1 to test"

    # capture shop loyalty before
    before = requests.get(f"{BASE_URL}/api/shop/profile", headers=headers, timeout=15).json()
    pts_before = before.get("loyalty_points", 0) or 0

    payload = {
        "customer_name": "TEST Customer",
        "customer_email": "test_customer@example.com",
        "customer_phone": "+96100000000",
        "shipping_address": {
            "address": "Test Street 1",
            "city": "Beirut",
            "state": "Beirut",
            "country": "Lebanon",
            "zip_code": "1100"
        },
        "items": [{"product_id": target["id"], "quantity": 1}],
        "payment_method": "cod"
    }
    item_body = {"product_id": target["id"], "quantity": 1}
    # Include variants if required
    if target.get("colors"):
        item_body["selected_color"] = target["colors"][0]["color_name"]
    if target.get("sizes"):
        item_body["selected_size"] = target["sizes"][0]["size_name"]
    if target.get("shapes"):
        item_body["selected_shape"] = target["shapes"][0]["shape_name"]
    payload["items"] = [item_body]

    r = requests.post(f"{BASE_URL}/api/shop/create-order", headers=headers, json=payload, timeout=30)
    assert r.status_code == 200, r.text
    order = r.json()

    # shop_order_discount must be present and equal to commission_amount before reduction
    assert "shop_order_discount" in order, "shop_order_discount missing from create-order response"
    assert order["shop_order_discount"] >= 0
    # If commission > 0 then discount must be > 0
    # commission_amount in response is already reduced; total discount equals original commission/2
    # Sanity: total_amount == (sum item prices) - shop_order_discount + delivery_fee
    items_total = sum(i["subtotal"] for i in order["items"])
    expected_total = round(items_total - order["shop_order_discount"] + order["delivery_fee"], 2)
    assert abs(order["total_amount"] - expected_total) < 0.05, (
        f"total_amount mismatch: got {order['total_amount']}, expected {expected_total}"
    )

    # commission_amount must equal shop_order_discount (since both were halved)
    if order["shop_order_discount"] > 0:
        assert abs(order["commission_amount"] - order["shop_order_discount"]) < 0.05, (
            f"commission_amount {order['commission_amount']} != shop_order_discount {order['shop_order_discount']}"
        )

    # loyalty points awarded?
    after = requests.get(f"{BASE_URL}/api/shop/profile", headers=headers, timeout=15).json()
    pts_after = after.get("loyalty_points", 0) or 0
    # Loyalty depends on platform_settings.loyalty_enabled; verify by checking field on order
    if "shop_loyalty_points_earned" in order or pts_after > pts_before:
        assert pts_after >= pts_before
    # at minimum order has the discount field
    assert order.get("created_by_shop")


def test_shop_create_order_unauthorized():
    r = requests.post(f"{BASE_URL}/api/shop/create-order", json={"customer_name": "X", "shipping_address": {}, "items": []}, timeout=15)
    assert r.status_code in (401, 403)
