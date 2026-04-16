from django.contrib import admin
from .models import Slideshow, Slide, Quiz, Question, Choice

class SlideInline(admin.TabularInline):
    model = Slide
    extra = 1

class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 3

class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1

class QuizInline(admin.StackedInline):
    model = Quiz

@admin.register(Slideshow)
class SlideshowAdmin(admin.ModelAdmin):
    inlines = [SlideInline, QuizInline]
    list_display = ('title', 'creator', 'created_at')

@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    inlines = [QuestionInline]

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    inlines = [ChoiceInline]

admin.site.register(Slide)
admin.site.register(Choice)
