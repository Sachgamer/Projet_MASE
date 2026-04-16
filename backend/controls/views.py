from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from django.http import FileResponse
from .models import EquipmentItem, Inspection
from .serializers import EquipmentItemSerializer, InspectionSerializer
from .utils import generate_inspection_pdf

# Permission qui autorise la modification uniquement pour les administrateurs
class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        # La lecture est autorisée pour tout le monde
        if request.method in permissions.SAFE_METHODS:
            return True
        # La modification nécessite d'être membre du personnel (admin)
        return request.user and request.user.is_staff

# Gère la liste des équipements (EPI, Véhicules, etc.)
class EquipmentItemViewSet(viewsets.ModelViewSet):
    queryset = EquipmentItem.objects.all()
    serializer_class = EquipmentItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        # Les admins voient tout l'équipement du parc
        if self.request.user.is_staff or self.request.user.is_superuser:
            return self.queryset.all()
        # Les techniciens ne voient que l'équipement qui leur est affecté
        return self.queryset.filter(technician=self.request.user, is_active=True)

# Gère les rapports d'auto-contrôle (consultation et création)
class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.all()
    serializer_class = InspectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Les admins voient tous les rapports d'inspection
        if self.request.user.is_staff or self.request.user.is_superuser:
            return self.queryset.all().order_by('-date')
        # Les techniciens voient uniquement leurs propres contrôles
        return self.queryset.filter(item__technician=self.request.user).order_by('-date')

    def perform_create(self, serializer):
        # Enregistre le nouveau rapport dans la base de données
        serializer.save()

    # Action spéciale pour générer un fichier PDF du rapport
    @action(detail=True, methods=['get'])
    def generate_pdf(self, request, pk=None):
        inspection = self.get_object()
        buffer = generate_inspection_pdf(inspection)
        filename = f"Rapport_AutoControle_{inspection.id}_{inspection.date.strftime('%Y%m%d')}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename)
