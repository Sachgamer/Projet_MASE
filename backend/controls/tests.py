from django.test import TestCase
from django.core import mail
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import EquipmentItem, Inspection

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

    def test_create_conforming_inspection_does_not_send_email(self):
        # Initialement, aucun email envoyé
        self.assertEqual(len(mail.outbox), 0)

        # Création d'une inspection conforme
        Inspection.objects.create(
            item=self.equipment,
            is_valid=True,
            comments="Tout est ok"
        )

        # L'inspection est conforme -> pas de mail
        self.assertEqual(len(mail.outbox), 0)

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
        self.assertIn("[WebMASE] ALERTE : Auto-contrôle NON CONFORME", email.subject)
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
        self.assertEqual(len(mail.outbox), 0)

        # Passage à non conforme
        inspection.is_valid = False
        inspection.defects = {"Cassé": True}
        inspection.save()

        # Un email doit être envoyé
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("Cassé : Présent", email.body)

