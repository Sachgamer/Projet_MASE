# Configuration de l'interface d'administration pour les utilisateurs
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

admin.site.register(User, UserAdmin)
