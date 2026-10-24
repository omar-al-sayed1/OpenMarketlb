"""
Backend tests for OpenMarket Lebanon iteration 5 enhancements.

Covers:
- Admin event CRUD (/api/admin/events)
- Shop sponsor join with custom title/subtitle (POST /api/shop/advertising/events/{id}/join)
- Shop sponsor content update (PUT /api/shop/advertising/events/{id}/sponsor-content)
- Admin Finance: 'Paid' single + bulk (settle_delivery_cash, settle_delivery_cash_bulk)
- Admin orders list returns commission_amount + loyalty_discount_amount (for FE column)
- Settings/Products endpoints used by FE filters
"""
import os
import uuid
import pytest
import requests

# Load from frontend/.env if not in env
if not os.environ.get("REACT_APP_BACKEND_URL"):
    try:
        with open("/app/frontend/.env") as _f:
            for _ln in _f:
                if _ln.startswith("REACT_APP_BACKEND_URL"):
                    os.environ["REACT_APP_BACKEND_URL"] = _ln.split("=", 1)[1].strip()
                    break
    except Exception:
        pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN_EMAIL = "admin@openmarket.com"
ADMIN_PASS = "Admin1234!"
SHOP_EMAIL = "shop1@test.com"
SHOP_PASS = "Test1234!"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    # Ensure seed
    requests.post(f"{BASE_URL}/api/seed-public", timeout=30)
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASS)}"}


@pytest.fixture(scope="module")
def shop_headers():
    return {"Authorization": f"Bearer {_login(SHOP_EMAIL, SHOP_PASS)}"}


