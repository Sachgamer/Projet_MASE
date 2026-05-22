import random
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from dj_rest_auth.views import LoginView
from .models import User
from .serializers import UserSerializer, Verify2FASerializer

# Gère la connexion personnalisée avec envoi de code 2FA par email
class CustomLoginView(LoginView):
    # Traite la requête de connexion de l'utilisateur
    def post(self, request, *args, **kwargs):
        self.request = request
        self.serializer = self.get_serializer(data=self.request.data)
        self.serializer.is_valid(raise_exception=True)
        self.login()
        user = self.user
        
        # Génère un code aléatoire à 6 chiffres
        code = str(random.randint(100000, 999999))
        user.two_factor_code = code
        user.two_factor_code_expires_at = timezone.now() + timedelta(minutes=10)
        user.save()
        
        # Envoie le code de sécurité par email à l'utilisateur
        send_mail(
            'Votre code de connexion WebMASE',
            f'Votre code de sécurité est : {code}. Il est valable 10 minutes.',
            'noreply@webmase.com',
            [user.email],
            fail_silently=False,
        )
        
        # Indique au site qu'une validation 2FA est maintenant requise
        return Response({'detail': '2FA validation required', 'username': user.username}, status=status.HTTP_202_ACCEPTED)

from rest_framework.throttling import ScopedRateThrottle

# Gère la vérification du code 2FA reçu par l'utilisateur
class Verify2FAView(APIView):
    # Autorise tout utilisateur à tenter la vérification
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'verify_2fa'
    
    def post(self, request):
        serializer = Verify2FASerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            code = serializer.validated_data['code']
            
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({'detail': 'Bad request'}, status=status.HTTP_400_BAD_REQUEST)
                
            from django.core.cache import cache
            cache_key = f"2fa_attempts_{username}"
            attempts = cache.get(cache_key, 0)
            
            # Si le code a déjà été invalidé ou expiré
            if not user.two_factor_code:
                return Response({'detail': 'Aucun code actif trouvé. Veuillez vous reconnecter.'}, status=status.HTTP_400_BAD_REQUEST)
                
            if attempts >= 3:
                # Invalidation du code
                user.two_factor_code = None
                user.two_factor_code_expires_at = None
                user.save()
                return Response({'detail': 'Trop de tentatives infructueuses. Veuillez générer un nouveau code en vous reconnectant.'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Vérifie si le code est expiré d'abord
            if user.two_factor_code_expires_at and user.two_factor_code_expires_at < timezone.now():
                user.two_factor_code = None
                user.two_factor_code_expires_at = None
                user.save()
                return Response({'detail': 'Code de sécurité expiré. Veuillez vous reconnecter.'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Vérifie si le code est correct
            if user.two_factor_code != code:
                attempts += 1
                cache.set(cache_key, attempts, timeout=600) # Expire après 10 min
                
                if attempts >= 3:
                    # Invalidation immédiate après 3 échecs
                    user.two_factor_code = None
                    user.two_factor_code_expires_at = None
                    user.save()
                    cache.delete(cache_key)
                    return Response({'detail': 'Trop de tentatives infructueuses. Ce code a été désactivé pour des raisons de sécurité.'}, status=status.HTTP_400_BAD_REQUEST)
                    
                return Response({'detail': f'Code de sécurité incorrect. Il vous reste {3 - attempts} tentative(s).'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Code correct : réinitialiser le compteur et effacer le code 2FA
            cache.delete(cache_key)
            user.two_factor_code = None
            user.two_factor_code_expires_at = None
            user.save()
            
            # Génère et renvoie le jeton (token) de connexion final
            from rest_framework.authtoken.models import Token
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'key': token.key,
                'user': UserSerializer(user).data
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Déconnecte l'utilisateur en supprimant son token d'authentification
class CustomLogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Supprime le token de l'utilisateur pour invalider la session
        try:
            request.user.auth_token.delete()
        except Token.DoesNotExist:
            pass
        return Response({'detail': 'Déconnecté avec succès.'}, status=status.HTTP_200_OK)

# Permet d'afficher la liste des utilisateurs (réservé aux administrateurs)
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
