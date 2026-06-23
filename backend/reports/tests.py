from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import AccidentReport

User = get_user_model()

class AccidentReportPDFTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testreporter',
            email='reporter@example.com',
            password='password123',
            first_name='Jean',
            last_name='Dupont'
        )
        self.report = AccidentReport.objects.create(
            reporter=self.user,
            severity='low',
            location='Atelier A',
            description='Chute de plain-pied sans gravité.',
            incident_date=timezone.now(),
            published=True
        )

    def test_generate_pdf_endpoint_returns_pdf(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/reports/{self.report.id}/generate_pdf/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
