from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Slideshow, Slide, Quiz, Question, Choice

User = get_user_model()

# Transforme les choix de réponse en JSON
class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ['id', 'question', 'text', 'is_correct']

# Transforme les questions (avec leurs choix) en JSON
class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'quiz', 'text', 'order', 'choices']

    def validate(self, attrs):
        quiz = attrs.get('quiz')
        if quiz:
            # Si on crée une nouvelle question
            if not self.instance:
                if quiz.questions.count() >= 10:
                    raise serializers.ValidationError({"quiz": "Un quiz ne peut pas contenir plus de 10 questions."})
        return attrs

# Transforme un Quiz (avec ses questions) en JSON
class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    user_submissions = serializers.SerializerMethodField()
    average_score = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['id', 'slideshow', 'title', 'passing_score', 'questions', 'user_submissions', 'average_score']

    def get_user_submissions(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            from .models import QuizSubmission
            subs = QuizSubmission.objects.filter(quiz=obj, user=request.user).order_by('submitted_at')
            return [{
                'id': s.id,
                'score': s.score,
                'total_questions': s.total_questions,
                'is_passed': s.is_passed,
                'submitted_at': s.submitted_at
            } for s in subs]
        return []

    def get_average_score(self, obj):
        from .models import QuizSubmission
        from django.db.models import Avg
        avg = QuizSubmission.objects.filter(quiz=obj).aggregate(avg=Avg('score'))['avg']
        return round(avg, 1) if avg is not None else None

# Transforme une Diapositive en JSON
class SlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = Slide
        fields = ['id', 'slideshow', 'file', 'content', 'order']

# Transforme une Formation entière (avec diapos et quiz) en JSON
class SlideshowSerializer(serializers.ModelSerializer):
    slides = SlideSerializer(many=True, read_only=True)
    quiz = QuizSerializer(read_only=True)
    creator = serializers.ReadOnlyField(source='creator.username')
    invited_users = serializers.PrimaryKeyRelatedField(many=True, queryset=User.objects.all(), required=False)

    class Meta:
        model = Slideshow
        fields = ['id', 'title', 'description', 'creator', 'created_at', 'slides', 'quiz', 'is_public', 'invited_users', 'scheduled_date']
        read_only_fields = ['creator', 'created_at']


from .models import QuizSubmission

class QuizSubmissionSerializer(serializers.ModelSerializer):
    user_fullname = serializers.SerializerMethodField()
    quiz_title = serializers.ReadOnlyField(source='quiz.title')

    class Meta:
        model = QuizSubmission
        fields = ['id', 'quiz', 'quiz_title', 'user', 'user_fullname', 'score', 'total_questions', 'is_passed', 'signed_pdf', 'signature', 'submitted_at']

    def get_user_fullname(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
