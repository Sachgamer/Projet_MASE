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

    class Meta:
        model = Quiz
        fields = ['id', 'slideshow', 'title', 'passing_score', 'questions']

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
        fields = ['id', 'title', 'description', 'creator', 'created_at', 'slides', 'quiz', 'is_public', 'invited_users']
        read_only_fields = ['creator', 'created_at']
