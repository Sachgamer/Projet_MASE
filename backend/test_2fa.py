# Test du flux d'authentification à deux facteurs (2FA)
import requests
import re
from pprint import pprint

BASE_URL = 'http://localhost:8000/api'
AUTH_URL = 'http://localhost:8000/auth'

def test_2fa_flow():
    print("1. Attempting login...")
    response = requests.post(f"{AUTH_URL}/login/", json={
        'username': 'admin',
        'password': 'admin'
    })
    
    print(f"Status: {response.status_code}")
    pprint(response.json())
    
    if response.status_code == 202:
        print("\n[SUCCESS] 2FA is required as expected.")
        print("Please check the django server console for the email with the code.")
    else:
        print("\n[FAILED] Expected 202 Accepted for 2FA.")

if __name__ == "__main__":
    test_2fa_flow()
