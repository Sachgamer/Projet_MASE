from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from .models import AccidentReport, WorkSite, Action

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

class ActionAPITestCase(APITestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(
            username='reporter_user',
            email='reporter@example.com',
            password='password123',
            is_staff=True
        )
        self.user = User.objects.create_user(
            username='assigned_user',
            email='assigned@example.com',
            password='password123'
        )
        self.action = Action.objects.create(
            title="Action test",
            description="Description test",
            reporter=self.reporter,
            assigned_to=self.user,
            status='todo'
        )

    def test_direct_close_without_proof_fails(self):
        self.client.force_authenticate(user=self.reporter)
        url = f"/api/actions/{self.action.id}/"
        response = self.client.patch(url, {'status': 'done'})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Une preuve écrite et une preuve visuelle (photo/fichier) sont obligatoires", str(response.data))

    def test_submit_proof_regular_user(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/actions/{self.action.id}/submit_proof/"
        
        proof_file = SimpleUploadedFile("proof.jpg", b"file_content", content_type="image/jpeg")
        data = {
            'completion_proof_text': "J'ai bien corrigé le problème.",
            'completion_proof_file': proof_file
        }
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.action.refresh_from_db()
        self.assertEqual(self.action.status, 'pending_validation')
        self.assertEqual(self.action.completion_proof_text, "J'ai bien corrigé le problème.")

    def test_submit_proof_admin_closes_directly(self):
        self.client.force_authenticate(user=self.reporter)
        url = f"/api/actions/{self.action.id}/submit_proof/"
        
        proof_file = SimpleUploadedFile("proof.jpg", b"file_content", content_type="image/jpeg")
        data = {
            'completion_proof_text': "Action clôturée par l'admin.",
            'completion_proof_file': proof_file
        }
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.action.refresh_from_db()
        self.assertEqual(self.action.status, 'done')
        self.assertEqual(self.action.completion_proof_text, "Action clôturée par l'admin.")

