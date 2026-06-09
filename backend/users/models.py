from django.contrib.auth.models import AbstractUser
from django.db import models

# Modèle Utilisateur personnalisé pour l'application
class User(AbstractUser):
    # Code temporaire pour la double authentification (2FA) envoyé par email
    two_factor_code = models.CharField(max_length=6, blank=True, null=True)
    # Date et heure d'expiration du code 2FA
    two_factor_code_expires_at = models.DateTimeField(blank=True, null=True)


# Modèle pour stocker les adresses MAC bloquées après 5 tentatives 2FA infructueuses
class BlockedMacAddress(models.Model):
    # Adresse MAC de la machine (format: AA:BB:CC:DD:EE:FF)
    mac_address = models.CharField(max_length=17, unique=True, db_index=True)
    # Date et heure du blocage
    blocked_at = models.DateTimeField(auto_now_add=True)
    # Raison du blocage
    reason = models.CharField(max_length=255, default="Trop de tentatives 2FA infructueuses")
    # Nombre de tentatives qui ont conduit au blocage
    failed_attempts = models.IntegerField(default=5)
    # Actif ou non
    is_active = models.BooleanField(default=True)
    # Notes additionnelles (exemple: infos sur l'utilisateur qui tentait)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-blocked_at']
        verbose_name = "MAC Adresse Bloquée"
        verbose_name_plural = "MACs Adresses Bloquées"

    def __str__(self):
        return f"{self.mac_address} - {self.blocked_at.strftime('%d/%m/%Y %H:%M')}"
