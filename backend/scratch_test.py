import os
import sys
import django

# Fake 'test' in sys.argv to trigger sqlite in config/settings.py
sys.argv.append('test')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import BlockedMacAddress
from users.serializers import BlockedMacAddressSerializer

try:
    # Test serializer validation with user = None
    data = {
        'mac_address': 'AA:BB:CC:DD:EE:FF',
        'reason': 'Test create',
        'user': None
    }
    serializer = BlockedMacAddressSerializer(data=data)
    if serializer.is_valid():
        print("Serializer is valid with null user.")
        obj = serializer.save()
        print("Created object ID:", obj.id)
        obj.delete()
    else:
        print("Serializer errors:", serializer.errors)
except Exception as e:
    import traceback
    traceback.print_exc()
