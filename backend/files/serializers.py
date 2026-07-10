from rest_framework import serializers
from .models import PersonalFile, ChemicalProduct

# Convertit les informations des fichiers personnels en JSON pour le site
class PersonalFileSerializer(serializers.ModelSerializer):
    # Récupère le nom de l'utilisateur propriétaire
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = PersonalFile
        fields = ['id', 'file', 'name', 'uploaded_at', 'user_name']
        read_only_fields = ['id', 'uploaded_at', 'user_name']

class ChemicalProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChemicalProduct
        fields = ['id', 'name', 'manufacturer', 'sds_file', 'pictograms', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']

