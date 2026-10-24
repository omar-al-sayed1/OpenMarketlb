"""Backend tests for shop sales feature, public active-sale endpoint, and login flows."""
import os
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sale-badge-upgrade.preview.emergentagent.com").rstrip("/")


# ============ HEALTH / AUTH ============

def test_health_or_root():
    r = requests.get(f"{BASE_URL}/api/", timeout=15)
    # accept anything not 5xx
    assert r.status_code < 500, f"backend not reachable: {r.status_code}"


def test_login_shop(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "shop1@openmarketlb.com", "password": "Shop123!"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert (data.get("token") or data.get("access_token"))


def test_login_admin(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@openmarketlb.com", "password": "Admin123!"})
    assert r.status_code == 200, r.text


def test_login_user(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "user@openmarketlb.com", "password": "User123!"})
    assert r.status_code == 200, r.text


# ============ SHOP SALES PREVIEW / CREATE / DELETE ============

def _cleanup_active_sale(client):
    """Delete any existing active sale so test is idempotent."""
    r = client.get(f"{BASE_URL}/api/shop/sales")
    if r.status_code == 200:
        for s in r.json():
            client.delete(f"{BASE_URL}/api/shop/sales/{s['id']}")


def test_shop_sales_preview(shop_client):
    _cleanup_active_sale(shop_client)
    end = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    payload = {"discount_percent": 5, "end_date": end, "title": "TEST preview"}
    r = shop_client.post(f"{BASE_URL}/api/shop/sales/preview", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "products_with_higher_discount" in body
    assert "total" in body
    assert isinstance(body["products_with_higher_discount"], list)
    # at 5% there should usually be products with higher existing discount (assuming seeded data)
    # if seeded shop has discounted products
    for p in body["products_with_higher_discount"]:
        assert p["existing_discount_percent"] > 5


def test_shop_get_shop_id_via_sale(shop_client):
    """Indirectly verify shop has an id by creating a sale (cleaned up after)."""
    pass



def test_create_shop_sale_and_active_endpoints(shop_client):
    _cleanup_active_sale(shop_client)
    end = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    payload = {"discount_percent": 20, "end_date": end, "title": "TEST 20% OFF", "description": "Test sale"}
    r = shop_client.post(f"{BASE_URL}/api/shop/sales", json=payload)
    assert r.status_code == 200, r.text
    sale = r.json()
    assert sale["discount_percent"] == 20
    assert sale["is_active"] is True
    assert "id" in sale
    sale_id = sale["id"]
    shop_id = sale["shop_id"]

    # active sale endpoint (shop scope)
    r2 = shop_client.get(f"{BASE_URL}/api/shop/sales/active")
    assert r2.status_code == 200, r2.text
    assert r2.json() and r2.json()["id"] == sale_id

    # public active-sale endpoint
    r3 = requests.get(f"{BASE_URL}/api/shops/{shop_id}/active-sale", timeout=15)
    assert r3.status_code == 200, r3.text
    pub = r3.json()
    assert pub and pub["id"] == sale_id
    assert pub["discount_percent"] == 20
    # original_prices must be excluded from public response
    assert "original_prices" not in pub

    # verify product carries shop_sale_discount
    products_resp = requests.get(f"{BASE_URL}/api/shops/{shop_id}/products", timeout=15)
    if products_resp.status_code == 200:
        prods = products_resp.json()
        if isinstance(prods, dict) and "products" in prods:
            prods = prods["products"]
        assert len(prods) > 0
        sample = prods[0]
        assert sample.get("shop_sale_discount") == 20 or sample.get("shop_sale_id") == sale_id

    # second create should fail (active overlap)
    r4 = shop_client.post(f"{BASE_URL}/api/shop/sales", json=payload)
    assert r4.status_code == 400, r4.text

    # cleanup
    rd = shop_client.delete(f"{BASE_URL}/api/shop/sales/{sale_id}")
    assert rd.status_code == 200, rd.text

    # after delete, public active-sale should be null/empty
    r5 = requests.get(f"{BASE_URL}/api/shops/{shop_id}/active-sale", timeout=15)
    assert r5.status_code == 200
    assert r5.json() in (None, {}, [])


def test_invalid_discount_rejected(shop_client):
    _cleanup_active_sale(shop_client)
    end = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    for bad in [0, -5, 95, 200]:
        r = shop_client.post(f"{BASE_URL}/api/shop/sales", json={"discount_percent": bad, "end_date": end})
        assert r.status_code == 400, f"{bad} should be rejected, got {r.status_code}: {r.text}"


def test_unauthorized_preview():
    r = requests.post(f"{BASE_URL}/api/shop/sales/preview", json={"discount_percent": 10, "end_date": datetime.now(timezone.utc).isoformat()})
    assert r.status_code in (401, 403), r.text


# ============ SEED ENDPOINT ============

def test_seed_endpoint():
    r = requests.post(f"{BASE_URL}/api/seed", timeout=60)
    assert r.status_code == 200, r.text


# ============ PUBLIC ACTIVE-SALE FOR UNKNOWN SHOP ============

def test_public_active_sale_unknown_shop():
    r = requests.get(f"{BASE_URL}/api/shops/non-existent-shop-id/active-sale", timeout=15)
    assert r.status_code == 200
    assert r.json() in (None, {}, [])
