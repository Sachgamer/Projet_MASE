from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase
from .models import Slideshow, Quiz, Question, Choice
from .serializers import QuestionSerializer

User = get_user_model()

class QuizQuestionLimitTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='creator',
            email='creator@example.com',
            password='password123'
        )
        self.slideshow = Slideshow.objects.create(
            title='Causerie Sécurité',
            description='Test slideshow',
            creator=self.user
        )
        self.quiz = Quiz.objects.create(
            slideshow=self.slideshow,
            title='Quiz de test',
            passing_score=8
        )

    def test_cannot_add_more_than_ten_questions_via_serializer(self):
        # Ajouter 10 questions au quiz
        for i in range(10):
            Question.objects.create(
                quiz=self.quiz,
                text=f"Question {i+1}",
                order=i+1
            )
            
        self.assertEqual(self.quiz.questions.count(), 10)
        
        # Tenter d'ajouter la 11ème question via le serializer
        serializer = QuestionSerializer(data={
            'quiz': self.quiz.id,
            'text': "Question 11",
            'order': 11
        })
        
        # Le serializer doit être invalide à cause de la limite de 10
        self.assertFalse(serializer.is_valid())
        self.assertIn('quiz', serializer.errors)
        self.assertEqual(str(serializer.errors['quiz'][0]), "Un quiz ne peut pas contenir plus de 10 questions.")


class QuizPDFGenerationTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='user',
            email='user@example.com',
            password='password123',
            first_name='Jean',
            last_name='Dupont'
        )
        self.slideshow = Slideshow.objects.create(
            title='Causerie Sécurité',
            description='Test slideshow',
            creator=self.user
        )
        self.quiz = Quiz.objects.create(
            slideshow=self.slideshow,
            title='Quiz de test',
            passing_score=1
        )
        self.question = Question.objects.create(
            quiz=self.quiz,
            text="Quelle est la règle ?",
            order=1
        )
        self.choice = Choice.objects.create(
            question=self.question,
            text="Porter ses EPI",
            is_correct=True
        )
        
    def test_generate_pdf_endpoint_returns_pdf(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/quizzes/{self.quiz.id}/generate_pdf/"
        payload = {
            "answers": [
                {
                    "question_id": self.question.id,
                    "choice_id": self.choice.id
                }
            ]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
