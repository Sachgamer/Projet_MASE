
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.http import FileResponse
from django.utils import timezone
from .models import Slideshow, Quiz, Slide, Question, Choice
from .serializers import SlideshowSerializer, QuizSerializer, SlideSerializer, QuestionSerializer, ChoiceSerializer
from .utils import generate_quiz_pdf, send_invitation_email

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

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Slideshow.objects.none()
        if user.is_staff or user.is_superuser:
            return self.queryset.all().order_by('-created_at')
        from django.db.models import Q
        return self.queryset.filter(
            Q(is_public=True) | Q(invited_users=user) | Q(creator=user)
        ).distinct().order_by('-created_at')

    def perform_create(self, serializer):
        # Enregistre le créateur lors de la création
        slideshow = serializer.save(creator=self.request.user)
        # Envoyer l'email d'invitation à chaque utilisateur invité
        for user in slideshow.invited_users.all():
            send_invitation_email(user, slideshow)

    def perform_update(self, serializer):
        instance = self.get_object()
        # Conserver la liste des IDs des invités actuels avant la mise à jour
        old_invited_ids = set(instance.invited_users.values_list('id', flat=True))
        
        slideshow = serializer.save()
        
        # Envoyer l'email aux nouveaux invités uniquement
        for user in slideshow.invited_users.all():
            if user.id not in old_invited_ids:
                send_invitation_email(user, slideshow)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def participants_report(self, request, pk=None):
        slideshow = self.get_object()
        # Seul le créateur ou un admin peut voir le rapport de participation
        if slideshow.creator != request.user and not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied("Vous n'avez pas l'autorisation de voir ce rapport.")
            
        invited = slideshow.invited_users.all()
        quiz = getattr(slideshow, 'quiz', None)
        
        # Récupérer toutes les soumissions de quiz
        submissions = {}
        if quiz:
            from .models import QuizSubmission
            subs = QuizSubmission.objects.filter(quiz=quiz)
            for s in subs:
                submissions[s.user_id] = {
                    'score': s.score,
                    'total_questions': s.total_questions,
                    'is_passed': s.is_passed,
                    'submitted_at': timezone.localtime(s.submitted_at).strftime("%d/%m/%Y %H:%M") if s.submitted_at else None
                }
                
        report_data = []
        for u in invited:
            fullname = f"{u.first_name} {u.last_name}".strip() or u.username
            sub_info = submissions.get(u.id)
            report_data.append({
                'id': u.id,
                'username': u.username,
                'fullname': fullname,
                'email': u.email,
                'quiz_status': {
                    'completed': sub_info is not None,
                    'score': sub_info['score'] if sub_info else None,
                    'total_questions': sub_info['total_questions'] if sub_info else None,
                    'is_passed': sub_info['is_passed'] if sub_info else False,
                    'submitted_at': sub_info['submitted_at'] if sub_info else None
                }
            })
            
        return Response(report_data)

# Gère les diapos contenues dans les formations
class SlideViewSet(viewsets.ModelViewSet):
    queryset = Slide.objects.all()
    serializer_class = SlideSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        # Vérifie que l'utilisateur est bien le propriétaire de la formation avant d'ajouter une diapo
        slideshow = serializer.validated_data.get('slideshow')
        if slideshow.creator != self.request.user and not (self.request.user.is_staff or self.request.user.is_superuser):
            raise PermissionDenied("Vous n'êtes pas le propriétaire de cette formation.")
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
           raise PermissionDenied("Vous n'êtes pas le propriétaire de cette formation.")
       serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def generate_pdf(self, request, pk=None):
        quiz = self.get_object()
        user_answers = request.data.get('answers', [])
        
        # Associer question_id -> choice_id
        answers_dict = {}
        for a in user_answers:
            if isinstance(a, dict) and 'question_id' in a and 'choice_id' in a:
                try:
                    answers_dict[int(a['question_id'])] = int(a['choice_id'])
                except (ValueError, TypeError):
                    continue

        # Récupérer toutes les questions et choix pour ce quiz
        questions = quiz.questions.all().prefetch_related('choices')
        
        score = 0
        total_questions = len(questions)
        qa_pairs = []
        
        for q in questions:
            user_choice_id = answers_dict.get(q.id)
            user_choice_text = "Pas de réponse"
            is_correct = False
            
            # Recherche de la réponse de l'utilisateur parmi les choix de la question
            for choice in q.choices.all():
                if choice.id == user_choice_id:
                    user_choice_text = choice.text
                    is_correct = choice.is_correct
                    break
            
            if is_correct:
                score += 1
                
            qa_pairs.append({
                'question_text': q.text,
                'answer_text': user_choice_text,
                'is_correct': is_correct
            })
            
        # Un quiz est réussi si le score est supérieur ou égal au score de passage requis
        is_passed = score >= quiz.passing_score
        signature = request.data.get('signature', '')
        
        # Enregistrer la soumission dans la base de données
        from .models import QuizSubmission
        QuizSubmission.objects.update_or_create(
            user=request.user,
            quiz=quiz,
            defaults={
                'score': score,
                'total_questions': total_questions,
                'is_passed': is_passed,
                'signature': signature
            }
        )
        
        user_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
        date_str = timezone.localtime().strftime("%d/%m/%Y %H:%M")
        causerie_title = quiz.slideshow.title
        
        buffer = generate_quiz_pdf(
            user_name=user_name,
            date_str=date_str,
            causerie_title=causerie_title,
            score=score,
            total_questions=total_questions,
            is_passed=is_passed,
            qa_pairs=qa_pairs,
            signature_base64=signature
        )

        
        import re
        username = request.user.username if request.user else 'unknown'
        date_str = timezone.localtime().strftime('%Y%m%d')
        quiz_name = re.sub(r'[^\w\-_\.]', '', quiz.slideshow.title.replace(' ', '-'))
        filename = f"{username}_{date_str}_{quiz_name}.pdf"
        
        return FileResponse(buffer, as_attachment=True, filename=filename)

# Gère les questions d'un quiz
class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    
    def perform_create(self, serializer):
        quiz = serializer.validated_data.get('quiz')
        if quiz.slideshow.creator != self.request.user and not (self.request.user.is_staff or self.request.user.is_superuser):
            raise PermissionDenied("Vous n'êtes pas le propriétaire de ce quiz.")
        serializer.save()

# Gère les choix de réponse possibles pour une question
class ChoiceViewSet(viewsets.ModelViewSet):
    queryset = Choice.objects.all()
    serializer_class = ChoiceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        question = serializer.validated_data.get('question')
        if question.quiz.slideshow.creator != self.request.user and not (self.request.user.is_staff or self.request.user.is_superuser):
            raise PermissionDenied("Vous n'êtes pas le propriétaire de cette question.")
        serializer.save()

