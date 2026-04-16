from django.db import models
from django.conf import settings

# Représente un diaporama de formation (ex: Sécurité au travail)
class Slideshow(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    # Utilisateur qui a créé la formation
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

# Représente une page (diapositive) spécifique d'un diaporama
class Slide(models.Model):
    slideshow = models.ForeignKey(Slideshow, related_name='slides', on_delete=models.CASCADE)
    # Fichier image ou document de la diapo
    file = models.FileField(upload_to='slides/', null=True)
    # Texte explicatif optionnel
    content = models.TextField(blank=True) 
    # Ordre d'affichage de la diapo
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.slideshow.title} - Slide {self.order}"

# Représente le questionnaire lié à un diaporama
class Quiz(models.Model):
    slideshow = models.OneToOneField(Slideshow, related_name='quiz', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    # Score minimum pour réussir le test
    passing_score = models.PositiveIntegerField(default=10)

    def __str__(self):
        return self.title

# Représente une question posée dans un quiz
class Question(models.Model):
    quiz = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.text

# Représente un choix de réponse pour une question
class Choice(models.Model):
    question = models.ForeignKey(Question, related_name='choices', on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    # Indique si cette réponse est la bonne
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text
