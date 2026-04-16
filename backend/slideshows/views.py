
from rest_framework import viewsets, permissions
from .models import Slideshow, Quiz, Slide, Question, Choice
from .serializers import SlideshowSerializer, QuizSerializer, SlideSerializer, QuestionSerializer, ChoiceSerializer

# Permission qui permet la modification seulement au créateur de l'élément (ou à un admin)
class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        # La lecture seule est toujours autorisée
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Les administrateurs peuvent tout modifier
        if request.user.is_staff or request.user.is_superuser:
            return True

        # Vérifie si l'utilisateur actuel est bien le créateur du diaporama
        if isinstance(obj, Slideshow):
            return obj.creator == request.user
        if isinstance(obj, Slide):
            return obj.slideshow.creator == request.user
        if isinstance(obj, Quiz):
            return obj.slideshow.creator == request.user
        if isinstance(obj, Question):
            return obj.quiz.slideshow.creator == request.user
        if isinstance(obj, Choice):
            return obj.question.quiz.slideshow.creator == request.user
            
        return False

# Gère les formations (diaporamas)
class SlideshowViewSet(viewsets.ModelViewSet):
    queryset = Slideshow.objects.all()
    serializer_class = SlideshowSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        # Enregistre le créateur lors de la création
        serializer.save(creator=self.request.user)

# Gère les diapos contenues dans les formations
class SlideViewSet(viewsets.ModelViewSet):
    queryset = Slide.objects.all()
    serializer_class = SlideSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        # Vérifie que l'utilisateur est bien le propriétaire de la formation avant d'ajouter une diapo
        slideshow = serializer.validated_data.get('slideshow')
        if slideshow.creator != self.request.user and not (self.request.user.is_staff or self.request.user.is_superuser):
            raise permissions.PermissionDenied("Vous n'êtes pas le propriétaire de cette formation.")
        serializer.save()

# Gère les questionnaires (quiz) liés aux formations
class QuizViewSet(viewsets.ModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    
    def perform_create(self, serializer):
       # Vérifie la propriété avant la création
       slideshow = serializer.validated_data.get('slideshow')
       if slideshow and slideshow.creator != self.request.user and not (self.request.user.is_staff or self.request.user.is_superuser):
           raise permissions.PermissionDenied("Vous n'êtes pas le propriétaire de cette formation.")
       serializer.save()

# Gère les questions d'un quiz
class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    
    def perform_create(self, serializer):
        quiz = serializer.validated_data.get('quiz')
        if quiz.slideshow.creator != self.request.user and not (self.request.user.is_staff or self.request.user.is_superuser):
            raise permissions.PermissionDenied("Vous n'êtes pas le propriétaire de ce quiz.")
        serializer.save()

# Gère les choix de réponse possibles pour une question
class ChoiceViewSet(viewsets.ModelViewSet):
    queryset = Choice.objects.all()
    serializer_class = ChoiceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        question = serializer.validated_data.get('question')
        if question.quiz.slideshow.creator != self.request.user and not (self.request.user.is_staff or self.request.user.is_superuser):
            raise permissions.PermissionDenied("Vous n'êtes pas le propriétaire de cette question.")
        serializer.save()

