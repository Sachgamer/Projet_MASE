"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from slideshows.views import SlideshowViewSet, QuizViewSet, SlideViewSet, QuestionViewSet, ChoiceViewSet
from files.views import PersonalFileViewSet
from reports.views import AccidentReportViewSet

router = DefaultRouter()
router.register(r'slideshows', SlideshowViewSet)
router.register(r'slides', SlideViewSet)
router.register(r'quizzes', QuizViewSet)
router.register(r'questions', QuestionViewSet)
router.register(r'choices', ChoiceViewSet)
router.register(r'files', PersonalFileViewSet, basename='personal-file')
router.register(r'reports', AccidentReportViewSet, basename='accident-report')

from users.views import UserViewSet, CustomLoginView, Verify2FAView
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', RedirectView.as_view(url='/api/', permanent=False)),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/controls/', include('controls.urls')),


    path('auth/login/', CustomLoginView.as_view(), name='custom_login'),
    path('auth/verify-2fa/', Verify2FAView.as_view(), name='verify_2fa'),
    path('auth/', include('dj_rest_auth.urls')),
    # path('auth/registration/', include('dj_rest_auth.registration.urls')), # Registration disabled

    # Swagger docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) # Assuming STATIC_ROOT is set if needed, but STATIC_URL is enough for dev usually
