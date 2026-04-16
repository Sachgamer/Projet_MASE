from rest_framework import serializers
from .models import PersonalFile

# Convertit les informations des fichiers personnels en JSON pour le site
class PersonalFileSerializer(serializers.ModelSerializer):
    # Récupère le nom de l'utilisateur propriétaire
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = PersonalFile
        fields = ['id', 'file', 'name', 'uploaded_at', 'user_name']
        read_only_fields = ['id', 'uploaded_at', 'user_name']
