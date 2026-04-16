import requests
import json

url = "http://127.0.0.1:8000/auth/login/"
payload = {
    "username": "testuser",
    "password": "password123"
}
headers = {
    "Content-Type": "application/json"
}

try:
    print(f"Testing POST to {url}...")
    response = requests.post(url, data=json.dumps(payload), headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
