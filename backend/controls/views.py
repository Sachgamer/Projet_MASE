from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse
from .models import EquipmentItem, Inspection
from .serializers import EquipmentItemSerializer, InspectionSerializer
from .utils import generate_inspection_pdf

# Permission qui autorise la modification pour les administrateurs et l'agence
class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return user and (user.is_staff or user.is_superuser or user.role == 'admin' or user.role == 'agency')

class IsAdminOrCreateOnly(permissions.BasePermission):
    """
    Permet aux techniciens de lire et de créer des inspections,
    mais réserve la modification/suppression aux administrateurs.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS or request.method == 'POST':
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff

# Gère la liste des équipements (EPI, Véhicules, etc.)
class EquipmentItemViewSet(viewsets.ModelViewSet):
    queryset = EquipmentItem.objects.all()
    serializer_class = EquipmentItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser or user.role == 'admin' or user.role == 'agency':
            return self.queryset.all()
        return self.queryset.filter(technician=user, is_active=True)

    @action(detail=True, methods=['post'])
    def prolong(self, request, pk=None):
        item = self.get_object()
        if item.technician != request.user and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': "Vous n'avez pas l'autorisation de prolonger cet équipement."}, status=status.HTTP_403_FORBIDDEN)
        
        if not item.expiration_date:
            from django.utils import timezone
            item.expiration_date = timezone.now().date()
            
        from datetime import timedelta
        item.expiration_date = item.expiration_date + timedelta(days=30)
        item.save()
        return Response({
            'detail': 'Date de validité de l\'équipement prolongée de 30 jours.',
            'new_expiration_date': item.expiration_date
        }, status=status.HTTP_200_OK)

# Gère les rapports d'auto-contrôle (consultation et création)
class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.all()
    serializer_class = InspectionSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCreateOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return self.queryset.all().order_by('-date')
        if user.agency:
            return self.queryset.filter(item__technician__agency=user.agency).order_by('-date')
        return self.queryset.filter(item__technician=user).order_by('-date')

    def perform_create(self, serializer):
        # Enregistre le nouveau rapport dans la base de données
        inspection = serializer.save()
        
        # Récupère toutes les photos envoyées dans le champ 'photos'
        photos = self.request.FILES.getlist('photos')
        from .models import InspectionPhoto
        for photo in photos:
            InspectionPhoto.objects.create(inspection=inspection, image=photo)

    # Action spéciale pour générer un fichier PDF du rapport
    @action(detail=True, methods=['get'])
    def generate_pdf(self, request, pk=None):
        inspection = self.get_object()
        buffer = generate_inspection_pdf(inspection)
        from django.utils import timezone
        local_date = timezone.localtime(inspection.date) if inspection.date else timezone.localtime()
        
        import re
        username = inspection.item.technician.username
        date_str = local_date.strftime('%Y%m%d')
        obj_name = re.sub(r'[^\w\-_\.]', '', inspection.item.type_name.replace(' ', '-'))
        filename = f"{username}_{date_str}_{obj_name}.pdf"
        
        return FileResponse(buffer, as_attachment=True, filename=filename)
