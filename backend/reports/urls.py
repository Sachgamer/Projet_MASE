from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AccidentReportViewSet

# Définit automatiquement les adresses (URLs) pour les rapports d'accident
router = DefaultRouter()
# Route racine pour gérer les rapports
router.register(r'', AccidentReportViewSet, basename='accident-report')

urlpatterns = [
    path('', include(router.urls)),
]
