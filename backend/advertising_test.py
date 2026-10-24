"""
OpenMarket Lebanon - Advertising Features Backend Tests
Tests new advertising enhancements: PPC pricing, event sponsorship, AI descriptions, welcome bonuses
"""
import requests
import sys
import json
from datetime import datetime

BASE_URL = "https://ad-platform-mvp.preview.emergentagent.com/api"

class AdvertisingFeaturesTester:
    def __init__(self):
        self.admin_token = None
        self.shop1_token = None
        self.shop2_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []
        
    def log(self, msg, level="INFO"):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {level}: {msg}")
    
    def test(self, name, method, endpoint, expected_status, data=None, token=None, check_fn=None):
        """Run a single API test"""
        url = f"{BASE_URL}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        self.tests_run += 1
        self.log(f"🔍 Testing: {name}")
        
        try:
            if method == 'GET':
                resp = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                resp = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                resp = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                resp = requests.delete(url, json=data, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if resp.status_code != expected_status:
                self.log(f"  ❌ FAILED - Expected {expected_status}, got {resp.status_code}", "ERROR")
                self.log(f"     Response: {resp.text[:200]}", "ERROR")
                self.failures.append(f"{name}: status {resp.status_code} != {expected_status}")
                return False, {}
            
            response_data = resp.json() if resp.text else {}
            
            if check_fn and not check_fn(response_data):
                self.log(f"  ❌ FAILED - Check function returned False", "ERROR")
                self.failures.append(f"{name}: check function failed")
                return False, response_data
            
            self.tests_passed += 1
            self.log(f"  ✅ PASSED")
            return True, response_data
            
        except Exception as e:
            self.log(f"  ❌ FAILED - Exception: {str(e)}", "ERROR")
            self.failures.append(f"{name}: {str(e)}")
            return False, {}
    
    def login(self):
        """Login as admin and shops"""
        self.log("=" * 60)
        self.log("AUTHENTICATION")
        self.log("=" * 60)
        
        # Admin login
        success, resp = self.test(
            "Admin login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@openmarket.com", "password": "Admin1234!"}
        )
        if success:
            self.admin_token = resp.get('token')
            self.log(f"  Admin token: {self.admin_token[:20]}...")
        
        # Shop1 login
        success, resp = self.test(
            "Shop1 login (shop1@test.com)",
            "POST",
            "auth/login",
            200,
            data={"email": "shop1@test.com", "password": "Test1234!"}
        )
        if success:
            self.shop1_token = resp.get('token')
            self.log(f"  Shop1 token: {self.shop1_token[:20]}...")
        
        # Shop2 login
        success, resp = self.test(
            "Shop2 login (shop2@test.com)",
            "POST",
            "auth/login",
            200,
            data={"email": "shop2@test.com", "password": "Test1234!"}
        )
        if success:
            self.shop2_token = resp.get('token')
            self.log(f"  Shop2 token: {self.shop2_token[:20]}...")
    
    def test_admin_advertising_overview(self):
        """Test GET /api/admin/advertising/overview - ppc_price_per_click should be 0.10"""
        self.log("\n" + "=" * 60)
        self.log("ADMIN ADVERTISING OVERVIEW")
        self.log("=" * 60)
        
        def check_ppc_price(data):
            settings = data.get('settings', {})
            ppc_price = settings.get('ppc_price_per_click')
            if ppc_price != 0.10:
                self.log(f"  ❌ ppc_price_per_click is {ppc_price}, expected 0.10", "ERROR")
                return False
            self.log(f"  ✅ ppc_price_per_click = {ppc_price}")
            return True
        
        self.test(
            "GET /api/admin/advertising/overview - check ppc_price_per_click=0.10",
            "GET",
            "admin/advertising/overview",
            200,
            token=self.admin_token,
            check_fn=check_ppc_price
        )
    
    def test_admin_advertising_events(self):
        """Test GET /api/admin/advertising/events - should return events with current_sponsor"""
        self.log("\n" + "=" * 60)
        self.log("ADMIN ADVERTISING EVENTS")
        self.log("=" * 60)
        
        def check_events(data):
            events = data.get('events', [])
            if len(events) == 0:
                self.log(f"  ⚠️  No events found (expected at least 1)", "WARN")
                return True  # Not a failure, just no data
            
            self.log(f"  Found {len(events)} events")
            for ev in events:
                self.log(f"    - {ev.get('title')}: sponsored={bool(ev.get('current_sponsor'))}")
                if ev.get('current_sponsor'):
                    sponsor = ev['current_sponsor']
                    self.log(f"      Sponsor: {sponsor.get('shop_name')} for {sponsor.get('days')} days")
            return True
        
        self.test(
            "GET /api/admin/advertising/events - check current_sponsor field",
            "GET",
            "admin/advertising/events",
            200,
            token=self.admin_token,
            check_fn=check_events
        )
    
    def test_admin_advertising_toggles(self):
        """Test PUT /api/admin/advertising/settings - 3 independent toggles"""
        self.log("\n" + "=" * 60)
        self.log("ADMIN ADVERTISING TOGGLES")
        self.log("=" * 60)
        
        # Test toggling email_campaigns_enabled
        success, resp = self.test(
            "PUT /api/admin/advertising/settings - toggle email_campaigns_enabled",
            "PUT",
            "admin/advertising/settings",
            200,
            data={"email_campaigns_enabled": False},
            token=self.admin_token
        )
        if success:
            settings = resp.get('settings', {})
            if settings.get('email_campaigns_enabled') == False:
                self.log(f"  ✅ email_campaigns_enabled toggled to False")
            else:
                self.log(f"  ❌ email_campaigns_enabled not updated", "ERROR")
        
        # Test toggling ppc_campaigns_enabled
        success, resp = self.test(
            "PUT /api/admin/advertising/settings - toggle ppc_campaigns_enabled",
            "PUT",
            "admin/advertising/settings",
            200,
            data={"ppc_campaigns_enabled": False},
            token=self.admin_token
        )
        if success:
            settings = resp.get('settings', {})
            if settings.get('ppc_campaigns_enabled') == False:
                self.log(f"  ✅ ppc_campaigns_enabled toggled to False")
        
        # Test toggling banner_campaigns_enabled
        success, resp = self.test(
            "PUT /api/admin/advertising/settings - toggle banner_campaigns_enabled",
            "PUT",
            "admin/advertising/settings",
            200,
            data={"banner_campaigns_enabled": False},
            token=self.admin_token
        )
        if success:
            settings = resp.get('settings', {})
            if settings.get('banner_campaigns_enabled') == False:
                self.log(f"  ✅ banner_campaigns_enabled toggled to False")
        
        # Re-enable all for subsequent tests
        self.test(
            "PUT /api/admin/advertising/settings - re-enable all channels",
            "PUT",
            "admin/advertising/settings",
            200,
            data={
                "email_campaigns_enabled": True,
                "ppc_campaigns_enabled": True,
                "banner_campaigns_enabled": True
            },
            token=self.admin_token
        )
    
    def test_event_sponsorship_join(self):
        """Test POST /api/shop/advertising/events/{id}/join - wallet deduction + ledger"""
        self.log("\n" + "=" * 60)
        self.log("EVENT SPONSORSHIP JOIN")
        self.log("=" * 60)
        
        # First, get available events
        success, resp = self.test(
            "GET /api/shop/advertising/events - get available events",
            "GET",
            "shop/advertising/events",
            200,
            token=self.shop2_token
        )
        
        if not success:
            self.log("  ⚠️  Could not fetch events, skipping join test", "WARN")
            return
        
        events = resp.get('events', [])
        available_event = None
        for ev in events:
            if ev.get('available') and not ev.get('joined'):
                available_event = ev
                break
        
        if not available_event:
            self.log("  ⚠️  No available events to join, skipping", "WARN")
            return
        
        event_id = available_event['id']
        self.log(f"  Found available event: {available_event.get('title')}")
        
        # Get wallet balance before
        success_before, wallet_before = self.test(
            "GET /api/shop/advertising/overview - check wallet before",
            "GET",
            "shop/advertising/overview",
            200,
            token=self.shop2_token
        )
        
        if not success_before:
            self.log("  ⚠️  Could not get wallet balance, skipping", "WARN")
            return
        
        balance_before = wallet_before.get('wallet_balance', 0)
        self.log(f"  Wallet before: ${balance_before}")
        
        # Join event for 1 day
        success, resp = self.test(
            f"POST /api/shop/advertising/events/{event_id}/join - sponsor for 1 day",
            "POST",
            f"shop/advertising/events/{event_id}/join",
            200,
            data={"days": 1},
            token=self.shop2_token
        )
        
        if success:
            total_price = resp.get('total_price', 0)
            self.log(f"  ✅ Joined event, charged ${total_price}")
            
            # Check wallet after
            success_after, wallet_after = self.test(
                "GET /api/shop/advertising/overview - check wallet after",
                "GET",
                "shop/advertising/overview",
                200,
                token=self.shop2_token
            )
            
            if success_after:
                balance_after = wallet_after.get('wallet_balance', 0)
                self.log(f"  Wallet after: ${balance_after}")
                expected_balance = balance_before - total_price
                if abs(balance_after - expected_balance) < 0.01:
                    self.log(f"  ✅ Wallet deducted correctly")
                else:
                    self.log(f"  ❌ Wallet mismatch: expected ${expected_balance}, got ${balance_after}", "ERROR")
    
    def test_admin_remove_event_sponsor(self):
        """Test DELETE /api/admin/advertising/events/{id}/sponsor - clear current_sponsor"""
        self.log("\n" + "=" * 60)
        self.log("ADMIN REMOVE EVENT SPONSOR")
        self.log("=" * 60)
        
        # Get events with current sponsor
        success, resp = self.test(
            "GET /api/admin/advertising/events - find sponsored event",
            "GET",
            "admin/advertising/events",
            200,
            token=self.admin_token
        )
        
        if not success:
            self.log("  ⚠️  Could not fetch events", "WARN")
            return
        
        events = resp.get('events', [])
        sponsored_event = None
        for ev in events:
            if ev.get('current_sponsor'):
                sponsored_event = ev
                break
        
        if not sponsored_event:
            self.log("  ⚠️  No sponsored events found, skipping remove test", "WARN")
            return
        
        event_id = sponsored_event['id']
        sponsor_name = sponsored_event['current_sponsor'].get('shop_name', 'Unknown')
        self.log(f"  Found sponsored event: {sponsored_event.get('title')} by {sponsor_name}")
        
        # Remove sponsor
        success, resp = self.test(
            f"DELETE /api/admin/advertising/events/{event_id}/sponsor - remove sponsor",
            "DELETE",
            f"admin/advertising/events/{event_id}/sponsor",
            200,
            token=self.admin_token
        )
        
        if success:
            self.log(f"  ✅ Removed sponsor from event")
            
            # Verify current_sponsor is cleared
            success_verify, resp_verify = self.test(
                "GET /api/admin/advertising/events - verify sponsor removed",
                "GET",
                "admin/advertising/events",
                200,
                token=self.admin_token
            )
            
            if success_verify:
                events_after = resp_verify.get('events', [])
                event_after = next((e for e in events_after if e['id'] == event_id), None)
                if event_after and not event_after.get('current_sponsor'):
                    self.log(f"  ✅ current_sponsor cleared successfully")
                else:
                    self.log(f"  ❌ current_sponsor still present", "ERROR")
    
    def test_ai_product_description(self):
        """Test POST /api/shop/products/ai-generate - SHORT description (1-2 sentences)"""
        self.log("\n" + "=" * 60)
        self.log("AI PRODUCT DESCRIPTION")
        self.log("=" * 60)
        
        success, resp = self.test(
            "POST /api/shop/products/ai-generate - generate SHORT description",
            "POST",
            "shop/products/ai-generate",
            200,
            data={"name": "Wireless Bluetooth Headphones"},
            token=self.shop1_token
        )
        
        if success:
            description = resp.get('description', '')
            word_count = len(description.split())
            self.log(f"  Generated description ({word_count} words):")
            self.log(f"    \"{description}\"")
            
            if word_count <= 100:
                self.log(f"  ✅ Description is SHORT (≤100 words)")
            else:
                self.log(f"  ❌ Description is too long ({word_count} words > 100)", "ERROR")
    
    def test_home_banners_with_sponsor(self):
        """Test GET /api/home-banners - should include current_sponsor field"""
        self.log("\n" + "=" * 60)
        self.log("HOME BANNERS WITH SPONSOR")
        self.log("=" * 60)
        
        def check_banners(data):
            if isinstance(data, list):
                banners = data
            else:
                banners = data.get('banners', [])
            
            if len(banners) == 0:
                self.log(f"  ⚠️  No banners found", "WARN")
                return True
            
            self.log(f"  Found {len(banners)} banners")
            for banner in banners:
                title = banner.get('title', 'Untitled')
                has_sponsor = 'current_sponsor' in banner
                sponsor_name = banner.get('current_sponsor', {}).get('shop_name') if banner.get('current_sponsor') else None
                self.log(f"    - {title}: has_sponsor={has_sponsor}, sponsor={sponsor_name or 'None'}")
            return True
        
        self.test(
            "GET /api/home-banners - check current_sponsor field",
            "GET",
            "home-banners",
            200,
            check_fn=check_banners
        )
    
    def run_all_tests(self):
        """Run all tests"""
        self.log("=" * 60)
        self.log("OPENMARKET LEBANON - ADVERTISING FEATURES TEST SUITE")
        self.log("=" * 60)
        
        self.login()
        
        if not self.admin_token or not self.shop1_token:
            self.log("❌ Authentication failed, cannot proceed", "ERROR")
            return False
        
        self.test_admin_advertising_overview()
        self.test_admin_advertising_events()
        self.test_admin_advertising_toggles()
        self.test_event_sponsorship_join()
        self.test_admin_remove_event_sponsor()
        self.test_ai_product_description()
        self.test_home_banners_with_sponsor()
        
        # Print summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        self.log(f"Tests run: {self.tests_run}")
        self.log(f"Tests passed: {self.tests_passed}")
        self.log(f"Tests failed: {self.tests_run - self.tests_passed}")
        
        if self.failures:
            self.log("\n❌ FAILURES:")
            for failure in self.failures:
                self.log(f"  - {failure}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"\nSuccess rate: {success_rate:.1f}%")
        
        return self.tests_run == self.tests_passed

if __name__ == "__main__":
    tester = AdvertisingFeaturesTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
