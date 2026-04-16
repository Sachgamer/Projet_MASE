import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from reports.serializers import AccidentReportSerializer
from reports.models import AccidentReport

from django.contrib.auth import get_user_model

User = get_user_model()
try:
    user, created = User.objects.get_or_create(username='testadmin', is_staff=True)
    if created:
        user.set_password('password')
        user.save()
    
    # Test creation
    data = {
        'severity': 'low',
        'location': 'Test Location',
        'description': 'Test Description',
        'incident_date': '2023-10-27T10:00:00Z'
    }
    serializer = AccidentReportSerializer(data=data)
    if serializer.is_valid():
        print("Serializer is valid with data.")
        report = serializer.save(reporter=user)
        print(f"Report saved: {report.id}")
        
        # Test output
        out_serializer = AccidentReportSerializer(report)
        print(f"Serialized output: {out_serializer.data}")
    else:
        print(f"Serializer invalid: {serializer.errors}")
except Exception as e:
    import traceback
    print(f"Error during test: {e}")
    traceback.print_exc()
