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


class SlideshowVisibilityAndParticipationTestCase(APITestCase):
    def setUp(self):
        # Création des utilisateurs
        self.creator = User.objects.create_user(username='creator', email='creator@example.com', password='password123')
        self.invited_user = User.objects.create_user(username='invited', email='invited@example.com', password='password123')
        self.uninvited_user = User.objects.create_user(username='uninvited', email='uninvited@example.com', password='password123')
        
        # Causerie publique
        self.public_slideshow = Slideshow.objects.create(
            title='Causerie Publique',
            description='Visible par tous',
            creator=self.creator,
            is_public=True
        )
        
        # Causerie privée
        self.private_slideshow = Slideshow.objects.create(
            title='Causerie Privée',
            description='Restreint aux invités',
            creator=self.creator,
            is_public=False
        )
        self.private_slideshow.invited_users.add(self.invited_user)
        
        # Quiz lié
        self.quiz = Quiz.objects.create(slideshow=self.private_slideshow, title='Quiz Privé', passing_score=1)
        self.question = Question.objects.create(quiz=self.quiz, text="Q1", order=1)
        self.choice = Choice.objects.create(question=self.question, text="C1", is_correct=True)

    def test_slideshow_visibility_list(self):
        # 1. Utilisateur non invité
        self.client.force_authenticate(user=self.uninvited_user)
        response = self.client.get('/api/slideshows/')
        self.assertEqual(response.status_code, 200)
        # Ne doit voir que la causerie publique
        results = response.data.get('results') if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.public_slideshow.id)
        
        # 2. Utilisateur invité
        self.client.force_authenticate(user=self.invited_user)
        response = self.client.get('/api/slideshows/')
        results = response.data.get('results') if isinstance(response.data, dict) else response.data
        # Doit voir la causerie publique ET la causerie privée où il est invité
        self.assertEqual(len(results), 2)
        
    def test_quiz_submission_recorded_and_report_generated(self):
        # 1. Soumettre le quiz pour l'utilisateur invité (générer le PDF)
        self.client.force_authenticate(user=self.invited_user)
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
        
        # 2. Vérifier que la soumission est enregistrée en BDD
        from .models import QuizSubmission
        self.assertTrue(QuizSubmission.objects.filter(user=self.invited_user, quiz=self.quiz).exists())
        sub = QuizSubmission.objects.get(user=self.invited_user, quiz=self.quiz)
        self.assertEqual(sub.score, 1)
        self.assertTrue(sub.is_passed)
        
        # 3. Vérifier le rapport de participation pour le créateur (200 OK)
        self.client.force_authenticate(user=self.creator)
        report_url = f"/api/slideshows/{self.private_slideshow.id}/participants_report/"
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['username'], 'invited')
        self.assertTrue(response.data[0]['quiz_status']['completed'])
        self.assertEqual(response.data[0]['quiz_status']['score'], 1)
        
        # 4. Vérifier que l'utilisateur invité (non créateur) n'a pas accès au rapport de participation (403 Forbidden)
        self.client.force_authenticate(user=self.invited_user)
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, 403)
