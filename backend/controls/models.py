from django.db import models
from django.conf import settings

# Représente un objet d'équipement (EPI, Véhicule, etc.)
class EquipmentItem(models.Model):
    CATEGORY_CHOICES = [
        ('EPI', 'EPI'),
        ('EQUIPEMENT', 'Équipement'),
        ('VEHICULE', 'Véhicule'),
    ]

    # Type de catégorie (EPI, Équipement ou Véhicule)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    # Nom spécifique (ex: Gants, Camionnette)
    type_name = models.CharField(max_length=100)
    # Technicien à qui l'équipement est affecté
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_equipment')
    # Numéro de série ou matricule
    serial_number = models.CharField(max_length=100, blank=True, null=True)
    # Date de fin de validité
    expiration_date = models.DateField(blank=True, null=True)
    # Indique si l'équipement est toujours utilisé
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.category} - {self.type_name} ({self.technician.username})"

# Représente un rapport d'auto-contrôle effectué sur un équipement
class Inspection(models.Model):
    # L'équipement qui a été contrôlé
    item = models.ForeignKey(EquipmentItem, on_delete=models.CASCADE, related_name='inspections')
    # Date du contrôle
    date = models.DateTimeField(auto_now_add=True)
    # Résultat global (Valide ou non)
    is_valid = models.BooleanField(default=True)
    
    # Détails des défauts trouvés (format flexible pour EPI/Equipement)
    defects = models.JSONField(default=dict, blank=True)
    
    # Liste des points de contrôle spécifiques aux véhicules
    vehicle_checks = models.JSONField(default=dict, blank=True)
    
    # Commentaire libre du technicien
    comments = models.TextField(blank=True, null=True)
    # Indique si l'administrateur a consulté ce rapport
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Inspection for {self.item} on {self.date.date()}"

    def send_non_conformance_email(self):
        from django.core.mail import send_mail
        from django.conf import settings
        from django.contrib.auth import get_user_model
        from django.utils import timezone

        recipients = set()
        User = get_user_model()
        
        # Récupère les administrateurs et membres du personnel actifs ayant un email
        admins = User.objects.filter(is_superuser=True, is_active=True).exclude(email='').values_list('email', flat=True)
        for email in admins:
            recipients.add(email)
            
        staffs = User.objects.filter(is_staff=True, is_active=True).exclude(email='').values_list('email', flat=True)
        for email in staffs:
            recipients.add(email)
            
        if hasattr(settings, 'DEFAULT_FROM_EMAIL') and settings.DEFAULT_FROM_EMAIL:
            recipients.add(settings.DEFAULT_FROM_EMAIL)
            
        if not recipients:
            return

        technician_name = f"{self.item.technician.first_name} {self.item.technician.last_name}".strip() or self.item.technician.username
        inspection_time = self.date.strftime('%d/%m/%Y à %H:%M') if self.date else timezone.now().strftime('%d/%m/%Y à %H:%M')

        # Formate les détails des défauts
        defects_details = ""
        if self.item.category == 'VEHICULE' and self.vehicle_checks:
            defects_details += "Points de contrôle non valides :\n"
            for k, v in self.vehicle_checks.items():
                if v is False:
                    defects_details += f"- {k} : Non Valide\n"
        elif self.item.category != 'VEHICULE' and self.defects:
            defects_details += "Défauts détectés :\n"
            for k, v in self.defects.items():
                if v:
                    defects_details += f"- {k} : Présent\n"
        
        if not defects_details:
            defects_details = "Aucun détail de défaut spécifié dans les champs structurés."

        subject = f"[WebMASE] ALERTE : Auto-contrôle NON CONFORME - {self.item.type_name}"
        message = (
            f"Bonjour,\n\n"
            f"Un auto-contrôle a été signalé comme NON CONFORME sur la plateforme WebMASE.\n\n"
            f"Détails de l'inspection :\n"
            f"- Équipement : {self.item.type_name} ({self.item.get_category_display()})\n"
            f"- Numéro de série / Immatriculation : {self.item.serial_number or 'N/A'}\n"
            f"- Technicien : {technician_name}\n"
            f"- Date/Heure : {inspection_time}\n\n"
            f"{defects_details}\n"
            f"Commentaires du technicien :\n"
            f"{self.comments or 'Aucun commentaire'}\n\n"
            f"Veuillez vous connecter sur l'interface d'administration pour traiter cette non-conformité.\n\n"
            f"Cordialement,\n"
            f"L'équipe WebMASE"
        )

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@webmase.com')
        
        try:
            send_mail(
                subject,
                message,
                from_email,
                list(recipients),
                fail_silently=False,
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de l'envoi de l'email d'alerte de non-conformité : {e}")

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        was_valid = True
        if not is_new:
            try:
                old_instance = Inspection.objects.get(pk=self.pk)
                was_valid = old_instance.is_valid
            except Inspection.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)
        
        # Envoi d'un mail si l'inspection est non conforme (soit création non conforme, soit modification qui passe de conforme à non conforme)
        if (is_new and not self.is_valid) or (not is_new and not self.is_valid and was_valid):
            self.send_non_conformance_email()

# Modèle pour stocker plusieurs photos pour une seule inspection
class InspectionPhoto(models.Model):
    inspection = models.ForeignKey(Inspection, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='inspections/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo for {self.inspection} ({self.id})"

