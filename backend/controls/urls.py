from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EquipmentItemViewSet, InspectionViewSet

# Définit automatiquement les adresses (URLs) pour l'application Controls
router = DefaultRouter()
# Adresse pour gérer le matériel (ex: /api/controls/equipment/)
router.register(r'equipment', EquipmentItemViewSet)
# Adresse pour gérer les rapports d'inspection (ex: /api/controls/inspections/)
router.register(r'inspections', InspectionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
