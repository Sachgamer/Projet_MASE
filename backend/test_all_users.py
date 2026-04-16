import urllib.request
import json

def test_user_flow(username, password):
    print(f"\n--- Testing Flow for User: {username} ---")
    token = None
    try:
        url = "http://127.0.0.1:8000/auth/login/"
        payload = {"username": username, "password": password}
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, method='POST', headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as res:
            token = json.loads(res.read().decode('utf-8'))['key']
            print(f"Auth Success. Token: {token[:5]}...")
    except Exception as e:
        print(f"Auth Failed: {e}")
        return

    endpoints = [
        ("User Info", "http://127.0.0.1:8000/auth/user/"),
        ("Slideshows", "http://127.0.0.1:8000/api/slideshows/"),
        ("Files", "http://127.0.0.1:8000/api/files/"),
        ("Reports", "http://127.0.0.1:8000/api/reports/"),
        ("Controls Equipment", "http://127.0.0.1:8000/api/controls/equipment/"),
    ]

    for name, url in endpoints:
        print(f"Testing {name}...")
        try:
            req = urllib.request.Request(url, headers={'Authorization': f'Token {token}'})
            with urllib.request.urlopen(req) as response:
                print(f"{name} Success: {response.getcode()}")
        except urllib.error.HTTPError as e:
            print(f"{name} Failed: {e.code}")
            if e.code == 500:
                body = e.read().decode('utf-8', errors='ignore')
                filename = f"traceback_{username}_{name.lower().replace(' ', '_')}.html"
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(body)
                print(f"TRACEOBACK SAVED TO {filename}")
        except Exception as e:
            print(f"{name} Error: {e}")

test_user_flow("admin", "admin")
test_user_flow("testuser", "password123")
