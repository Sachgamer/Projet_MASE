from rest_framework import viewsets, permissions
from django.db.models import Q
from .models import AccidentReport
from .serializers import AccidentReportSerializer

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
        # Enregistre le rapport avec l'utilisateur actuel comme auteur
        # Par défaut, on force le rapport à n'est pas "publié" tant qu'un admin ne le valide pas
        serializer.save(reporter=self.request.user, published=False)
