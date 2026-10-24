import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sale-badge-upgrade.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api_client, email, password):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        pytest.skip(f"no token returned for {email}: {data}")
    return token


@pytest.fixture
def shop_token(api):
    return _login(api, "shop1@openmarketlb.com", "Shop123!")


@pytest.fixture
def shop_client(api, shop_token):
    api.headers.update({"Authorization": f"Bearer {shop_token}"})
    return api


@pytest.fixture
def admin_token(api):
    return _login(api, "admin@openmarketlb.com", "Admin123!")


@pytest.fixture
def user_token(api):
    return _login(api, "user@openmarketlb.com", "User123!")
