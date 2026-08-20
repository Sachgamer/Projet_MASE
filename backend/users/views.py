import random
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from dj_rest_auth.views import LoginView
from .models import User, BlockedMacAddress, Habilitation, Agency, ViewPermission
from .serializers import UserSerializer, Verify2FASerializer, BlockedMacAddressSerializer, HabilitationSerializer, AgencySerializer, ViewPermissionSerializer


# Gère la connexion personnalisée avec envoi de code 2FA par email
class CustomLoginView(LoginView):
    # Traite la requête de connexion de l'utilisateur
    def post(self, request, *args, **kwargs):
        mac_address = request.data.get('mac_address', '')
        if isinstance(mac_address, str):
            mac_address = mac_address.upper()
        else:
            mac_address = ''
        if mac_address and BlockedMacAddress.objects.filter(mac_address=mac_address, is_active=True).exists():
            return Response({
                'detail': "Cette machine a été bloquée après trop de tentatives infructueuses. Contactez l'administrateur."
            }, status=status.HTTP_403_FORBIDDEN)

        self.request = request
        self.serializer = self.get_serializer(data=self.request.data)
        
        try:
            self.serializer.is_valid(raise_exception=True)
            self.login()
        except Exception as e:
            if mac_address:
                from django.core.cache import cache
                cache_key = f"failed_attempts_{mac_address}"
                attempts = cache.get(cache_key, 0) + 1
                cache.set(cache_key, attempts, timeout=600)  # Expire après 10 min
                
                if attempts >= 5:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    user_obj = None
                    username = request.data.get('username', '')
                    if username:
                        try:
                            user_obj = User.objects.get(username=username)
                        except User.DoesNotExist:
                            try:
                                user_obj = User.objects.get(email=username)
                            except User.DoesNotExist:
                                pass
                    
                    BlockedMacAddress.objects.get_or_create(
                        mac_address=mac_address,
                        defaults={
                            'user': user_obj,
                            'reason': f"Trop de tentatives de mot de passe infructueuses pour {username}" if username else "Trop de tentatives de mot de passe infructueuses",
                            'failed_attempts': 5,
                            'notes': f"Tentatives de mot de passe bloquées le {timezone.localtime().strftime('%d/%m/%Y à %H:%M')}"
                        }
                    )
                    cache.delete(cache_key)
                    return Response({
                        'detail': "Trop de tentatives infructueuses. Votre machine a été bloquée. Contactez l'administrateur."
                    }, status=status.HTTP_403_FORBIDDEN)
            raise e

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
            mac_address = serializer.validated_data.get('mac_address', '')
            if isinstance(mac_address, str):
                mac_address = mac_address.upper()
            else:
                mac_address = ''
            
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({'detail': 'Bad request'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Vérifie si cette adresse MAC est bloquée
            if mac_address and BlockedMacAddress.objects.filter(mac_address=mac_address, is_active=True).exists():
                return Response({
                    'detail': 'Cette machine a été bloquée après trop de tentatives infructueuses. Contactez l\'administrateur.'
                }, status=status.HTTP_403_FORBIDDEN)
                
            from django.core.cache import cache
            cache_key = f"failed_attempts_{mac_address}" if mac_address else f"2fa_attempts_{username}"
            attempts = cache.get(cache_key, 0)
            
            # Si le code a déjà été invalidé ou expiré
            if not user.two_factor_code:
                return Response({'detail': 'Aucun code actif trouvé. Veuillez vous reconnecter.'}, status=status.HTTP_400_BAD_REQUEST)
                
            if attempts >= 5:
                # Invalidation du code et blocage de la MAC après 5 tentatives
                user.two_factor_code = None
                user.two_factor_code_expires_at = None
                user.save()
                
                # Ajoute la MAC à la liste noire si fournie
                if mac_address:
                    BlockedMacAddress.objects.get_or_create(
                        mac_address=mac_address,
                        defaults={
                            'user': user,
                            'reason': f'Trop de tentatives 2FA infructueuses pour l\'utilisateur {username}',
                            'failed_attempts': 5,
                            'notes': f'Tentatives bloquées le {timezone.localtime().strftime("%d/%m/%Y à %H:%M")}'
                        }
                    )
                
                cache.delete(cache_key)
                if mac_address:
                    cache.delete(f"2fa_attempts_{username}")
                return Response({
                    'detail': 'Trop de tentatives infructueuses. Votre machine a été bloquée. Contactez l\'administrateur.'
                }, status=status.HTTP_403_FORBIDDEN)
                
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
                
                remaining = 5 - attempts
                
                if attempts >= 5:
                    # Blocage de la MAC après 5 échecs
                    user.two_factor_code = None
                    user.two_factor_code_expires_at = None
                    user.save()
                    cache.delete(cache_key)
                    if mac_address:
                        cache.delete(f"2fa_attempts_{username}")
                    
                    # Ajoute la MAC à la liste noire
                    if mac_address:
                        BlockedMacAddress.objects.get_or_create(
                            mac_address=mac_address,
                            defaults={
                                'user': user,
                                'reason': f'Trop de tentatives 2FA infructueuses pour l\'utilisateur {username}',
                                'failed_attempts': 5,
                                'notes': f'Tentatives bloquées le {timezone.localtime().strftime("%d/%m/%Y à %H:%M")}'
                            }
                        )
                    
                    return Response({
                        'detail': 'Trop de tentatives infructueuses. Votre machine a été bloquée. Contactez l\'administrateur.'
                    }, status=status.HTTP_403_FORBIDDEN)
                    
                return Response({
                    'detail': f'Code de sécurité incorrect. Il vous reste {remaining} tentative(s).'
                }, status=status.HTTP_400_BAD_REQUEST)
                
            # Code correct : réinitialiser le compteur et effacer le code 2FA
            cache.delete(cache_key)
            if mac_address:
                cache.delete(f"2fa_attempts_{username}")
                cache.delete(f"failed_attempts_{mac_address}")
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

# Permet de gérer les utilisateurs
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), permissions.IsAdminUser()]

