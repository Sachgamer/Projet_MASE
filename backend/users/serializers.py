from rest_framework import serializers
from dj_rest_auth.serializers import UserDetailsSerializer
from .models import User

# Convertit les données utilisateur au format JSON pour les envoyer au site
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser')
        # Ces champs ne peuvent pas être modifiés par l'utilisateur
        read_only_fields = ('is_staff', 'is_superuser')

# Définit les informations nécessaires pour valider la double authentification (2FA)
class Verify2FASerializer(serializers.Serializer):
    username = serializers.CharField()
    code = serializers.CharField(max_length=6)
