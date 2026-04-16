import urllib.request
import urllib.parse
import urllib.error
import json
from pprint import pprint

BASE_URL = 'http://localhost:8000/auth'

def test_2fa_flow():
    print("1. Attempting login (expected 202)")
    data = json.dumps({'username': 'admin', 'password': 'admin'}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/login/", data=data, headers={'Content-Type': 'application/json'}, method='POST')
    
    try:
        response = urllib.request.urlopen(req)
        # 202 is treated as success by urllib
        print(f"Status: {response.getcode()}")
        pprint(json.loads(response.read().decode('utf-8')))
        print("\nSUCCESS: Server returned 202 Accepted. 2FA is required.")
        return True
    except urllib.error.HTTPError as e:
        print(f"\nFAILED: Server returned {e.code}")
        try:
            pprint(json.loads(e.read().decode('utf-8')))
        except:
            print(e.read().decode('utf-8'))
        return False

if __name__ == "__main__":
    test_2fa_flow()
