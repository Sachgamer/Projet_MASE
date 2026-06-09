from rest_framework import serializers
from dj_rest_auth.serializers import UserDetailsSerializer
from .models import User, BlockedMacAddress

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
    mac_address = serializers.CharField(max_length=17, required=False, allow_blank=True)

# Serializer pour les adresses MAC bloquées
class BlockedMacAddressSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    user_email = serializers.CharField(source='user.email', read_only=True, allow_null=True)
    user_full_name = serializers.SerializerMethodField()

    class Meta:
        model = BlockedMacAddress
        fields = ('id', 'mac_address', 'blocked_at', 'reason', 'failed_attempts', 'is_active', 'notes', 'user', 'username', 'user_email', 'user_full_name')
        read_only_fields = ('id', 'blocked_at', 'username', 'user_email', 'user_full_name')

    def get_user_full_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return None


