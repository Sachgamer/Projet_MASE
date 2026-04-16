# Script de diagnostic pour identifier les erreurs 500
import urllib.request
import json

def test_endpoint(name, url, payload=None, headers=None):
    print(f"Testing {name} at {url}...")
    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(url, data=data, method='POST' if payload else 'GET')
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if payload:
        req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"{name} Success: {response.getcode()}")
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"{name} Failed: {e.code}")
        body = e.read().decode('utf-8', errors='ignore')
        filename = f"error_{name.lower().replace(' ', '_')}.html"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(body)
        print(f"Error body saved to {filename}")
        return None
    except Exception as e:
        print(f"{name} Error: {e}")
        return None

# 1. Login
login_res = test_endpoint("Login", "http://127.0.0.1:8000/auth/login/", {"username": "admin", "password": "admin"})

if login_res and 'key' in login_res:
    token = login_res['key']
    # 2. User Details
    test_endpoint("User Details", "http://127.0.0.1:8000/auth/user/", headers={"Authorization": f"Token {token}"})
