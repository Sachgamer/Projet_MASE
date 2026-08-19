from rest_framework import serializers
from .models import PersonalFile, ChemicalProduct, PeriodicVisit

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
        fields = '__all__'

class PeriodicVisitSerializer(serializers.ModelSerializer):
    visit_type_display = serializers.CharField(source='get_visit_type_display', read_only=True)

    class Meta:
        model = PeriodicVisit
        fields = '__all__'
