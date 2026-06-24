from django.db import models
from django.conf import settings

# Représente un rapport d'accident ou d'incident
class AccidentReport(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Faible'),
        ('medium', 'Moyenne'),
        ('high', 'Élevée'),
        ('critical', 'Critique'),
    ]

    INCIDENT_TYPE_CHOICES = [
        ('dangerous_situation', 'Situation dangereuse'),
        ('near_miss', 'Presque accident'),
        ('accident', 'Accident'),
        ('fatal_accident', 'Accident mortel'),
    ]

    # Utilisateur qui a signalé l'incident
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='accident_reports')
    # Niveau de gravité de l'accident
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    # Type de remontée/incident
    incident_type = models.CharField(max_length=50, choices=INCIDENT_TYPE_CHOICES, default='dangerous_situation')
    # Lieu de l'incident
    location = models.CharField(max_length=255)
    # Explication détaillée de ce qu'il s'est passé
    description = models.TextField()
    # Date et heure précises de l'incident
    incident_date = models.DateTimeField()
    # Photo de l'incident (facultatif)
    image = models.ImageField(upload_to='reports/images/', null=True, blank=True)
    # Vidéo de l'incident (facultatif)
    video = models.FileField(upload_to='reports/videos/', null=True, blank=True)
    # Indique si le rapport est validé et visible par tous
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.severity} - {self.location} ({self.reporter.username})"

class AccidentReportPhoto(models.Model):
    report = models.ForeignKey(AccidentReport, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='reports/images/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo {self.id} for Report {self.report.id}"
