"""Iteration 4: Verify seeded data + home banners + categories/products/shops."""
import os
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://seed-data-ui.preview.emergentagent.com').rstrip('/')


def test_home_banners_count_and_titles():
    r = requests.get(f"{BASE_URL}/api/home-banners", timeout=20)
    assert r.status_code == 200, r.text
    banners = r.json()
    assert isinstance(banners, list)
    titles = [b.get('title') for b in banners]
    expected = {"Next-Gen Tech, Delivered", "Fashion That Speaks", "Make Your Home Glow"}
    missing = expected - set(titles)
    assert not missing, f"Missing banners: {missing}; got {titles}"
    # Ensure at least 3 active banners
    assert len(banners) >= 3, f"Expected >=3 banners got {len(banners)}: {titles}"
    # 3rd banner (Make Your Home Glow) should have empty/absent image
    glow = next(b for b in banners if b.get('title') == 'Make Your Home Glow')
    assert not glow.get('image_url'), f"Glow banner should not have image_url: {glow.get('image_url')}"


def test_products_active_count():
    r = requests.get(f"{BASE_URL}/api/products", params={"is_active": "true", "limit": 200}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    products = data if isinstance(data, list) else data.get('products', data.get('items', []))
    assert len(products) >= 40, f"Expected ~48 products, got {len(products)}"


def test_shops_approved_count():
    r = requests.get(f"{BASE_URL}/api/shops", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    shops = data if isinstance(data, list) else data.get('shops', data.get('items', []))
    assert len(shops) >= 8, f"Expected 8 shops, got {len(shops)}"


def test_categories_tree():
    r = requests.get(f"{BASE_URL}/api/categories/tree", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    cats = data if isinstance(data, list) else data.get('categories', data.get('items', []))
    assert len(cats) >= 8, f"Expected 8 top-level categories, got {len(cats)}"
    # each should have children/subcategories
    with_children = [c for c in cats if (c.get('children') or c.get('subcategories'))]
    assert len(with_children) >= 6, f"Most top-level categories should have subcategories, got {len(with_children)}"
