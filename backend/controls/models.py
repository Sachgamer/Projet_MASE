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
    
    # Photo éventuelle du problème
    photo = models.ImageField(upload_to='inspections/', blank=True, null=True)
    # Commentaire libre du technicien
    comments = models.TextField(blank=True, null=True)
    # Indique si l'administrateur a consulté ce rapport
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Inspection for {self.item} on {self.date.date()}"
