from rest_framework import serializers
from .models import AccidentReport, AccidentReportPhoto, WorkSite

class WorkSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkSite
        fields = ['id', 'name', 'address', 'latitude', 'longitude', 'is_active', 'created_at']

class AccidentReportPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccidentReportPhoto
        fields = ['id', 'image', 'uploaded_at']

# Convertit les rapports d'accident au format JSON pour le site
class AccidentReportSerializer(serializers.ModelSerializer):
    # Récupère le nom de l'utilisateur qui a fait le signalement
    reporter_name = serializers.ReadOnlyField(source='reporter.username')
    photos = AccidentReportPhotoSerializer(many=True, read_only=True)
    worksite = serializers.PrimaryKeyRelatedField(queryset=WorkSite.objects.all(), required=False, allow_null=True)
    worksite_details = WorkSiteSerializer(source='worksite', read_only=True)

    class Meta:
        model = AccidentReport
        fields = ['id', 'severity', 'incident_type', 'location', 'worksite', 'worksite_details', 'description', 'incident_date', 'image', 'video', 'published', 'created_at', 'reporter', 'reporter_name', 'photos']
        # L'utilisateur ne peut pas changer l'auteur lui-même
        read_only_fields = ['id', 'created_at', 'reporter']
