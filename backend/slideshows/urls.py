from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SlideshowViewSet, QuizViewSet, SlideViewSet, QuestionViewSet, ChoiceViewSet

# Configure les routes pour tout ce qui concerne les formations (diaporamas, quiz, questions)
router = DefaultRouter()
# Route pour les diaporamas (formations)
router.register(r'slideshows', SlideshowViewSet)
# Route pour les pages de formation
router.register(r'slides', SlideViewSet)
# Route pour les questionnaires de validation
router.register(r'quizzes', QuizViewSet)
# Route pour gérer les questions individuelles
router.register(r'questions', QuestionViewSet)
# Route pour gérer les choix de réponse
router.register(r'choices', ChoiceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
