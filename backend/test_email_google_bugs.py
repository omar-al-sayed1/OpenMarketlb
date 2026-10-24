"""
OpenMarket Lebanon - Backend Tests for Email & Google OAuth Bug Fixes
Tests:
1. Google OAuth redirect (BUG 1)
2. Email test endpoint (BUG 2)
3. Email blast still works (REGRESSION)
"""
import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Use the public endpoint
BASE_URL = "https://product-variants-ui-1.preview.emergentagent.com/api"

class EmailGoogleTester:
    def __init__(self):
        self.shop1_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []

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
                    if response_data and isinstance(response_data, dict):
                        self.log(f"     Response: {json.dumps(response_data, indent=2)[:300]}")
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

    def test_google_oauth_redirect(self):
        """Test BUG 1: Google OAuth should return auth_url"""
        self.log("\n### BUG 1: Google OAuth Redirect ###")
        
        # Test login intent
        success, data = self.test(
            "Google OAuth - Login Intent",
            "GET",
            "auth/google/login?intent=login",
            200,
            check_response=lambda r: 'auth_url' in r and 'accounts.google.com' in r.get('auth_url', '')
        )
        
        if success and data.get('auth_url'):
            self.log(f"     ✓ Auth URL contains Google: {data['auth_url'][:80]}...")
        
        # Test signup intent
        success, data = self.test(
            "Google OAuth - Signup Intent",
            "GET",
            "auth/google/login?intent=signup",
            200,
            check_response=lambda r: 'auth_url' in r and 'accounts.google.com' in r.get('auth_url', '')
        )
        
        if success and data.get('auth_url'):
            self.log(f"     ✓ Auth URL contains Google: {data['auth_url'][:80]}...")

    def test_authentication(self):
        """Login as shop1 to get token"""
        self.log("\n### AUTHENTICATION ###")
        
        # Login as shop1
        success, data = self.test(
            "Login as shop1@test.com",
            "POST",
            "auth/login",
            200,
            data={"email": "shop1@test.com", "password": "Test1234!"},
            check_response=lambda r: 'token' in r and 'user' in r
        )
        
        if success:
            self.shop1_token = data.get('token')
            self.log(f"     ✓ Got shop1 token: {self.shop1_token[:20]}...")
        else:
            self.log("     ✗ Failed to login as shop1 - cannot continue with authenticated tests", "ERROR")
            return False
        
        return True

    def test_email_test_endpoint(self):
        """Test BUG 2: Email test endpoint (free, doesn't charge wallet)"""
        self.log("\n### BUG 2: Email Test Endpoint ###")
        
        if not self.shop1_token:
            self.log("     ✗ No shop1 token - skipping email tests", "ERROR")
            return
        
        # Test 1: Send test email with custom email
        success, data = self.test(
            "Send test email to openmarketlb@gmail.com",
            "POST",
            "shop/advertising/email/test",
            200,
            data={
                "test_email": "openmarketlb@gmail.com",
                "subject": "Test deliverability",
                "body_html": "<p>Test message from automated test</p>",
                "cta_text": "Visit Shop",
                "preview": "Testing email deliverability",
                "link_type": "shop"
            },
            token=self.shop1_token,
            check_response=lambda r: 'message' in r and 'Test email sent to' in r.get('message', '') and 'inbox' in r.get('message', '').lower()
        )
        
        if success:
            self.log(f"     ✓ Message: {data.get('message', '')}")
        
        # Test 2: Send test email without test_email param (should fallback to user's email)
        success, data = self.test(
            "Send test email without test_email param (fallback to account email)",
            "POST",
            "shop/advertising/email/test",
            200,
            data={
                "subject": "Test fallback email",
                "body_html": "<p>Test message with fallback</p>",
                "cta_text": "Visit Shop"
            },
            token=self.shop1_token,
            check_response=lambda r: 'message' in r and 'Test email sent to' in r.get('message', '')
        )
        
        if success:
            self.log(f"     ✓ Message: {data.get('message', '')}")
        
        # Test 3: Send test email with invalid email
        success, data = self.test(
            "Send test email with invalid email (should return 400)",
            "POST",
            "shop/advertising/email/test",
            400,
            data={
                "test_email": "notanemail",
                "subject": "Test invalid",
                "body_html": "<p>Test</p>"
            },
            token=self.shop1_token
        )
        
        if success:
            self.log(f"     ✓ Correctly rejected invalid email")

    def test_email_blast_regression(self):
        """Test REGRESSION: Email blast should still work"""
        self.log("\n### REGRESSION: Email Blast Still Works ###")
        
        if not self.shop1_token:
            self.log("     ✗ No shop1 token - skipping blast test", "ERROR")
            return
        
        # First, get recipient preview to know how many recipients
        success, preview_data = self.test(
            "Preview recipients for blast",
            "POST",
            "shop/advertising/email/preview-recipients",
            200,
            data={
                "target_type": "own_customers",
                "target_state": "all"
            },
            token=self.shop1_token,
            check_response=lambda r: 'recipient_count' in r
        )
        
        if not success:
            self.log("     ✗ Failed to get recipient preview - skipping blast test", "ERROR")
            return
        
        recipient_count = preview_data.get('recipient_count', 0)
        self.log(f"     ℹ Available recipients: {recipient_count}")
        
        if recipient_count == 0:
            self.log("     ℹ No recipients available - skipping blast test (this is OK)")
            return
        
        # Send a blast to 1 recipient only (to minimize cost)
        success, data = self.test(
            "Send email blast to 1 recipient",
            "POST",
            "shop/advertising/email/blast",
            200,
            data={
                "subject": "Test blast from automated test",
                "body_html": "<p>This is a test email blast</p>",
                "cta_text": "Shop Now",
                "target_type": "own_customers",
                "target_state": "all",
                "max_recipients": 1,
                "link_type": "shop"
            },
            token=self.shop1_token,
            check_response=lambda r: 'campaign' in r and 'message' in r
        )
        
        if success:
            self.log(f"     ✓ Message: {data.get('message', '')}")
            campaign = data.get('campaign', {})
            self.log(f"     ✓ Campaign ID: {campaign.get('id', 'N/A')}")
            self.log(f"     ✓ Recipients: {campaign.get('recipients_count', 0)}")

    def check_backend_logs(self):
        """Remind to check backend logs for email sending confirmation"""
        self.log("\n### MANUAL CHECK: Backend Logs ###")
        self.log("     ℹ Please check backend logs for email sending confirmation:")
        self.log("     $ tail -n 50 /var/log/supervisor/backend.err.log | grep 'Email sent successfully'")
        self.log("     Expected: 'Email sent successfully to openmarketlb@gmail.com: [Test] Test deliverability'")

    def run_all_tests(self):
        """Run all tests"""
        self.log("=" * 80)
        self.log("STARTING EMAIL & GOOGLE OAUTH BUG FIX TESTS")
        self.log("=" * 80)

        # Test Google OAuth redirect (BUG 1)
        self.test_google_oauth_redirect()

        # Authenticate
        if not self.test_authentication():
            self.log("\n❌ Authentication failed - cannot continue with email tests", "ERROR")
            self.print_summary()
            return 1

        # Test email test endpoint (BUG 2)
        self.test_email_test_endpoint()

        # Test email blast regression
        self.test_email_blast_regression()

        # Remind to check logs
        self.check_backend_logs()

        # Print summary
        self.print_summary()
        
        return 0 if self.tests_failed == 0 else 1

    def print_summary(self):
        """Print test summary"""
        self.log("\n" + "=" * 80)
        self.log("TEST SUMMARY")
        self.log("=" * 80)
        self.log(f"Total Tests: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed} ✅")
        self.log(f"Failed: {self.tests_failed} ❌")
        self.log(f"Success Rate: {(self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0:.1f}%")
        
        if self.failures:
            self.log("\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failures, 1):
                self.log(f"  {i}. {failure}")
        else:
            self.log("\n✅ ALL TESTS PASSED!")
        
        self.log("=" * 80)

def main():
    tester = EmailGoogleTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