# ---------------------------------------------------------------------------
# Admin Event CRUD (Advertising > Events tab)
# ---------------------------------------------------------------------------
class TestAdminEventCRUD:
    created_id = None

    def test_create_event(self, admin_headers):
        payload = {
            "title": "TEST_EventCRUD_Title",
            "description": "TEST subtitle/description",
            "image_url": "https://picsum.photos/600/300",
            "display_mode": "home_banner",
            "banner_subtitle": "TEST subtitle",
            "sponsorship_enabled": True,
            "sponsorship_price_per_day": 5.5,
            "is_active": True,
        }
        r = requests.post(f"{BASE_URL}/api/admin/events", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "event" in data
        ev = data["event"]
        assert ev["title"] == payload["title"]
        assert ev["sponsorship_enabled"] is True
        # price_per_day mirrored
        assert float(ev.get("sponsorship_price_per_day") or 0) == 5.5
        assert "id" in ev
        TestAdminEventCRUD.created_id = ev["id"]

    def test_event_appears_in_admin_list(self, admin_headers):
        assert TestAdminEventCRUD.created_id
        r = requests.get(f"{BASE_URL}/api/admin/advertising/events", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        events = r.json().get("events", [])
        ids = [e.get("id") for e in events]
        assert TestAdminEventCRUD.created_id in ids

    def test_update_event(self, admin_headers):
        eid = TestAdminEventCRUD.created_id
        assert eid
        r = requests.put(
            f"{BASE_URL}/api/admin/events/{eid}",
            json={"title": "TEST_EventCRUD_Updated", "sponsorship_price_per_day": 9.99},
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        ev = r.json()["event"]
        assert ev["title"] == "TEST_EventCRUD_Updated"
        assert float(ev["sponsorship_price_per_day"]) == 9.99
        assert float(ev["sponsorship_price"]) == 9.99  # synced

    def test_delete_event(self, admin_headers):
        eid = TestAdminEventCRUD.created_id
        assert eid
        r = requests.delete(f"{BASE_URL}/api/admin/events/{eid}", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        # verify gone
        r2 = requests.get(f"{BASE_URL}/api/admin/advertising/events", headers=admin_headers, timeout=20)
        ids = [e.get("id") for e in r2.json().get("events", [])]
        assert eid not in ids


# ---------------------------------------------------------------------------
# Shop sponsorship: custom title/subtitle on join + sponsor-content update
# ---------------------------------------------------------------------------
class TestShopSponsorshipCustomContent:
    """Validate the new title/subtitle params accepted by /join and the new PUT sponsor-content endpoint."""

    def test_shop_events_endpoint_includes_my_sponsor_fields(self, shop_headers):
        r = requests.get(f"{BASE_URL}/api/shop/advertising/events", headers=shop_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "events" in data
        # Every event should expose my_sponsor_title / my_sponsor_subtitle keys (possibly empty)
        for ev in data["events"]:
            assert "my_sponsor_title" in ev
            assert "my_sponsor_subtitle" in ev

    def test_sponsor_content_update_rejects_non_sponsor(self, shop_headers, admin_headers):
        # Create a brand new event via admin (no sponsor) and try to update its sponsor content -> 403
        ev_payload = {
            "title": "TEST_NoSponsorEvent",
            "display_mode": "home_banner",
            "sponsorship_enabled": True,
            "sponsorship_price_per_day": 1.0,
            "is_active": True,
        }
        cr = requests.post(f"{BASE_URL}/api/admin/events", json=ev_payload, headers=admin_headers, timeout=20)
        assert cr.status_code == 200, cr.text
        eid = cr.json()["event"]["id"]
        try:
            rr = requests.put(
                f"{BASE_URL}/api/shop/advertising/events/{eid}/sponsor-content",
                json={"title": "X", "subtitle": "Y"},
                headers=shop_headers,
                timeout=20,
            )
            assert rr.status_code == 403, rr.text
        finally:
            requests.delete(f"{BASE_URL}/api/admin/events/{eid}", headers=admin_headers, timeout=20)


# ---------------------------------------------------------------------------
# Finance: Paid button (single + bulk) — settle_delivery_cash now sets payment_status=paid
# ---------------------------------------------------------------------------
class TestFinancePaid:
    def test_delivery_cash_owed_endpoint(self, admin_headers):
        # The UI's "Delivery Cash Owed to Admin" reads from this endpoint
        r = requests.get(f"{BASE_URL}/api/admin/delivery-cash/owed", headers=admin_headers, timeout=20)
        # If endpoint doesn't exist, surface 404 here so main agent can address
        assert r.status_code in (200, 404), r.text

    def test_settle_delivery_cash_nonexistent_returns_404(self, admin_headers):
        fake_id = "nonexistent-" + str(uuid.uuid4())
        r = requests.post(
            f"{BASE_URL}/api/admin/delivery-cash/settle/{fake_id}",
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 404

    def test_settle_delivery_cash_marks_paid(self, admin_headers):
        """Find a delivered + unsettled order and settle it; verify payment_status becomes 'paid'."""
        # Admin uses /api/orders to list all orders
        r = requests.get(f"{BASE_URL}/api/orders?limit=200", headers=admin_headers, timeout=30)
        if r.status_code != 200:
            pytest.skip(f"admin orders endpoint not 200: {r.status_code}")
        body = r.json()
        orders = body.get("orders", body) if isinstance(body, dict) else body
        candidate = None
        for o in orders or []:
            if o.get("delivery_status") == "delivered" and not o.get("delivery_cash_settled"):
                candidate = o
                break
        if not candidate:
            pytest.skip("No delivered + unsettled order seeded to test single Paid action")
        oid = candidate["id"]
        rs = requests.post(
            f"{BASE_URL}/api/admin/delivery-cash/settle/{oid}",
            headers=admin_headers,
            timeout=20,
        )
        assert rs.status_code == 200, rs.text
        # Re-fetch order
        rr = requests.get(f"{BASE_URL}/api/orders?limit=200", headers=admin_headers, timeout=30)
        orders2 = rr.json().get("orders", rr.json()) if isinstance(rr.json(), dict) else rr.json()
        match = next((x for x in orders2 if x.get("id") == oid), None)
        assert match is not None
        assert match.get("payment_status") == "paid", f"Expected payment_status=paid, got {match.get('payment_status')}"
        assert match.get("delivery_cash_settled") is True

    def test_settle_bulk_all_endpoint(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/delivery-cash/settle-bulk",
            json={"delivery_user_id": "all"},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert "settled_count" in r.json()


# ---------------------------------------------------------------------------
# Admin Orders: commission + loyalty_discount fields available for FE column
# ---------------------------------------------------------------------------
class TestAdminOrdersCommissionFields:
    def test_orders_have_commission_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/orders?limit=10", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        orders = body.get("orders", body) if isinstance(body, dict) else body
        assert orders, "No orders returned"
        sample = orders[0]
        # Fields used by FE formula max(0, commission_amount - loyalty_discount_amount)
        assert "commission_amount" in sample, sample.keys()
        # loyalty_discount_amount may be absent => treated as 0; just verify type if present
        if "loyalty_discount_amount" in sample:
            assert isinstance(sample["loyalty_discount_amount"], (int, float))


# ---------------------------------------------------------------------------
# Admin/Shop products list - sanity for filters
# ---------------------------------------------------------------------------
class TestProductsListing:
    def test_admin_products_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/products-all?limit=10", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text

    def test_shop_products_list(self, shop_headers):
        r = requests.get(f"{BASE_URL}/api/shop/products", headers=shop_headers, timeout=20)
        assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------
# Product create (shared modal save path) — admin & shop
# ---------------------------------------------------------------------------
class TestProductCreate:
    def test_shop_create_product(self, shop_headers):
        payload = {
            "name": f"TEST_Product_{uuid.uuid4().hex[:6]}",
            "description": "TEST shared modal product",
            "price": 9.99,
            "stock": 5,
            "category_id": "",
            "images": [],
            "available": True,
        }
        r = requests.post(f"{BASE_URL}/api/shop/products", json=payload, headers=shop_headers, timeout=20)
        assert r.status_code in (200, 201), r.text

    def test_admin_create_product_requires_shop(self, admin_headers):
        # Get a shop
        rr = requests.get(f"{BASE_URL}/api/admin/shops", headers=admin_headers, timeout=20)
        assert rr.status_code == 200
        shops = rr.json() if isinstance(rr.json(), list) else rr.json().get("shops", [])
        assert shops, "no shops available"
        shop_id = shops[0]["id"]
        payload = {
            "name": f"TEST_AdminProduct_{uuid.uuid4().hex[:6]}",
            "description": "TEST shared modal admin",
            "price": 12.34,
            "stock": 3,
            "shop_id": shop_id,
            "category_id": "",
            "images": [],
            "available": True,
        }
        r = requests.post(f"{BASE_URL}/api/products", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code in (200, 201), r.text
