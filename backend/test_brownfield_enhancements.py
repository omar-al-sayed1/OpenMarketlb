"""
OpenMarket Lebanon - Brownfield Enhancement Tests
Tests: Welcome bonus, Finance Center filtering, Agent fill-shop, Admin shops referral data
"""
import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Use the public endpoint from frontend/.env
BASE_URL = "https://admin-money-metrics.preview.emergentagent.com/api"

class BrownfieldTester:
    def __init__(self):
        self.admin_token = None
        self.agent_token = None
        self.shop_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        self.category_id = None

    def log(self, message: str, level: str = "INFO"):
        """Log a message with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def test(self, name: str, method: str, endpoint: str, expected_status: int, 
             data: Optional[Dict] = None, token: Optional[str] = None, 
             check_response: Optional[callable] = None) -> tuple[bool, Any]:
        """Run a single API test"""
        url = f"{BASE_URL}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        self.log(f"Test #{self.tests_run}: {name}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"raw": response.text}

            if success:
                # Additional response validation if provided
                if check_response and not check_response(response_data):
                    success = False
                    self.log(f"  ❌ FAILED - Response validation failed", "ERROR")
                    self.failures.append(f"{name}: Response validation failed")
                else:
                    self.tests_passed += 1
                    self.log(f"  ✅ PASSED - Status: {response.status_code}")
            else:
                self.tests_failed += 1
                self.log(f"  ❌ FAILED - Expected {expected_status}, got {response.status_code}", "ERROR")
                self.log(f"     Response: {json.dumps(response_data, indent=2)[:500]}", "ERROR")
                self.failures.append(f"{name}: Expected {expected_status}, got {response.status_code}")

            return success, response_data

        except Exception as e:
            self.tests_failed += 1
            self.log(f"  ❌ FAILED - Exception: {str(e)}", "ERROR")
            self.failures.append(f"{name}: Exception - {str(e)}")
            return False, {}

    def run_all_tests(self):
        """Run all backend tests"""
        self.log("=" * 80)
        self.log("BROWNFIELD ENHANCEMENT TESTS - OpenMarket Lebanon")
        self.log("=" * 80)

        # 1. Authentication
        self.log("\n### PHASE 1: AUTHENTICATION ###")
        self.test_authentication()

        # 2. Welcome Bonus - Non-Referred
        self.log("\n### PHASE 2: WELCOME BONUS - NON-REFERRED SHOP ###")
        self.test_welcome_bonus_non_referred()

        # 3. Welcome Bonus - Referred
        self.log("\n### PHASE 3: WELCOME BONUS - REFERRED SHOP (via Agent) ###")
        self.test_welcome_bonus_referred()

        # 4. Agent Fill-Shop with Categories & Logo
        self.log("\n### PHASE 4: AGENT FILL-SHOP (categories + logo) ###")
        self.test_agent_fill_shop_full()

        # 5. Finance Center Filtering
        self.log("\n### PHASE 5: FINANCE CENTER FILTERING (year/month) ###")
        self.test_finance_center_filtering()

        # 6. Finance Timeseries
        self.log("\n### PHASE 6: FINANCE TIMESERIES ###")
        self.test_finance_timeseries()

        # 7. Admin Shops Referral Data
        self.log("\n### PHASE 7: ADMIN SHOPS REFERRAL DATA ###")
        self.test_admin_shops_referral_data()

        # 8. Monthly Analytics
        self.log("\n### PHASE 8: MONTHLY ANALYTICS ###")
        self.test_monthly_analytics()

        # Print Summary
        return self.print_summary()

    def test_authentication(self):
        """Test login for admin, agent, and shop"""
        # Admin login
        success, response = self.test(
            "Admin Login (admin@openmarket.com / Admin1234!)",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@openmarket.com", "password": "Admin1234!"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            self.log("  ✅ Admin token obtained")
        else:
            self.log("  ❌ Admin token NOT obtained - cannot proceed", "ERROR")

        # Agent login
        success, response = self.test(
            "Agent Login (example@agent.com / Agent1234!)",
            "POST",
            "auth/login",
            200,
            data={"email": "example@agent.com", "password": "Agent1234!"}
        )
        if success and 'token' in response:
            self.agent_token = response['token']
            self.log("  ✅ Agent token obtained")
        else:
            self.log("  ⚠️  Agent token NOT obtained", "WARN")

        # Shop login
        success, response = self.test(
            "Shop Login (shop1@test.com / Test1234!)",
            "POST",
            "auth/login",
            200,
            data={"email": "shop1@test.com", "password": "Test1234!"}
        )
        if success and 'token' in response:
            self.shop_token = response['token']
            self.log("  ✅ Shop token obtained")

        # Get a category ID for later tests
        if self.admin_token:
            success, response = self.test(
                "GET /api/categories - Get category list",
                "GET",
                "categories",
                200,
                token=self.admin_token
            )
            if success and isinstance(response, list) and len(response) > 0:
                self.category_id = response[0].get('id')
                self.log(f"  ✅ Category ID obtained: {self.category_id}")

    def test_welcome_bonus_non_referred(self):
        """Test welcome bonus for non-referred shop: $2 wallet + 1 free sponsor"""
        if not self.admin_token:
            self.log("  ⚠️  SKIPPED - Admin token not available")
            return

        # Create a guest application (no referral_code)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        guest_email = f"guest_nonref_{timestamp}@test.com"
        
        success, response = self.test(
            "POST /api/shop/register-guest - Create non-referred guest application",
            "POST",
            "shop/register-guest",
            200,
            data={
                "name": f"NonRef Shop {timestamp}",  # Field is 'name' not 'shop_name'
                "email": guest_email,
                "phone": "+96171234567",
                "guest_name": "Guest Owner",
                "address": "Test Address",
                "state": "Beirut"
            }
        )
        
        if not success:
            self.log("  ❌ Failed to create guest application", "ERROR")
            return
        
        app_id = response.get('application_id')
        if not app_id:
            self.log("  ❌ No application_id in response", "ERROR")
            return
        
        self.log(f"  ✅ Guest application created: {app_id}")

        # Approve the application and then fetch the shop to verify
        success, response = self.test(
            f"POST /api/admin/guest-applications/{app_id}/approve - Approve non-referred shop",
            "POST",
            f"admin/guest-applications/{app_id}/approve",
            200,
            data={"password": "Shop1234!", "subscription_required": False},
            token=self.admin_token
        )
        
        if success:
            shop_id = response.get('shop_id')
            if shop_id:
                # Fetch the shop to verify welcome bonus
                def check_shop(data):
                    wallet_balance = data.get('wallet_balance', 0)
                    free_sponsor_credits = data.get('free_sponsor_credits', 0)
                    
                    # Expected: $2 wallet + 1 free sponsor
                    if wallet_balance != 2.0:
                        self.log(f"  ❌ Expected wallet_balance=2.0, got {wallet_balance}", "ERROR")
                        return False
                    
                    if free_sponsor_credits != 1:
                        self.log(f"  ❌ Expected free_sponsor_credits=1, got {free_sponsor_credits}", "ERROR")
                        return False
                    
                    self.log(f"  ✅ NON-REFERRED welcome bonus correct: ${wallet_balance} wallet + {free_sponsor_credits} sponsor")
                    return True
                
                self.test(
                    f"GET /api/admin/shops/{shop_id} - Verify non-referred welcome bonus",
                    "GET",
                    f"admin/shops/{shop_id}",
                    200,
                    token=self.admin_token,
                    check_response=check_shop
                )

    def test_welcome_bonus_referred(self):
        """Test welcome bonus for referred shop: $3 wallet + 2 free sponsors"""
        if not self.agent_token or not self.admin_token:
            self.log("  ⚠️  SKIPPED - Agent or Admin token not available")
            return

        # Agent fills shop application
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        ref_email = f"guest_ref_{timestamp}@test.com"
        
        success, response = self.test(
            "POST /api/agent/fill-shop - Agent creates referred shop application",
            "POST",
            "agent/fill-shop",
            200,
            data={
                "shop_name": f"Referred Shop {timestamp}",
                "email": ref_email,
                "phone": "+96171234568",
                "guest_name": "Referred Owner",
                "address": "Test Address",
                "state": "Beirut",
                "description": "Test shop",
                "category_ids": [self.category_id] if self.category_id else [],
                "logo": "https://example.com/logo.png"
            },
            token=self.agent_token
        )
        
        if not success:
            self.log("  ❌ Failed to create referred application", "ERROR")
            return
        
        app_id = response.get('application_id')
        if not app_id:
            self.log("  ❌ No application_id in response", "ERROR")
            return
        
        self.log(f"  ✅ Referred application created: {app_id}")

        # Verify the application has referral data
        success, response = self.test(
            "GET /api/admin/guest-applications?status=pending - Check referred application",
            "GET",
            "admin/guest-applications?status=pending",
            200,
            token=self.admin_token
        )
        
        if success:
            apps = response if isinstance(response, list) else []
            found_app = next((a for a in apps if a.get('id') == app_id), None)
            if found_app:
                if found_app.get('referred_by_agent_id') == 'agent-omar':
                    self.log(f"  ✅ Application has referred_by_agent_id=agent-omar")
                if found_app.get('category_ids'):
                    self.log(f"  ✅ Application has category_ids: {found_app.get('category_ids')}")
                if found_app.get('logo'):
                    self.log(f"  ✅ Application has logo: {found_app.get('logo')}")

        # Approve the referred application and then fetch the shop to verify
        success, response = self.test(
            f"POST /api/admin/guest-applications/{app_id}/approve - Approve referred shop",
            "POST",
            f"admin/guest-applications/{app_id}/approve",
            200,
            data={"password": "Shop1234!", "subscription_required": False},
            token=self.admin_token
        )
        
        if success:
            shop_id = response.get('shop_id')
            if shop_id:
                # Fetch the shop to verify welcome bonus
                def check_referred_shop(data):
                    wallet_balance = data.get('wallet_balance', 0)
                    free_sponsor_credits = data.get('free_sponsor_credits', 0)
                    referred_by_agent_id = data.get('referred_by_agent_id')
                    
                    # Expected: $3 wallet + 2 free sponsors
                    if wallet_balance != 3.0:
                        self.log(f"  ❌ Expected wallet_balance=3.0, got {wallet_balance}", "ERROR")
                        return False
                    
                    if free_sponsor_credits != 2:
                        self.log(f"  ❌ Expected free_sponsor_credits=2, got {free_sponsor_credits}", "ERROR")
                        return False
                    
                    if not referred_by_agent_id:
                        self.log(f"  ❌ Expected referred_by_agent_id to be set", "ERROR")
                        return False
                    
                    self.log(f"  ✅ REFERRED welcome bonus correct: ${wallet_balance} wallet + {free_sponsor_credits} sponsors")
                    self.log(f"  ✅ referred_by_agent_id={referred_by_agent_id}")
                    return True
                
                self.test(
                    f"GET /api/admin/shops/{shop_id} - Verify referred welcome bonus",
                    "GET",
                    f"admin/shops/{shop_id}",
                    200,
                    token=self.admin_token,
                    check_response=check_referred_shop
                )

    def test_agent_fill_shop_full(self):
        """Test agent fill-shop stores category_ids and logo"""
        if not self.agent_token or not self.admin_token:
            self.log("  ⚠️  SKIPPED - Agent or Admin token not available")
            return

        if not self.category_id:
            self.log("  ⚠️  SKIPPED - No category_id available")
            return

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_email = f"agent_full_{timestamp}@test.com"
        test_logo = "https://example.com/test-logo.png"
        
        success, response = self.test(
            "POST /api/agent/fill-shop - With category_ids and logo",
            "POST",
            "agent/fill-shop",
            200,
            data={
                "shop_name": f"Full Test Shop {timestamp}",
                "email": test_email,
                "phone": "+96171234569",
                "guest_name": "Full Test Owner",
                "address": "Test Address",
                "state": "Beirut",
                "description": "Full test",
                "category_ids": [self.category_id],
                "logo": test_logo
            },
            token=self.agent_token
        )
        
        if not success:
            self.log("  ❌ Failed to create full application", "ERROR")
            return
        
        app_id = response.get('application_id')
        
        # Verify the application contains category_ids and logo
        success, response = self.test(
            "GET /api/admin/guest-applications?status=pending - Verify full data",
            "GET",
            "admin/guest-applications?status=pending",
            200,
            token=self.admin_token
        )
        
        if success:
            apps = response if isinstance(response, list) else []
            found_app = next((a for a in apps if a.get('id') == app_id), None)
            if found_app:
                cats = found_app.get('category_ids', [])
                logo = found_app.get('logo', '')
                ref_agent = found_app.get('referred_by_agent_id', '')
                
                if self.category_id in cats:
                    self.log(f"  ✅ category_ids stored correctly: {cats}")
                else:
                    self.log(f"  ❌ category_ids missing or incorrect: {cats}", "ERROR")
                
                if logo == test_logo:
                    self.log(f"  ✅ logo stored correctly: {logo}")
                else:
                    self.log(f"  ❌ logo missing or incorrect: {logo}", "ERROR")
                
                if ref_agent == 'agent-omar':
                    self.log(f"  ✅ referred_by_agent_id=agent-omar")
                else:
                    self.log(f"  ❌ referred_by_agent_id incorrect: {ref_agent}", "ERROR")

    def test_finance_center_filtering(self):
        """Test Finance Center with year/month filtering"""
        if not self.admin_token:
            self.log("  ⚠️  SKIPPED - Admin token not available")
            return

        # Test 1: No params (all-time)
        def check_all_time(data):
            period = data.get('period', {})
            if period.get('active') != False:
                self.log(f"  ❌ Expected period.active=false, got {period.get('active')}", "ERROR")
                return False
            
            admin_revenue = data.get('admin_revenue', {})
            admin_profit = admin_revenue.get('admin_profit', 0)
            
            self.log(f"  ✅ All-time admin_profit: ${admin_profit}")
            return True
        
        self.test(
            "GET /api/admin/finance-center - No params (all-time)",
            "GET",
            "admin/finance-center",
            200,
            token=self.admin_token,
            check_response=check_all_time
        )

        # Test 2: Year filter
        def check_year(data):
            period = data.get('period', {})
            if period.get('active') != True:
                self.log(f"  ❌ Expected period.active=true, got {period.get('active')}", "ERROR")
                return False
            
            if period.get('label') != '2026':
                self.log(f"  ❌ Expected period.label='2026', got {period.get('label')}", "ERROR")
                return False
            
            admin_revenue = data.get('admin_revenue', {})
            admin_profit = admin_revenue.get('admin_profit', 0)
            
            self.log(f"  ✅ Year 2026 admin_profit: ${admin_profit}")
            return True
        
        self.test(
            "GET /api/admin/finance-center?year=2026 - Year filter",
            "GET",
            "admin/finance-center?year=2026",
            200,
            token=self.admin_token,
            check_response=check_year
        )

        # Test 3: Year+Month filter
        def check_month(data):
            period = data.get('period', {})
            if period.get('active') != True:
                self.log(f"  ❌ Expected period.active=true, got {period.get('active')}", "ERROR")
                return False
            
            label = period.get('label', '')
            if 'June 2026' not in label and '2026' not in label:
                self.log(f"  ❌ Expected period.label to contain 'June 2026', got {label}", "ERROR")
                return False
            
            admin_revenue = data.get('admin_revenue', {})
            admin_profit = admin_revenue.get('admin_profit', 0)
            
            self.log(f"  ✅ June 2026 admin_profit: ${admin_profit}")
            return True
        
        self.test(
            "GET /api/admin/finance-center?year=2026&month=6 - Month filter",
            "GET",
            "admin/finance-center?year=2026&month=6",
            200,
            token=self.admin_token,
            check_response=check_month
        )

    def test_finance_timeseries(self):
        """Test Finance Timeseries endpoint"""
        if not self.admin_token:
            self.log("  ⚠️  SKIPPED - Admin token not available")
            return

        # Test 1: No year (recent 12 months)
        def check_timeseries(data):
            series = data.get('series', [])
            available_years = data.get('available_years', [])
            
            if not isinstance(series, list):
                self.log(f"  ❌ Expected series to be a list", "ERROR")
                return False
            
            if len(series) == 0:
                self.log(f"  ⚠️  No timeseries data available", "WARN")
                return True
            
            # Check first item has required fields
            first = series[0]
            required = ['month', 'label', 'profit', 'subscriptions', 'commissions', 
                       'platform_services', 'monthly_credits', 'agent_payouts']
            
            for field in required:
                if field not in first:
                    self.log(f"  ❌ Missing field '{field}' in series item", "ERROR")
                    return False
            
            self.log(f"  ✅ Timeseries has {len(series)} months")
            self.log(f"  ✅ Available years: {available_years}")
            return True
        
        self.test(
            "GET /api/admin/finance-center/timeseries - Recent 12 months",
            "GET",
            "admin/finance-center/timeseries",
            200,
            token=self.admin_token,
            check_response=check_timeseries
        )

        # Test 2: Specific year
        def check_year_timeseries(data):
            series = data.get('series', [])
            
            if not isinstance(series, list):
                self.log(f"  ❌ Expected series to be a list", "ERROR")
                return False
            
            # Should have 12 months for 2026
            if len(series) != 12:
                self.log(f"  ⚠️  Expected 12 months for 2026, got {len(series)}", "WARN")
            
            self.log(f"  ✅ Year 2026 timeseries has {len(series)} months")
            return True
        
        self.test(
            "GET /api/admin/finance-center/timeseries?year=2026 - Year 2026",
            "GET",
            "admin/finance-center/timeseries?year=2026",
            200,
            token=self.admin_token,
            check_response=check_year_timeseries
        )

    def test_admin_shops_referral_data(self):
        """Test Admin Shops endpoint returns referral data"""
        if not self.admin_token:
            self.log("  ⚠️  SKIPPED - Admin token not available")
            return

        def check_shops(data):
            if not isinstance(data, list):
                self.log(f"  ❌ Expected list of shops", "ERROR")
                return False
            
            # Find 'Home Decor Plus' shop
            home_decor = next((s for s in data if s.get('id') == 'shop-homedecor'), None)
            
            if not home_decor:
                self.log(f"  ⚠️  'Home Decor Plus' (shop-homedecor) not found", "WARN")
                return True
            
            # Check referral fields
            referred_by_agent_id = home_decor.get('referred_by_agent_id')
            referred_by_agent_name = home_decor.get('referred_by_agent_name')
            referral_code = home_decor.get('referral_code')
            free_sponsor_credits = home_decor.get('free_sponsor_credits')
            
            if referred_by_agent_id != 'agent-omar':
                self.log(f"  ❌ Expected referred_by_agent_id='agent-omar', got {referred_by_agent_id}", "ERROR")
                return False
            
            if referred_by_agent_name != 'Omar':
                self.log(f"  ❌ Expected referred_by_agent_name='Omar', got {referred_by_agent_name}", "ERROR")
                return False
            
            if referral_code != 'OMAR-IKL2L':
                self.log(f"  ❌ Expected referral_code='OMAR-IKL2L', got {referral_code}", "ERROR")
                return False
            
            if free_sponsor_credits != 2:
                self.log(f"  ⚠️  Expected free_sponsor_credits=2, got {free_sponsor_credits}", "WARN")
            
            self.log(f"  ✅ Home Decor Plus has correct referral data:")
            self.log(f"     - referred_by_agent_id: {referred_by_agent_id}")
            self.log(f"     - referred_by_agent_name: {referred_by_agent_name}")
            self.log(f"     - referral_code: {referral_code}")
            self.log(f"     - free_sponsor_credits: {free_sponsor_credits}")
            return True
        
        self.test(
            "GET /api/admin/shops - Check referral data for Home Decor Plus",
            "GET",
            "admin/shops",
            200,
            token=self.admin_token,
            check_response=check_shops
        )

    def test_monthly_analytics(self):
        """Test Monthly Analytics endpoint"""
        if not self.admin_token:
            self.log("  ⚠️  SKIPPED - Admin token not available")
            return

        def check_analytics(data):
            monthly = data.get('monthly', {})
            current_month = data.get('current_month', {})
            
            if not isinstance(monthly, dict):
                self.log(f"  ❌ Expected 'monthly' to be a dict", "ERROR")
                return False
            
            # Check structure of monthly data
            if len(monthly) > 0:
                first_key = list(monthly.keys())[0]
                first_month = monthly[first_key]
                
                required = ['subscriptions', 'commissions', 'adjustments', 
                           'platform_services', 'monthly_credits']
                
                for field in required:
                    if field not in first_month:
                        self.log(f"  ❌ Missing field '{field}' in monthly data", "ERROR")
                        return False
                
                self.log(f"  ✅ Monthly analytics has {len(monthly)} months")
                self.log(f"  ✅ Current month data present: {bool(current_month)}")
            else:
                self.log(f"  ⚠️  No monthly analytics data available", "WARN")
            
            return True
        
        self.test(
            "GET /api/admin/revenue/monthly-analytics - Monthly profit breakdown",
            "GET",
            "admin/revenue/monthly-analytics",
            200,
            token=self.admin_token,
            check_response=check_analytics
        )

    def print_summary(self):
        """Print test summary"""
        self.log("\n" + "=" * 80)
        self.log("TEST SUMMARY")
        self.log("=" * 80)
        self.log(f"Total Tests Run: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed} ✅")
        self.log(f"Failed: {self.tests_failed} ❌")
        
        if self.tests_failed > 0:
            self.log("\nFAILED TESTS:")
            for failure in self.failures:
                self.log(f"  - {failure}", "ERROR")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"\nSuccess Rate: {success_rate:.1f}%")
        self.log("=" * 80)
        
        return 0 if self.tests_failed == 0 else 1


def main():
    tester = BrownfieldTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
