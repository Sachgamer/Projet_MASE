from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

# Vérifie que le fichier envoyé ne dépasse pas 1 Go
def validate_file_size(value):
    filesize = value.size
    if filesize > 1024 * 1024 * 1024:
        raise ValidationError("La taille maximale du fichier est de 1 Go")
    else:
        return value

# Représente un document personnel téléchargé par un utilisateur
class PersonalFile(models.Model):
    # L'utilisateur à qui appartient le fichier
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_files')
    # Le fichier lui-même (stocké dans personal_files/)
    file = models.FileField(upload_to='personal_files/', validators=[validate_file_size])
    uploaded_at = models.DateTimeField(auto_now_add=True)
    # Nom d'affichage du fichier
    name = models.CharField(max_length=255, blank=True)

    def save(self, *args, **kwargs):
        # Si aucun nom n'est donné, on utilise le nom du fichier par défaut
        if not self.name and self.file:
            self.name = self.file.name
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class ChemicalProduct(models.Model):
    name = models.CharField(max_length=255, unique=True, verbose_name="Nom du produit")
    manufacturer = models.CharField(max_length=255, blank=True, verbose_name="Fabricant")
    sds_file = models.FileField(upload_to='sds/', verbose_name="Fiche de Données de Sécurité (FDS)")
    pictograms = models.CharField(max_length=255, blank=True, help_text="Pictogrammes séparés par des virgules, ex: GHS02,GHS07", verbose_name="Pictogrammes de danger")
    description = models.TextField(blank=True, verbose_name="Usage et remarques")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Produit chimique"
        verbose_name_plural = "Produits chimiques / FDS"

    def __str__(self):
        return self.name


class PeriodicVisit(models.Model):
    VISIT_TYPE_CHOICES = [
        ('electricity', 'Électricité'),
        ('water', 'Eaux'),
        ('harness', 'Harnais'),
        ('other', 'Autre'),
    ]
    visit_type = models.CharField(max_length=50, choices=VISIT_TYPE_CHOICES, default='electricity', verbose_name="Type de visite")
    custom_type = models.CharField(max_length=255, blank=True, null=True, verbose_name="Type de visite personnalisé")
    date = models.DateField(verbose_name="Date de la visite")
    next_due_date = models.DateField(blank=True, null=True, verbose_name="Prochaine échéance")
    comments = models.TextField(blank=True, null=True, verbose_name="Commentaires / Observations")
    inspector = models.CharField(max_length=255, blank=True, null=True, verbose_name="Organisme / Inspecteur")
    document = models.FileField(upload_to='periodic_visits/', blank=True, null=True, verbose_name="Rapport PDF")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Visite périodique"
        verbose_name_plural = "Visites périodiques"
        ordering = ['-date']

    def __str__(self):
        type_display = self.get_visit_type_display() if self.visit_type != 'other' else (self.custom_type or 'Autre')
        return f"Visite {type_display} du {self.date}"

