from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from users.models import BlockedMacAddress
from django.core.cache import cache
from django.utils import timezone

User = get_user_model()

class MacAddressBlockingTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.username = "testuser"
        self.password = "testpassword123"
        self.email = "test@example.com"
        self.user = User.objects.create_user(
            username=self.username,
            password=self.password,
            email=self.email
        )
        self.mac_address = "AA:BB:CC:DD:EE:FF"
        self.login_url = reverse('custom_login')
        self.verify_2fa_url = reverse('verify_2fa')

    def tearDown(self):
        cache.clear()

    def test_login_success_triggers_2fa(self):
        response = self.client.post(self.login_url, {
            'username': self.username,
            'password': self.password,
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['detail'], '2FA validation required')
        
        # Verify 2FA code is set on the user
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.two_factor_code)

    def test_failed_login_attempts_block_mac(self):
        # 4 failed password attempts
        for i in range(4):
            response = self.client.post(self.login_url, {
                'username': self.username,
                'password': 'wrongpassword',
                'mac_address': self.mac_address
            })
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # MAC should not be blocked yet
        self.assertFalse(BlockedMacAddress.objects.filter(mac_address=self.mac_address, is_active=True).exists())

        # 5th failed attempt
        response = self.client.post(self.login_url, {
            'username': self.username,
            'password': 'wrongpassword',
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("machine a été bloquée", response.data['detail'])

        # MAC should now be blocked
        self.assertTrue(BlockedMacAddress.objects.filter(mac_address=self.mac_address, is_active=True).exists())

        # Subsequent attempts from the same MAC (even with correct password) should be blocked immediately
        response = self.client.post(self.login_url, {
            'username': self.username,
            'password': self.password,
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_failed_2fa_attempts_block_mac(self):
        # Trigger 2FA
        response = self.client.post(self.login_url, {
            'username': self.username,
            'password': self.password,
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        
        # 4 failed 2FA attempts
        for i in range(4):
            response = self.client.post(self.verify_2fa_url, {
                'username': self.username,
                'code': '000000', # wrong code
                'mac_address': self.mac_address
            })
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("Il vous reste", response.data['detail'])

        # MAC should not be blocked yet
        self.assertFalse(BlockedMacAddress.objects.filter(mac_address=self.mac_address, is_active=True).exists())

        # 5th failed attempt
        response = self.client.post(self.verify_2fa_url, {
            'username': self.username,
            'code': '000000', # wrong code
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("machine a été bloquée", response.data['detail'])
        self.assertTrue(BlockedMacAddress.objects.filter(mac_address=self.mac_address, is_active=True).exists())

    def test_combined_failed_attempts_block_mac(self):
        # 3 failed password attempts
        for i in range(3):
            response = self.client.post(self.login_url, {
                'username': self.username,
                'password': 'wrongpassword',
                'mac_address': self.mac_address
            })
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 1 successful password attempt (triggers 2FA)
        response = self.client.post(self.login_url, {
            'username': self.username,
            'password': self.password,
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        # 1 failed 2FA attempt (this is the 4th total failure)
        response = self.client.post(self.verify_2fa_url, {
            'username': self.username,
            'code': '000000',
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Il vous reste 1 tentative", response.data['detail'])

        # 2nd failed 2FA attempt (this is the 5th total failure)
        response = self.client.post(self.verify_2fa_url, {
            'username': self.username,
            'code': '000000',
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(BlockedMacAddress.objects.filter(mac_address=self.mac_address, is_active=True).exists())

    def test_successful_login_resets_attempts(self):
        # 3 failed password attempts
        for i in range(3):
            self.client.post(self.login_url, {
                'username': self.username,
                'password': 'wrongpassword',
                'mac_address': self.mac_address
            })
        
        # 1 successful login trigger 2FA
        self.client.post(self.login_url, {
            'username': self.username,
            'password': self.password,
            'mac_address': self.mac_address
        })
        self.user.refresh_from_db()
        code = self.user.two_factor_code

        # Successful 2FA
        response = self.client.post(self.verify_2fa_url, {
            'username': self.username,
            'code': code,
            'mac_address': self.mac_address
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # The cache should be cleared
        cache_key = f"failed_attempts_{self.mac_address}"
        self.assertIsNone(cache.get(cache_key))

    def test_blocked_mac_associates_user_on_login_fail(self):
        # 5 failed password attempts
        for i in range(5):
            self.client.post(self.login_url, {
                'username': self.username,
                'password': 'wrongpassword',
                'mac_address': self.mac_address
            })
        
        blocked_mac = BlockedMacAddress.objects.get(mac_address=self.mac_address)
        self.assertEqual(blocked_mac.user, self.user)

    def test_blocked_mac_associates_user_on_2fa_fail(self):
        # Trigger 2FA
        self.client.post(self.login_url, {
            'username': self.username,
            'password': self.password,
            'mac_address': self.mac_address
        })
        
        # 5 failed 2FA attempts
        for i in range(5):
            self.client.post(self.verify_2fa_url, {
                'username': self.username,
                'code': '000000',
                'mac_address': self.mac_address
            })
        
        blocked_mac = BlockedMacAddress.objects.get(mac_address=self.mac_address)
        self.assertEqual(blocked_mac.user, self.user)

