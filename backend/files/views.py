from rest_framework import viewsets, permissions
from .models import PersonalFile, ChemicalProduct
from .serializers import PersonalFileSerializer, ChemicalProductSerializer

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

