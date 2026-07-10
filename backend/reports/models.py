from django.db import models
from django.conf import settings

# Représente un chantier ou une zone de travail
class WorkSite(models.Model):
    name = models.CharField(max_length=255, unique=True, verbose_name="Nom du chantier")
    address = models.CharField(max_length=255, blank=True, verbose_name="Adresse")
    latitude = models.FloatField(null=True, blank=True, verbose_name="Latitude")
    longitude = models.FloatField(null=True, blank=True, verbose_name="Longitude")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Chantier"
        verbose_name_plural = "Chantiers"

    def __str__(self):
        return self.name

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
    # Chantier associé
    worksite = models.ForeignKey(WorkSite, on_delete=models.SET_NULL, null=True, blank=True, related_name='reports', verbose_name="Chantier associé")
    # Explication détaillée de ce qu'il s'est passé
    description = models.TextField()
    # Date et heure précises de l'incident
    incident_date = models.DateTimeField()
    # Photo de l'incident (facultatif)
    image = models.ImageField(upload_to='reports/images/', null=True, blank=True)
    # Vidéo de l'incident (facultatif)
    video = models.FileField(upload_to='reports/videos/', null=True, blank=True)
    # Nombre de jours d'arrêt de travail engendrés par l'accident
    days_lost = models.IntegerField(default=0, verbose_name="Jours d'arrêt")
    # Indique si le rapport est validé et visible par tous
    published = models.BooleanField(default=False)
    # Indique si le rapport est supprimé (soft delete)
    is_deleted = models.BooleanField(default=False, verbose_name="Supprimé logiquement")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.severity} - {self.location} ({self.reporter.username})"

    def delete(self, *args, **kwargs):
        self.is_deleted = True
        self.save()

class AccidentReportPhoto(models.Model):
    report = models.ForeignKey(AccidentReport, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='reports/images/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo {self.id} for Report {self.report.id}"

class Action(models.Model):
    STATUS_CHOICES = [
        ('todo', 'À faire'),
        ('in_progress', 'En cours'),
        ('done', 'Clôturé'),
        ('canceled', 'Annulé'),
    ]
    PRIORITY_CHOICES = [
        ('low', 'Basse'),
        ('medium', 'Moyenne'),
        ('high', 'Haute'),
    ]
    
    title = models.CharField(max_length=255, verbose_name="Titre de l'action")
    description = models.TextField(verbose_name="Description de l'action")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='todo')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    due_date = models.DateField(null=True, blank=True, verbose_name="Date d'échéance")
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_actions', verbose_name="Responsable")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_actions', verbose_name="Créateur")
    
    # Origines de l'action
    accident_report = models.ForeignKey(AccidentReport, on_delete=models.SET_NULL, null=True, blank=True, related_name='actions')
    inspection = models.ForeignKey('controls.Inspection', on_delete=models.SET_NULL, null=True, blank=True, related_name='actions')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Action de sécurité"
        verbose_name_plural = "Plan d'actions"

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

