from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PersonalFileViewSet

# Définit automatiquement les adresses (URLs) pour les fichiers personnels
router = DefaultRouter()
# Route racine pour gérer les fichiers (ex: /api/files/)
router.register(r'', PersonalFileViewSet, basename='personal-file')

urlpatterns = [
    path('', include(router.urls)),
]
