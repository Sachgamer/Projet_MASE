from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from django.db.models import Q
from django.http import FileResponse
from .models import AccidentReport, WorkSite
from .serializers import AccidentReportSerializer, WorkSiteSerializer
from .utils import generate_accident_pdf

class WorkSiteViewSet(viewsets.ModelViewSet):
    queryset = WorkSite.objects.all()
    serializer_class = WorkSiteSerializer

    def get_permissions(self):
        # Permettre aux utilisateurs authentifiés de lister et créer des chantiers (pour l'ajout en direct)
        if self.action in ['list', 'create', 'retrieve']:
            return [permissions.IsAuthenticated()]
        # Seuls les admins peuvent modifier/supprimer des chantiers
        return [permissions.IsAdminUser()]

# Définit qui peut voir ou créer des rapports d'accident
class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        # La lecture est autorisée pour tout le monde (transparence)
        if request.method in permissions.SAFE_METHODS:
            return True
        # L'utilisateur doit être connecté pour effectuer une action
        if not request.user.is_authenticated:
            return False

        # Tout utilisateur connecté peut créer un nouveau rapport
        if request.method == 'POST' and view.action == 'create':
            return True
        # Seuls les administrateurs peuvent modifier ou supprimer un rapport
        return request.user.is_staff or request.user.is_superuser

# Gère la consultation et la création de rapports d'accident
class AccidentReportViewSet(viewsets.ModelViewSet):
    serializer_class = AccidentReportSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        # Tous les rapports sont visibles par tout le monde
        return AccidentReport.objects.all()

    def perform_create(self, serializer):
        # Récupère toutes les photos envoyées dans le champ 'photos'
        photos = self.request.FILES.getlist('photos')
        
        # Pour la rétrocompatibilité, associe la première photo au champ principal 'image'
        first_image = None
        if photos:
            first_image = photos[0]
        else:
            # Fallback si seule l'image unique est fournie
            first_image = self.request.FILES.get('image')
            
        # Enregistre le rapport avec l'utilisateur actuel comme auteur
        # Par défaut, on force le rapport à n'est pas "publié" tant qu'un admin ne le valide pas
        report = serializer.save(reporter=self.request.user, published=False, image=first_image)
        
        # Enregistre toutes les photos dans le modèle AccidentReportPhoto
        from .models import AccidentReportPhoto
        if photos:
            for photo in photos:
                AccidentReportPhoto.objects.create(report=report, image=photo)
        elif first_image:
            AccidentReportPhoto.objects.create(report=report, image=first_image)

    @action(detail=True, methods=['get'])
    def generate_pdf(self, request, pk=None):
        report = self.get_object()
        buffer = generate_accident_pdf(report)
        from django.utils import timezone
        local_date = timezone.localtime(report.created_at) if report.created_at else timezone.localtime()
        
        username = report.reporter.username if report.reporter else 'unknown'
        date_str = local_date.strftime('%Y%m%d')
        filename = f"{username}_-{date_str}_Remontées-Accident.pdf"
        
        return FileResponse(buffer, as_attachment=True, filename=filename)
