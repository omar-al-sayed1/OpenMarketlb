"""
OpenMarket Lebanon - Backend Tests
Tests: Email sending, Google OAuth OTP gating, OTP dev-mode, Loyalty
"""
import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Use the public endpoint from frontend/.env
BASE_URL = "https://google-auth-verify-4.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.admin_token = None
        self.shop1_token = None
        self.user_token = None
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
        self.log("STARTING BACKEND TESTS - OpenMarket Lebanon")
        self.log("=" * 80)

        # 1. Authentication
        self.log("\n### PHASE 1: AUTHENTICATION ###")
        self.test_authentication()

        # 2. Email Sending Tests
        self.log("\n### PHASE 2: EMAIL SENDING (SMTP) ###")
        self.test_email_sending()
        self.test_email_invalid()

        # 3. Google OAuth Tests
        self.log("\n### PHASE 3: GOOGLE OAUTH + OTP GATING ###")
        self.test_google_oauth_login()
        self.test_google_oauth_otp_send_404()

        # 4. OTP Dev-Mode Tests
        self.log("\n### PHASE 4: OTP DEV-MODE ###")
        self.test_otp_send_dev_mode()

        # 5. Loyalty Tests
        self.log("\n### PHASE 5: LOYALTY SYSTEM ###")
        self.test_loyalty_status()
        self.test_loyalty_redeem_preview()

        # Print Summary
        return self.print_summary()

    def test_authentication(self):
        """Test login for admin, shop1, and user"""
        # Admin login
        success, response = self.test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@openmarketlb.com", "password": "Admin123!"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            self.log("  Admin token obtained")

        # Shop1 login
        success, response = self.test(
            "Shop1 Login",
            "POST",
            "auth/login",
            200,
            data={"email": "shop1@openmarketlb.com", "password": "Shop123!"}
        )
        if success and 'token' in response:
            self.shop1_token = response['token']
            self.log("  Shop1 token obtained")

        # User login (has 5000 loyalty points)
        success, response = self.test(
            "User Login (with loyalty points)",
            "POST",
            "auth/login",
            200,
            data={"email": "user@openmarketlb.com", "password": "User123!"}
        )
        if success and 'token' in response:
            self.user_token = response['token']
            self.log("  User token obtained")

    def test_email_sending(self):
        """Test email sending via shop advertising endpoint"""
        if not self.shop1_token:
            self.log("  ⚠️  SKIPPED - Shop1 token not available")
            return

        def check(data):
            # Check for success message
            message = data.get('message', '')
            if 'Test email sent to' not in message:
                self.log(f"  ❌ Expected 'Test email sent to' in message, got: {message}", "ERROR")
                return False
            
            self.log(f"  ✅ Email sent successfully: {message}")
            return True
        
        self.test(
            "POST /api/shop/advertising/email/test - Send test email",
            "POST",
            "shop/advertising/email/test",
            200,
            data={
                "test_email": "openmarketlb@gmail.com",
                "subject": "Deliverability test",
                "body_html": "<p>hi</p>",
                "cta_text": "Visit",
                "link_type": "shop"
            },
            token=self.shop1_token,
            check_response=check
        )

    def test_email_invalid(self):
        """Test email validation - invalid email should return 400"""
        if not self.shop1_token:
            self.log("  ⚠️  SKIPPED - Shop1 token not available")
            return

        self.test(
            "POST /api/shop/advertising/email/test - Invalid email returns 400",
            "POST",
            "shop/advertising/email/test",
            400,
            data={
                "test_email": "notanemail",
                "subject": "Test",
                "body_html": "<p>test</p>",
                "cta_text": "Visit",
                "link_type": "shop"
            },
            token=self.shop1_token
        )

    def test_google_oauth_login(self):
        """Test GET /api/auth/google/login returns auth_url with correct params"""
        def check(data):
            if 'auth_url' not in data:
                self.log("  ❌ Missing 'auth_url' in response", "ERROR")
                return False
            
            auth_url = data['auth_url']
            
            # Check auth_url contains accounts.google.com
            if 'accounts.google.com' not in auth_url:
                self.log("  ❌ auth_url doesn't contain accounts.google.com", "ERROR")
                return False
            
            # Check client_id is present
            if 'client_id' not in auth_url:
                self.log("  ❌ auth_url doesn't contain client_id", "ERROR")
                return False
            
            self.log(f"  ✅ auth_url contains accounts.google.com and client_id")
            return True
        
        self.test(
            "GET /api/auth/google/login?intent=signup - Returns valid auth_url",
            "GET",
            "auth/google/login?intent=signup",
            200,
            check_response=check
        )

    def test_google_oauth_otp_send_404(self):
        """Test POST /api/auth/google/otp/send with fake pending_id returns 404"""
        self.test(
            "POST /api/auth/google/otp/send - Fake pending_id returns 404",
            "POST",
            "auth/google/otp/send",
            404,
            data={
                "pending_id": "fake-pending-id-12345",
                "phone": "+96171234567"
            }
        )

    def test_otp_send_dev_mode(self):
        """Test OTP dev-mode - send and verify"""
        # Send OTP
        def check_send(data):
            if 'otp_code' not in data:
                self.log("  ❌ Missing 'otp_code' in response (DEV_MODE)", "ERROR")
                return False
            
            otp_code = data['otp_code']
            self.log(f"  ✅ OTP code returned (DEV_MODE): {otp_code}")
            
            # Store for verification
            self.otp_code = otp_code
            return True
        
        success, response = self.test(
            "POST /api/otp/send - DEV_MODE returns otp_code",
            "POST",
            "otp/send",
            200,
            data={
                "phone_number": "+96171234567",
                "purpose": "google_signup"
            },
            check_response=check_send
        )

        # Verify OTP if send was successful
        if success and hasattr(self, 'otp_code'):
            def check_verify(data):
                if not data.get('valid'):
                    self.log("  ❌ OTP verification failed", "ERROR")
                    return False
                
                self.log(f"  ✅ OTP verified successfully")
                return True
            
            self.test(
                "POST /api/otp/verify - Verify OTP code",
                "POST",
                "otp/verify",
                200,
                data={
                    "phone_number": "+96171234567",
                    "code": self.otp_code,
                    "purpose": "google_signup"
                },
                check_response=check_verify
            )

    def test_loyalty_status(self):
        """Test GET /api/loyalty/me for user with 5000 points"""
        if not self.user_token:
            self.log("  ⚠️  SKIPPED - User token not available")
            return

        def check(data):
            if not data.get('enabled'):
                self.log("  ❌ Loyalty not enabled", "ERROR")
                return False
            
            points_balance = data.get('points_balance', 0)
            if points_balance != 5000:
                self.log(f"  ❌ Expected 5000 points, got {points_balance}", "ERROR")
                return False
            
            self.log(f"  ✅ Loyalty enabled with {points_balance} points")
            return True
        
        self.test(
            "GET /api/loyalty/me - User has 5000 points",
            "GET",
            "loyalty/me",
            200,
            token=self.user_token,
            check_response=check
        )

    def test_loyalty_redeem_preview(self):
        """Test POST /api/loyalty/redeem/preview"""
        if not self.user_token:
            self.log("  ⚠️  SKIPPED - User token not available")
            return

        def check(data):
            if 'capped_discount' not in data:
                self.log("  ❌ Missing 'capped_discount' in response", "ERROR")
                return False
            
            capped_discount = data.get('capped_discount', 0)
            if capped_discount <= 0:
                self.log(f"  ❌ Expected capped_discount > 0, got {capped_discount}", "ERROR")
                return False
            
            self.log(f"  ✅ Redeem preview: discount=${capped_discount:.2f}")
            return True
        
        self.test(
            "POST /api/loyalty/redeem/preview - 5000 points on $61.6 cart",
            "POST",
            "loyalty/redeem/preview",
            200,
            data={
                "points_to_redeem": 5000,
                "cart_total": 61.6
            },
            token=self.user_token,
            check_response=check
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
    tester = BackendTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
