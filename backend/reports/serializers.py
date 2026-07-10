from rest_framework import serializers
from .models import AccidentReport, AccidentReportPhoto, WorkSite, Action

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
        fields = ['id', 'severity', 'incident_type', 'location', 'worksite', 'worksite_details', 'description', 'incident_date', 'image', 'video', 'published', 'created_at', 'reporter', 'reporter_name', 'photos', 'days_lost']
        # L'utilisateur ne peut pas changer l'auteur lui-même
        read_only_fields = ['id', 'created_at', 'reporter']

class ActionSerializer(serializers.ModelSerializer):
    reporter_name = serializers.ReadOnlyField(source='reporter.username')
    assigned_to_name = serializers.ReadOnlyField(source='assigned_to.username')
    assigned_to_fullname = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Action
        fields = [
            'id', 'title', 'description', 'status', 'priority', 'due_date',
            'assigned_to', 'assigned_to_name', 'assigned_to_fullname',
            'reporter', 'reporter_name', 'accident_report', 'inspection',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'reporter']

    def get_assigned_to_fullname(self, obj):
        if obj.assigned_to:
            fullname = f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
            return fullname or obj.assigned_to.username
        return None

