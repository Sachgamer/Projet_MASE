import random
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
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

# Gère la vérification du code 2FA reçu par l'utilisateur
class Verify2FAView(APIView):
    # Autorise tout utilisateur à tenter la vérification
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = Verify2FASerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            code = serializer.validated_data['code']
            
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({'detail': 'Bad request'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Vérifie si le code est correct et non expiré
            if user.two_factor_code != code:
                return Response({'detail': 'Code invalide.'}, status=status.HTTP_400_BAD_REQUEST)
                
            if user.two_factor_code_expires_at and user.two_factor_code_expires_at < timezone.now():
                return Response({'detail': 'Code expiré.'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Efface le code après usage
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

# Permet d'afficher la liste des utilisateurs (réservé aux administrateurs)
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
