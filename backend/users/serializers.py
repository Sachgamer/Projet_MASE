from rest_framework import serializers
from dj_rest_auth.serializers import UserDetailsSerializer
from .models import User, BlockedMacAddress, Habilitation, Agency, ViewPermission

class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = '__all__'

# Convertit les données utilisateur au format JSON pour les envoyer au site
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    agency_name = serializers.CharField(source='agency.name', read_only=True, allow_null=True)
    agency_region = serializers.CharField(source='agency.region', read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'is_active', 'agency', 'agency_name', 'agency_region', 'min_slideshows_per_year', 'min_reports_per_year', 'role', 'password')
        # Ces champs ne peuvent pas être modifiés par l'utilisateur
        read_only_fields = ('is_staff', 'is_superuser')

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

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

class HabilitationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_fullname = serializers.SerializerMethodField(read_only=True)
    type_name_display = serializers.CharField(source='get_type_name_display', read_only=True)

    class Meta:
        model = Habilitation
        fields = [
            'id', 'user', 'username', 'user_fullname', 'type_name', 'type_name_display',
            'custom_title', 'obtained_date', 'expiration_date', 'certificate', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_user_fullname(self, obj):
        if obj.user:
            fullname = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return fullname or obj.user.username
        return ""


class ViewPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ViewPermission
        fields = '__all__'




