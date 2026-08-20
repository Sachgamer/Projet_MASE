from rest_framework import serializers
from .models import EquipmentItem, Inspection, InspectionPhoto

# Convertit les objets Equipement en JSON pour l'affichage sur le site
class EquipmentItemSerializer(serializers.ModelSerializer):
    technician_name = serializers.SerializerMethodField()
    technician_username = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = EquipmentItem
        fields = '__all__'

    def get_technician_name(self, obj):
        if obj.technician:
            return obj.technician.get_full_name() or obj.technician.username
        return "Non assigné"

    def get_technician_username(self, obj):
        if obj.technician:
            return obj.technician.username
        return "N/A"

    def get_status(self, obj):
        last_inspection = obj.inspections.order_by('-date').first()
        if last_inspection:
            return "defectueux" if not last_inspection.is_valid else "fonctionnel"
        return "fonctionnel"

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
