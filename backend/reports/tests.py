from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import AccidentReport, WorkSite

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

class WorkSiteAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testreporter2',
            email='reporter2@example.com',
            password='password123'
        )
        self.staff_user = User.objects.create_user(
            username='staffuser',
            email='staff@example.com',
            password='password123',
            is_staff=True
        )
        self.worksite = WorkSite.objects.create(
            name="Chantier Principal",
            address="123 Rue de la Gare",
            latitude=48.8566,
            longitude=2.3522
        )

    def test_list_worksites_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/worksites/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Chantier Principal")

    def test_create_worksite_authenticated(self):
        self.client.force_authenticate(user=self.user)
        data = {
            "name": "Nouveau Chantier",
            "address": "456 Avenue des Champs",
            "latitude": 48.8738,
            "longitude": 2.2950
        }
        response = self.client.post('/api/worksites/', data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(WorkSite.objects.count(), 2)

    def test_delete_worksite_non_staff_forbidden(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(f'/api/worksites/{self.worksite.id}/')
        self.assertEqual(response.status_code, 403)

    def test_delete_worksite_staff_allowed(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.delete(f'/api/worksites/{self.worksite.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(WorkSite.objects.count(), 0)
