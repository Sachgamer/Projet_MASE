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

    def test_regular_user_can_start_assigned_action(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/actions/{self.action.id}/"
        response = self.client.patch(url, {'status': 'in_progress'})
        self.assertEqual(response.status_code, 200)
        self.action.refresh_from_db()
        self.assertEqual(self.action.status, 'in_progress')

    def test_regular_user_cannot_modify_other_action_fields(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/actions/{self.action.id}/"
        response = self.client.patch(url, {'title': 'Nouveau titre'})
        self.assertEqual(response.status_code, 403)

    def test_agency_user_can_validate_action(self):
        # Create agency
        from users.models import Agency
        agency = Agency.objects.create(name="Agence Test", region="Nord")
        
        # Link users to agency
        self.user.agency = agency
        self.user.save()
        self.reporter.agency = agency
        self.reporter.save()

        # 1. First, submit proof as regular user
        self.action.completion_proof_text = "Preuve"
        self.action.completion_proof_file = SimpleUploadedFile("proof.jpg", b"content", content_type="image/jpeg")
        self.action.status = 'pending_validation'
        self.action.save()

        # 2. Create agency user
        agency_user = User.objects.create_user(
            username='agency_user_val',
            email='agency_val@example.com',
            password='password123',
            role='agency',
            agency=agency
        )

        # 3. Try to validate as agency user
        self.client.force_authenticate(user=agency_user)
        url = f"/api/actions/{self.action.id}/validate_action/"
        response = self.client.post(url, {'decision': 'approve'})
        self.assertEqual(response.status_code, 200)
        self.action.refresh_from_db()
        self.assertEqual(self.action.status, 'done')

    def test_technician_cannot_validate_action(self):
        # Create a non-assigned technician user
        other_user = User.objects.create_user(
            username='tech_other',
            email='tech_other@example.com',
            password='password123',
            role='technician'
        )
        self.client.force_authenticate(user=other_user)
        url = f"/api/actions/{self.action.id}/validate_action/"
        response = self.client.post(url, {'decision': 'approve'})
        self.assertEqual(response.status_code, 403)


class AccidentReportModificationPermissionsTestCase(APITestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(
            username='reporter_user_mod',
            email='reporter_mod@example.com',
            password='password123'
        )
        self.staff_user = User.objects.create_user(
            username='staffuser_mod',
            email='staff_mod@example.com',
            password='password123',
            is_staff=True
        )
        self.report = AccidentReport.objects.create(
            reporter=self.reporter,
            severity='medium',
            incident_type='near_miss',
            location='Zone A',
            description='Un presqu\'accident à tester.',
            incident_date=timezone.now(),
            published=False
        )

    def test_regular_user_can_modify_only_allowed_fields(self):
        self.client.force_authenticate(user=self.reporter)
        url = f"/api/reports/{self.report.id}/"
        
        # Test modifying allowed fields
        data = {
            'location': 'Zone B',
            'description': 'Description modifiée.',
            'incident_date': timezone.now()
        }
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.location, 'Zone B')
        self.assertEqual(self.report.description, 'Description modifiée.')

        # Test modifying disallowed field (severity)
        data = {
            'severity': 'high'
        }
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, 403)
        self.report.refresh_from_db()
        self.assertEqual(self.report.severity, 'medium')

    def test_admin_can_modify_all_fields(self):
        self.client.force_authenticate(user=self.staff_user)
        url = f"/api/reports/{self.report.id}/"
        
        data = {
            'severity': 'high',
            'incident_type': 'accident',
            'location': 'Zone C'
        }
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.severity, 'high')
        self.assertEqual(self.report.incident_type, 'accident')
        self.assertEqual(self.report.location, 'Zone C')