# Permet de gérer les agences
class AgencyViewSet(viewsets.ModelViewSet):
    queryset = Agency.objects.all().order_by('name')
    serializer_class = AgencySerializer
    permission_classes = [permissions.IsAuthenticated]

# Permet de gérer les adresses MAC bloquées (réservé aux administrateurs)
class BlockedMacAddressViewSet(viewsets.ModelViewSet):
    queryset = BlockedMacAddress.objects.all().order_by('-blocked_at')
    serializer_class = BlockedMacAddressSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

# Permet de gérer les habilitations professionnelles
class HabilitationViewSet(viewsets.ModelViewSet):
    serializer_class = HabilitationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        show_all = self.request.query_params.get('all') == 'true'
        if (user.is_staff or user.is_superuser) and show_all:
            return Habilitation.objects.all().order_by('expiration_date')
        if user.agency:
            return Habilitation.objects.filter(user__agency=user.agency).order_by('expiration_date')
        return Habilitation.objects.filter(user=user).order_by('expiration_date')

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_staff or user.is_superuser):
            serializer.save(user=user)
        else:
            serializer.save()

    @action(detail=True, methods=['post'])
    def prolong(self, request, pk=None):
        habilitation = self.get_object()
        if habilitation.user != request.user and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': "Vous n'avez pas l'autorisation de prolonger cette habilitation."}, status=status.HTTP_403_FORBIDDEN)
        
        habilitation.expiration_date = habilitation.expiration_date + timedelta(days=30)
        habilitation.save()
        return Response({
            'detail': 'Date butoir prolongée de 30 jours.',
            'new_expiration_date': habilitation.expiration_date
        }, status=status.HTTP_200_OK)


class ViewPermissionViewSet(viewsets.ModelViewSet):
    queryset = ViewPermission.objects.all()
    serializer_class = ViewPermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'my_permissions']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), permissions.IsAdminUser()]

    @action(detail=False, methods=['get'], url_path='my-permissions')
    def my_permissions(self, request):
        user = request.user
        role = getattr(user, 'role', 'technician')
        
        default_views = [
            ('hse-dashboard', 'Dashboard HSE', True, True, True),
            ('dashboard', 'Causeries', True, True, True),
            ('action-plan', 'Plan d\'Actions', True, True, True),
            ('controle', 'Auto-contrôles', True, True, True),
            ('files', 'Mes Fichiers', True, True, True),
            ('report-create', 'Faire une Remontée', True, True, True),
            ('report-list', 'Historique des Remontées', True, True, True),
            ('chemical-registry', 'Risques Chimiques / FDS', True, True, True),
            ('habilitation-list', 'Habilitations & Visites', True, True, True),
            ('periodic-visits', 'Visites Périodiques', True, True, True),
            ('user-management', 'Gestion Utilisateurs', True, False, False),
            ('auto-control-list', 'Liste des Auto-contrôles', True, False, False),
            ('admin-habilitation', 'Habilitations Admin', True, False, False),
            ('permissions-config', 'Configuration des Droits', True, False, False),
            ('archives', 'Archives Admin', True, False, False),
            ('equipment-config', 'Gestion du Parc Matériel', True, False, False),
        ]
        
        for name, label, admin, tech, agency in default_views:
            ViewPermission.objects.get_or_create(
                view_name=name,
                defaults={
                    'label': label,
                    'allow_admin': admin,
                    'allow_technician': tech,
                    'allow_agency': agency
                }
            )

        perms = ViewPermission.objects.all()
        allowed_views = []
        for p in perms:
            if role == 'admin' and p.allow_admin:
                allowed_views.append(p.view_name)
            elif role == 'technician' and p.allow_technician:
                allowed_views.append(p.view_name)
            elif role == 'agency' and p.allow_agency:
                allowed_views.append(p.view_name)

        # Enlever les doublons potentiels
        allowed_views = list(set(allowed_views))
        return Response({'allowed_views': allowed_views})

    @action(detail=False, methods=['post'], url_path='bulk-update', permission_classes=[permissions.IsAdminUser])
    def bulk_update(self, request):
        permissions_data = request.data.get('permissions', [])
        for perm in permissions_data:
            view_name = perm.get('view_name')
            allow_admin = perm.get('allow_admin')
            allow_technician = perm.get('allow_technician')
            allow_agency = perm.get('allow_agency')
            
            ViewPermission.objects.filter(view_name=view_name).update(
                allow_admin=allow_admin,
                allow_technician=allow_technician,
                allow_agency=allow_agency
            )
        return Response({'detail': 'Permissions mises à jour avec succès.'})


