from django.contrib.auth.models import AbstractUser
from django.db import models

# Modèle Utilisateur personnalisé pour l'application
class User(AbstractUser):
    # Code temporaire pour la double authentification (2FA) envoyé par email
    two_factor_code = models.CharField(max_length=6, blank=True, null=True)
    # Date et heure d'expiration du code 2FA
    two_factor_code_expires_at = models.DateTimeField(blank=True, null=True)
