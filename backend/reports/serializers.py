from rest_framework import serializers
from .models import AccidentReport

# Convertit les rapports d'accident au format JSON pour le site
class AccidentReportSerializer(serializers.ModelSerializer):
    # Récupère le nom de l'utilisateur qui a fait le signalement
    reporter_name = serializers.ReadOnlyField(source='reporter.username')

    class Meta:
        model = AccidentReport
        fields = ['id', 'severity', 'location', 'description', 'incident_date', 'image', 'video', 'published', 'created_at', 'reporter', 'reporter_name']
        # L'utilisateur ne peut pas forcer la publication ou changer l'auteur lui-même
        read_only_fields = ['id', 'created_at', 'reporter', 'published']
