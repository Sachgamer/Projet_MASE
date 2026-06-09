# Configuration de l'interface d'administration pour les utilisateurs
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, BlockedMacAddress

admin.site.register(User, UserAdmin)


# Configuration de l'affichage des adresses MAC bloquées
@admin.register(BlockedMacAddress)
class BlockedMacAddressAdmin(admin.ModelAdmin):
    list_display = ('mac_address', 'blocked_at', 'reason', 'is_active', 'failed_attempts')
    list_filter = ('is_active', 'blocked_at', 'failed_attempts')
    search_fields = ('mac_address', 'reason', 'notes')
    readonly_fields = ('blocked_at',)
    fieldsets = (
        ('Adresse MAC', {
            'fields': ('mac_address', 'is_active')
        }),
        ('Détails du blocage', {
            'fields': ('reason', 'failed_attempts', 'notes')
        }),
        ('Dates', {
            'fields': ('blocked_at',),
            'classes': ('collapse',)
        }),
    )

