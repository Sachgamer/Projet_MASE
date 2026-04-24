from rest_framework import serializers
from .models import EquipmentItem, Inspection, InspectionPhoto

# Convertit les objets Equipement en JSON pour l'affichage sur le site
class EquipmentItemSerializer(serializers.ModelSerializer):
    # Récupère le nom complet du technicien pour l'affichage
    technician_name = serializers.ReadOnlyField(source='technician.get_full_name')
    technician_username = serializers.ReadOnlyField(source='technician.username')

    class Meta:
        model = EquipmentItem
        fields = '__all__'

# Sérialiseur pour les multiples photos
class InspectionPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionPhoto
        fields = ['id', 'image', 'uploaded_at']

# Convertit les objets Inspection (Auto-contrôle) en format JSON
class InspectionSerializer(serializers.ModelSerializer):
    # Inclut automatiquement les détails de l'équipement dans le rapport
    item_details = EquipmentItemSerializer(source='item', read_only=True)
    photos = InspectionPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Inspection
        fields = '__all__'
