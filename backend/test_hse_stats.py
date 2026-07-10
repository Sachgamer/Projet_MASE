import os
import django
import sys

# Setup django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from reports.views import HseStatsView
from rest_framework.test import APIRequestFactory, force_authenticate
from users.models import User

def test_view():
    factory = APIRequestFactory()
    request = factory.get('/api/hse-stats/')
    
    # Get or create a test admin user
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.filter(is_active=True).first()
    if not user:
        user = User.objects.create_user(username='testdiag', password='pwd', is_staff=True)
        
    force_authenticate(request, user=user)
    
    view = HseStatsView.as_view()
    try:
        response = view(request)
        print("STATUS CODE:", response.status_code)
        print("RESPONSE DATA:", response.data)
    except Exception as e:
        import traceback
        print("EXCEPTION RAISED:")
        traceback.print_exc()

if __name__ == '__main__':
    test_view()
