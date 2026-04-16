from rest_framework import viewsets, permissions
from .models import PersonalFile
from .serializers import PersonalFileSerializer

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
