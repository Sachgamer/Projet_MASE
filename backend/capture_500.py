import urllib.request
import json
import os

url = "http://127.0.0.1:8000/auth/login/"
payload = {
    "username": "admin",
    "password": "admin"
}
data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, method='POST')
req.add_header('Content-Type', 'application/json')

try:
    print(f"Testing POST to {url}...")
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.getcode()}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    body = e.read().decode('utf-8', errors='ignore')
    with open('error_500.html', 'w', encoding='utf-8') as f:
        f.write(body)
    print("Error body saved to error_500.html")
except Exception as e:
    print(f"Error: {e}")
