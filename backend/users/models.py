# -*- coding: utf-8 -*-
# Copyright (c) 2026 Sacha. Tous droits réservés.
# Propriété exclusive de Sacha. Toute reproduction ou distribution interdite.

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

# Modèle Utilisateur personnalisé pour l'application
class User(AbstractUser):
    # Code temporaire pour la double authentification (2FA) envoyé par email
    two_factor_code = models.CharField(max_length=6, blank=True, null=True)
    # Date et heure d'expiration du code 2FA
    two_factor_code_expires_at = models.DateTimeField(blank=True, null=True)


# Modèle pour stocker les adresses MAC bloquées après 5 tentatives 2FA infructueuses
class BlockedMacAddress(models.Model):
    # Utilisateur concerné par le blocage
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='blocked_mac_addresses')
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
        return f"{self.mac_address} - {timezone.localtime(self.blocked_at).strftime('%d/%m/%Y %H:%M') if self.blocked_at else ''}"

    def send_blocking_email(self):
        from django.core.mail import send_mail
        from django.conf import settings
        from django.contrib.auth import get_user_model
        from django.utils import timezone

        recipients = set()
        User = get_user_model()
        
        # Get active superusers and staff with email addresses
        admins = User.objects.filter(is_superuser=True, is_active=True).exclude(email='').values_list('email', flat=True)
        for email in admins:
            recipients.add(email)
            
        staffs = User.objects.filter(is_staff=True, is_active=True).exclude(email='').values_list('email', flat=True)
        for email in staffs:
            recipients.add(email)
            
        # Also add default from email
        if hasattr(settings, 'DEFAULT_FROM_EMAIL') and settings.DEFAULT_FROM_EMAIL:
            recipients.add(settings.DEFAULT_FROM_EMAIL)
            
        if not recipients:
            return

        if self.user:
            user_fullname = f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username
            user_details = (
                f"- Nom d'utilisateur (Username) : {self.user.username}\n"
                f"- Adresse email : {self.user.email or 'Non renseignée'}\n"
                f"- Nom complet : {user_fullname}"
            )
        else:
            user_details = "- Aucun utilisateur existant associé."

        blocked_time = timezone.localtime(self.blocked_at).strftime('%d/%m/%Y à %H:%M') if self.blocked_at else timezone.localtime().strftime('%d/%m/%Y à %H:%M')

        subject = f"[WebMASE] Alerte : Adresse MAC bloquée - {self.mac_address}"
        message = (
            f"Bonjour,\n\n"
            f"Une adresse MAC a été bloquée sur la plateforme WebMASE.\n\n"
            f"Détails du blocage :\n"
            f"- Adresse MAC : {self.mac_address}\n"
            f"- Date/Heure : {blocked_time}\n"
            f"- Raison : {self.reason or 'Non spécifiée'}\n"
            f"- Notes : {self.notes or 'Aucune note'}\n\n"
            f"Informations sur l'utilisateur bloqué :\n"
            f"{user_details}\n\n"
            f"Cordialement,\n"
            f"L'équipe WebMASE"
        )

        from_email = 'noreply@webmase.com'
        
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
            logger.error(f"Erreur lors de l'envoi de l'email d'alerte de blocage MAC : {e}")

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        was_active = False
        if not is_new:
            try:
                old_instance = BlockedMacAddress.objects.get(pk=self.pk)
                was_active = old_instance.is_active
            except BlockedMacAddress.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)
        
        # Envoi d'un mail si la MAC est nouvellement bloquée (soit création active, soit passage à actif)
        if (is_new and self.is_active) or (not is_new and self.is_active and not was_active):
            self.send_blocking_email()
