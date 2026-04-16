import urllib.request
import json

def test_endpoint(name, url, token=None):
    print(f"Testing {name} at {url}...")
    headers = {'Authorization': f'Token {token}'} if token else {}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            print(f"{name} Success: {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"{name} Failed: {e.code}")
        if e.code == 500:
            body = e.read().decode('utf-8', errors='ignore')
            filename = f"traceback_{name.lower().replace(' ', '_')}.html"
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(body)
            print(f"TRACEOBACK SAVED TO {filename}")
    except Exception as e:
        print(f"{name} Error: {e}")

# Get token
token = None
try:
    url = "http://127.0.0.1:8000/auth/login/"
    data = json.dumps({"username": "admin", "password": "admin"}).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as res:
        token = json.loads(res.read().decode('utf-8'))['key']
        print(f"Auth Success. Token: {token[:5]}...")
except Exception as e:
    print(f"Auth Failed: {e}")

if token:
    test_endpoint("User Info", "http://127.0.0.1:8000/auth/user/", token)
    test_endpoint("Slideshows", "http://127.0.0.1:8000/api/slideshows/", token)
    test_endpoint("Files", "http://127.0.0.1:8000/api/files/", token)
    test_endpoint("Reports", "http://127.0.0.1:8000/api/reports/", token)
    test_endpoint("Controls Equipment", "http://127.0.0.1:8000/api/controls/equipment/", token)
else:
    print("Cannot proceed without token.")
