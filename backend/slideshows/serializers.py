from rest_framework import serializers
from .models import Slideshow, Slide, Quiz, Question, Choice

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

    class Meta:
        model = Slideshow
        fields = ['id', 'title', 'description', 'creator', 'created_at', 'slides', 'quiz']
        read_only_fields = ['creator', 'created_at']
