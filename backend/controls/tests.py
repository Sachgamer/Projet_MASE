from django.test import TestCase
from django.core import mail
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import EquipmentItem, Inspection
from .serializers import EquipmentItemSerializer

User = get_user_model()

class InspectionEmailAlertTestCase(TestCase):
    def setUp(self):
        # Création des utilisateurs
        self.technician = User.objects.create_user(
            username='technicien',
            email='tech@example.com',
            password='password123',
            first_name='Jean',
            last_name='Dupont'
        )
        self.admin = User.objects.create_user(
            username='admin_hse',
            email='admin@example.com',
            password='password123',
            is_staff=True,
            is_superuser=True
        )
        
        # Création de l'équipement
        self.equipment = EquipmentItem.objects.create(
            category='EPI',
            type_name='Harnais de sécurité',
            technician=self.technician,
            serial_number='SN-123456',
            is_active=True
        )

    def test_create_conforming_inspection_sends_email(self):
        # Initialement, aucun email envoyé
        self.assertEqual(len(mail.outbox), 0)

        # Création d'une inspection conforme
        Inspection.objects.create(
            item=self.equipment,
            is_valid=True,
            comments="Tout est ok"
        )

        # L'inspection est conforme -> envoie 1 mail
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Auto-contrôle CONFORME", mail.outbox[0].subject)

    def test_create_non_conforming_inspection_sends_email(self):
        self.assertEqual(len(mail.outbox), 0)

        # Création d'une inspection non conforme
        inspection = Inspection.objects.create(
            item=self.equipment,
            is_valid=False,
            defects={"Trou": True, "Déchirure": False},
            comments="Harnais déchiré"
        )

        # Un email doit être envoyé
        self.assertEqual(len(mail.outbox), 1)
        
        # Vérification du sujet et du corps de l'email
        email = mail.outbox[0]
        self.assertIn("Auto-contrôle NON CONFORME", email.subject)
        self.assertIn("Harnais de sécurité", email.body)
        self.assertIn("Jean Dupont", email.body)
        self.assertIn("Trou : Présent", email.body)
        self.assertIn("Harnais déchiré", email.body)
        self.assertIn("admin@example.com", email.to)

    def test_update_inspection_to_non_conforming_sends_email(self):
        # Création d'une inspection conforme
        inspection = Inspection.objects.create(
            item=self.equipment,
            is_valid=True,
            comments="Tout est ok pour l'instant"
        )
        self.assertEqual(len(mail.outbox), 1)

        # Passage à non conforme
        inspection.is_valid = False
        inspection.defects = {"Cassé": True}
        inspection.save()

        # Un deuxième email doit être envoyé
        self.assertEqual(len(mail.outbox), 2)
        email = mail.outbox[1]
        self.assertIn("Cassé : Présent", email.body)

    def test_inspection_updates_equipment_expiration_date(self):
        self.equipment.expiration_date = None
        self.equipment.save()

        # Création d'une inspection conforme
        Inspection.objects.create(
            item=self.equipment,
            is_valid=True,
            comments="Tout est ok"
        )

        self.equipment.refresh_from_db()
        self.assertIsNotNone(self.equipment.expiration_date)
        
        expected_date = timezone.now().date() + timezone.timedelta(days=30)
        self.assertEqual(self.equipment.expiration_date, expected_date)

class EquipmentStatusSerializerTestCase(TestCase):
    def setUp(self):
        self.technician = User.objects.create_user(
            username='tech_user',
            email='tech@example.com',
            password='password123'
        )
        self.equipment = EquipmentItem.objects.create(
            category='EQUIPEMENT',
            type_name='Harnais',
            technician=self.technician,
            serial_number='SN-098765'
        )

    def test_status_defaults_to_functional_when_no_inspection(self):
        serializer = EquipmentItemSerializer(self.equipment)
        self.assertEqual(serializer.data['status'], 'fonctionnel')

    def test_status_is_defective_when_last_inspection_is_invalid(self):
        # First check it defaults to functional
        serializer = EquipmentItemSerializer(self.equipment)
        self.assertEqual(serializer.data['status'], 'fonctionnel')

        # Add invalid inspection
        Inspection.objects.create(
            item=self.equipment,
            is_valid=False,
            comments="Trouvé un défaut"
        )
        
        serializer = EquipmentItemSerializer(self.equipment)
        self.assertEqual(serializer.data['status'], 'defectueux')

    def test_status_becomes_functional_again_after_valid_inspection(self):
        # Invalid inspection
        Inspection.objects.create(
            item=self.equipment,
            is_valid=False,
            comments="Défaut"
        )
        serializer = EquipmentItemSerializer(self.equipment)
        self.assertEqual(serializer.data['status'], 'defectueux')

        # New valid inspection (repair)
        Inspection.objects.create(
            item=self.equipment,
            is_valid=True,
            comments="Réparé"
        )
        serializer = EquipmentItemSerializer(self.equipment)
        self.assertEqual(serializer.data['status'], 'fonctionnel')

