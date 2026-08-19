from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import PersonalFile, ChemicalProduct, PeriodicVisit
from .serializers import PersonalFileSerializer, ChemicalProductSerializer, PeriodicVisitSerializer

# Gère l'accès aux documents personnels de l'utilisateur
class PersonalFileViewSet(viewsets.ModelViewSet):
    serializer_class = PersonalFileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # L'utilisateur ne peut voir et gérer que ses propres fichiers
        return PersonalFile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Associe automatiquement le fichier téléchargé à l'utilisateur actuel
        serializer.save(user=self.request.user)

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_staff or request.user.is_superuser

class ChemicalProductViewSet(viewsets.ModelViewSet):
    queryset = ChemicalProduct.objects.all().order_by('name')
    serializer_class = ChemicalProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

class PeriodicVisitViewSet(viewsets.ModelViewSet):
    queryset = PeriodicVisit.objects.all().order_by('-date')
    serializer_class = PeriodicVisitSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    @action(detail=True, methods=['post'])
    def prolong(self, request, pk=None):
        visit = self.get_object()
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': "Seuls les administrateurs peuvent prolonger les échéances des visites."}, status=status.HTTP_403_FORBIDDEN)
        
        if not visit.next_due_date:
            from django.utils import timezone
            visit.next_due_date = timezone.now().date()
            
        from datetime import timedelta
        visit.next_due_date = visit.next_due_date + timedelta(days=30)
        visit.save()
        return Response({
            'detail': 'Prochaine échéance prolongée de 30 jours.',
            'new_next_due_date': visit.next_due_date
        }, status=status.HTTP_200_OK)

