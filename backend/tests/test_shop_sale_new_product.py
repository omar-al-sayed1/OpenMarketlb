"""
Tests for the "apply shop sale discount to products added after a sale starts" feature.

Coverage:
- POST /api/shop/products on a shop with an active sale auto-applies shop_sale_* fields
  and updates the sale's original_prices map.
- POST /api/shop/products on a shop WITHOUT an active sale does not set shop_sale_* fields.
- POST /api/products (admin) assigning a product to a shop with an active sale also
  auto-applies the sale discount.
- DELETE /api/shop/sales/{sale_id} restores prices for products added after the sale started.

IMPORTANT: This test file does NOT modify or delete the seeded TechZone active sale.
For the deletion-restoration test, a temporary sale is created on Fashion Hub (shop2)
and cleaned up by the test itself.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://sale-badge-upgrade.preview.emergentagent.com",
).rstrip("/")


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"no token returned for {email}"
    return token


def _auth_headers(token: str) -> dict:
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def shop1_token():
    return _login("shop1@openmarketlb.com", "Shop123!")


@pytest.fixture(scope="module")
def shop2_token():
    return _login("shop2@openmarketlb.com", "Shop123!")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@openmarketlb.com", "Admin123!")


@pytest.fixture(scope="module")
def techzone_active_sale(shop1_token):
    """Ensure TechZone (shop1) has an active sale; create if missing. Do NOT delete after."""
    r = requests.get(f"{BASE_URL}/api/shop/sales/active", headers=_auth_headers(shop1_token), timeout=20)
    if r.status_code == 200 and r.json():
        return r.json()
    # No active sale: create one
    end_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    r = requests.post(
        f"{BASE_URL}/api/shop/sales",
        headers=_auth_headers(shop1_token),
        json={
            "discount_percent": 20,
            "end_date": end_date,
            "title": "Summer Sale 20% OFF",
            "description": "Auto re-created by test fixture",
        },
        timeout=20,
    )
    assert r.status_code == 200, f"failed to create sale: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def shop1_id(shop1_token):
    r = requests.get(f"{BASE_URL}/api/shop/profile", headers=_auth_headers(shop1_token), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def shop2_id(shop2_token):
    r = requests.get(f"{BASE_URL}/api/shop/profile", headers=_auth_headers(shop2_token), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _fetch_shop_product(shop_token: str, product_id: str) -> dict:
    """Pull raw product fields (price/discount_price/shop_sale_*) via shop endpoint (no commission)."""
    r = requests.get(f"{BASE_URL}/api/shop/products", headers=_auth_headers(shop_token), timeout=20)
    assert r.status_code == 200, r.text
    for p in r.json():
        if p["id"] == product_id:
            return p
    raise AssertionError(f"product {product_id} not found in shop products list")


def _delete_shop_product(shop_token: str, product_id: str):
    requests.delete(f"{BASE_URL}/api/shop/products/{product_id}", headers=_auth_headers(shop_token), timeout=20)


def _delete_admin_product(admin_token: str, product_id: str):
    requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=_auth_headers(admin_token), timeout=20)


def _product_payload(name_suffix: str, price: float = 100.0) -> dict:
    return {
        "name": f"TEST_SALE_PROD_{name_suffix}_{uuid.uuid4().hex[:6]}",
        "description": "Temporary test product for shop sale discount application",
        "price": price,
        "stock": 5,
        "images": [],
        "is_active": True,
    }


# ---------------------------------------------------------------------------
# 1) Shop with active sale: POST /api/shop/products applies discount
# ---------------------------------------------------------------------------
def test_shop1_new_product_gets_sale_discount(shop1_token, techzone_active_sale):
    sale_pct = techzone_active_sale["discount_percent"]
    sale_id = techzone_active_sale["id"]
    sale_title = techzone_active_sale.get("title", "")

    payload = _product_payload("shop1_active", price=100.0)
    r = requests.post(
        f"{BASE_URL}/api/shop/products",
        headers=_auth_headers(shop1_token),
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    created = r.json()
    pid = created["id"]

    try:
        # Verify via DB-backed shop endpoint
        prod = _fetch_shop_product(shop1_token, pid)
        expected_discount_price = round(100.0 * (1 - sale_pct / 100.0), 2)

        assert prod.get("shop_sale_id") == sale_id, f"shop_sale_id mismatch: {prod.get('shop_sale_id')} vs {sale_id}"
        assert prod.get("shop_sale_discount") == sale_pct, f"shop_sale_discount: {prod.get('shop_sale_discount')}"
        assert prod.get("shop_sale_title") == sale_title, f"shop_sale_title: {prod.get('shop_sale_title')}"
        assert prod.get("discount_price") == expected_discount_price, (
            f"discount_price expected {expected_discount_price}, got {prod.get('discount_price')}"
        )
        assert prod.get("price") == 100.0
    finally:
        _delete_shop_product(shop1_token, pid)


# ---------------------------------------------------------------------------
# 2) Sale.original_prices map updated to include new product
# ---------------------------------------------------------------------------
def test_active_sale_original_prices_updated_with_new_product(shop1_token, techzone_active_sale):
    sale_id = techzone_active_sale["id"]

    payload = _product_payload("shop1_origprices", price=250.0)
    r = requests.post(
        f"{BASE_URL}/api/shop/products",
        headers=_auth_headers(shop1_token),
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    pid = r.json()["id"]

    try:
        # Fetch all sales for this shop to inspect original_prices map
        r = requests.get(f"{BASE_URL}/api/shop/sales", headers=_auth_headers(shop1_token), timeout=20)
        assert r.status_code == 200, r.text
        sale = next((s for s in r.json() if s["id"] == sale_id), None)
        assert sale is not None, "active sale missing from /shop/sales listing"
        original_prices = sale.get("original_prices", {})
        assert pid in original_prices, (
            f"new product {pid} not found in sale.original_prices (keys: {list(original_prices.keys())[:5]}...)"
        )
        entry = original_prices[pid]
        assert entry.get("price") == 250.0, f"original_prices[{pid}].price = {entry.get('price')}"
    finally:
        _delete_shop_product(shop1_token, pid)


# ---------------------------------------------------------------------------
# 3) Admin POST /api/products assigning to shop with active sale -> discount applied
# ---------------------------------------------------------------------------
def test_admin_create_product_assigned_to_shop_with_active_sale(admin_token, shop1_token, shop1_id, techzone_active_sale):
    sale_pct = techzone_active_sale["discount_percent"]
    sale_id = techzone_active_sale["id"]

    payload = _product_payload("admin_shop1", price=150.0)
    payload["shop_id"] = shop1_id

    r = requests.post(
        f"{BASE_URL}/api/products",
        headers=_auth_headers(admin_token),
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    pid = r.json()["id"]

    try:
        prod = _fetch_shop_product(shop1_token, pid)
        expected_discount_price = round(150.0 * (1 - sale_pct / 100.0), 2)
        assert prod.get("shop_sale_id") == sale_id
        assert prod.get("shop_sale_discount") == sale_pct
        assert prod.get("discount_price") == expected_discount_price, (
            f"expected {expected_discount_price}, got {prod.get('discount_price')}"
        )
    finally:
        _delete_admin_product(admin_token, pid)


# ---------------------------------------------------------------------------
# 4) Shop with NO active sale: product does NOT get shop_sale_* fields
# ---------------------------------------------------------------------------
def test_shop2_no_active_sale_does_not_apply_discount(shop2_token):
    # Sanity: confirm shop2 has no active sale
    r = requests.get(f"{BASE_URL}/api/shop/sales/active", headers=_auth_headers(shop2_token), timeout=20)
    assert r.status_code == 200, r.text
    if r.json():
        pytest.skip("shop2 unexpectedly has an active sale; skipping no-sale test to avoid interference")

    payload = _product_payload("shop2_nosale", price=80.0)
    r = requests.post(
        f"{BASE_URL}/api/shop/products",
        headers=_auth_headers(shop2_token),
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    pid = r.json()["id"]

    try:
        prod = _fetch_shop_product(shop2_token, pid)
        assert not prod.get("shop_sale_id"), f"unexpected shop_sale_id: {prod.get('shop_sale_id')}"
        assert not prod.get("shop_sale_discount"), f"unexpected shop_sale_discount: {prod.get('shop_sale_discount')}"
        assert not prod.get("shop_sale_title"), f"unexpected shop_sale_title: {prod.get('shop_sale_title')}"
        # discount_price should be unchanged (None / original)
        assert prod.get("price") == 80.0
        assert prod.get("discount_price") in (None, 0, 0.0), f"unexpected discount_price: {prod.get('discount_price')}"
    finally:
        _delete_shop_product(shop2_token, pid)


# ---------------------------------------------------------------------------
# 5) Sale deletion restores prices of new (post-sale) products
#    Uses shop2 (Fashion Hub) with a TEMP sale to avoid touching seeded TechZone sale.
# ---------------------------------------------------------------------------
def test_sale_deletion_restores_new_product_prices(shop2_token):
    # Pre-check shop2 has no active sale (would block create)
    r = requests.get(f"{BASE_URL}/api/shop/sales/active", headers=_auth_headers(shop2_token), timeout=20)
    assert r.status_code == 200, r.text
    if r.json():
        pytest.skip("shop2 has an active sale; cannot create temp sale for deletion test")

    # 1. Create a temp sale on shop2
    end_date = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    r = requests.post(
        f"{BASE_URL}/api/shop/sales",
        headers=_auth_headers(shop2_token),
        json={
            "discount_percent": 25,
            "end_date": end_date,
            "title": "TEST_DELETE_SALE_25",
            "description": "temp",
        },
        timeout=20,
    )
    assert r.status_code == 200, r.text
    temp_sale = r.json()
    sale_id = temp_sale["id"]

    pid = None
    try:
        # 2. Create a new product AFTER the sale started
        payload = _product_payload("shop2_post_sale", price=200.0)
        r = requests.post(
            f"{BASE_URL}/api/shop/products",
            headers=_auth_headers(shop2_token),
            json=payload,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["id"]

        # 3. Verify discount applied
        prod_before = _fetch_shop_product(shop2_token, pid)
        assert prod_before.get("shop_sale_id") == sale_id
        assert prod_before.get("shop_sale_discount") == 25
        assert prod_before.get("discount_price") == 150.0  # 200 * 0.75

        # 4. Delete the sale
        r = requests.delete(
            f"{BASE_URL}/api/shop/sales/{sale_id}",
            headers=_auth_headers(shop2_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text

        # 5. Verify the new product is restored (discount_price back to original/None,
        #    shop_sale_* fields removed)
        prod_after = _fetch_shop_product(shop2_token, pid)
        assert not prod_after.get("shop_sale_id"), f"shop_sale_id should be unset, got {prod_after.get('shop_sale_id')}"
        assert not prod_after.get("shop_sale_discount"), f"shop_sale_discount should be unset"
        assert not prod_after.get("shop_sale_title"), f"shop_sale_title should be unset"
        # Original product had no discount_price -> restored to None/null
        assert prod_after.get("discount_price") in (None, 0, 0.0), (
            f"discount_price should restore to original (None), got {prod_after.get('discount_price')}"
        )
        assert prod_after.get("price") == 200.0
    finally:
        if pid:
            _delete_shop_product(shop2_token, pid)
        # Make sure no temp sale lingers
        try:
            requests.delete(
                f"{BASE_URL}/api/shop/sales/{sale_id}",
                headers=_auth_headers(shop2_token),
                timeout=10,
            )
        except Exception:
            pass
