from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone
from datetime import timedelta
from .models import AccidentReport, WorkSite, Action
from .serializers import AccidentReportSerializer, WorkSiteSerializer, ActionSerializer
from .utils import generate_accident_pdf


class WorkSiteViewSet(viewsets.ModelViewSet):
    queryset = WorkSite.objects.all()
    serializer_class = WorkSiteSerializer

    def get_permissions(self):
        # Permettre aux utilisateurs authentifiés de lister et créer des chantiers (pour l'ajout en direct)
        if self.action in ['list', 'create', 'retrieve']:
            return [permissions.IsAuthenticated()]
        # Seuls les admins peuvent modifier/supprimer des chantiers
        return [permissions.IsAdminUser()]

# Définit qui peut voir ou créer des rapports d'accident
class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.method == 'DELETE':
            return request.user.is_staff or request.user.is_superuser
        return obj.reporter == request.user or request.user.is_staff or request.user.is_superuser

# Gère la consultation et la création de rapports d'accident
class AccidentReportViewSet(viewsets.ModelViewSet):
    serializer_class = AccidentReportSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return AccidentReport.objects.filter(is_deleted=False)
        if user.agency:
            return AccidentReport.objects.filter(is_deleted=False, reporter__agency=user.agency)
        return AccidentReport.objects.filter(is_deleted=False, reporter=user)

    def perform_create(self, serializer):
        # Récupère toutes les photos envoyées dans le champ 'photos'
        photos = self.request.FILES.getlist('photos')
        
        # Pour la rétrocompatibilité, associe la première photo au champ principal 'image'
        first_image = None
        if photos:
            first_image = photos[0]
        else:
            # Fallback si seule l'image unique est fournie
            first_image = self.request.FILES.get('image')
            
        # Enregistre le rapport avec l'utilisateur actuel comme auteur
        # Par défaut, on force le rapport à n'est pas "publié" tant qu'un admin ne le valide pas
        report = serializer.save(reporter=self.request.user, published=False, image=first_image)
        
        # Enregistre toutes les photos dans le modèle AccidentReportPhoto
        from .models import AccidentReportPhoto
        if photos:
            for photo in photos:
                AccidentReportPhoto.objects.create(report=report, image=photo)
        elif first_image:
            AccidentReportPhoto.objects.create(report=report, image=first_image)

    @action(detail=True, methods=['get'])
    def generate_pdf(self, request, pk=None):
        report = self.get_object()
        buffer = generate_accident_pdf(report)
        from django.utils import timezone
        local_date = timezone.localtime(report.created_at) if report.created_at else timezone.localtime()
        
        username = report.reporter.username if report.reporter else 'unknown'
        date_str = local_date.strftime('%Y%m%d')
        filename = f"{username}_-{date_str}_Remontées-Accident.pdf"
        
        return FileResponse(buffer, as_attachment=True, filename=filename)

class ActionViewSet(viewsets.ModelViewSet):
    serializer_class = ActionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return Action.objects.all()
        if user.agency:
            return Action.objects.filter(
                Q(assigned_to__agency=user.agency) | Q(reporter__agency=user.agency) | Q(assigned_to=user) | Q(reporter=user)
            ).distinct()
        return Action.objects.filter(Q(assigned_to=user) | Q(reporter=user)).distinct()

    def perform_create(self, serializer):
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Seuls les administrateurs peuvent créer des actions.")
        serializer.save(reporter=self.request.user)

    def perform_update(self, serializer):
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Seuls les administrateurs peuvent modifier des actions.")
        serializer.save()

    def perform_destroy(self, instance):
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Seuls les administrateurs peuvent supprimer des actions.")
        instance.delete()

    @action(detail=True, methods=['post'])
    def prolong(self, request, pk=None):
        action_item = self.get_object()
        if action_item.assigned_to != request.user and action_item.reporter != request.user and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': "Vous n'avez pas l'autorisation de prolonger cette action."}, status=status.HTTP_403_FORBIDDEN)
        
        if not action_item.due_date:
            action_item.due_date = timezone.now().date()
            
        action_item.due_date = action_item.due_date + timedelta(days=30)
        action_item.save()
        return Response({
            'detail': 'Date d\'échéance de l\'action prolongée de 30 jours.',
            'new_due_date': action_item.due_date
        }, status=status.HTTP_200_OK)

from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum
from controls.models import Inspection
from slideshows.models import QuizSubmission
from users.models import User

class HseStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        months_data = []
        
        # Déterminer les heures travaillées mensuelles basées sur le nombre de techniciens actifs
        active_users = User.objects.filter(is_active=True).count() or 10
        worked_hours_per_month = active_users * 150
        
        for i in range(5, -1, -1):
            # Calculer l'année et le mois cibles en reculant de i mois de manière 100% robuste
            target_year = now.year
            target_month = now.month - i
            while target_month <= 0:
                target_month += 12
                target_year -= 1
                
            first_day_of_curr_month = timezone.make_aware(
                timezone.datetime(target_year, target_month, 1, 0, 0, 0)
            )
            
            # Calculer le premier jour du mois suivant pour délimiter le dernier jour
            next_month = target_month + 1
            next_year = target_year
            if next_month > 12:
                next_month = 1
                next_year += 1
                
            next_month_first_day = timezone.make_aware(
                timezone.datetime(next_year, next_month, 1, 0, 0, 0)
            )
            last_day_of_curr_month = next_month_first_day - timedelta(seconds=1)
            
            # Nom français du mois pour l'affichage
            month_names_fr = {
                1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
                7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre"
            }
            month_name = f"{month_names_fr.get(first_day_of_curr_month.month)} {first_day_of_curr_month.year}"
            
            # Récupérer les rapports d'accidents du mois
            accidents_in_month = AccidentReport.objects.filter(
                incident_date__gte=first_day_of_curr_month,
                incident_date__lte=last_day_of_curr_month
            )
            
            accidents_count = accidents_in_month.filter(incident_type='accident').count()
            fatal_accidents_count = accidents_in_month.filter(incident_type='fatal_accident').count()
            near_miss_count = accidents_in_month.filter(incident_type='near_miss').count()
            dangerous_sit_count = accidents_in_month.filter(incident_type='dangerous_situation').count()
            
            total_accidents_with_stop = accidents_count + fatal_accidents_count
            
            # Taux de Fréquence (TF) = (accidents * 1M) / heures travaillées
            tf = (total_accidents_with_stop * 1000000) / worked_hours_per_month if worked_hours_per_month > 0 else 0
            
            # Taux de Gravité (TG) = (jours perdus * 1k) / heures travaillées
            days_lost_sum = accidents_in_month.aggregate(total_days=Sum('days_lost'))['total_days'] or 0
            tg = (days_lost_sum * 1000) / worked_hours_per_month if worked_hours_per_month > 0 else 0
            
            # Statistiques des auto-contrôles
            inspections_in_month = Inspection.objects.filter(
                date__gte=first_day_of_curr_month,
                date__lte=last_day_of_curr_month
            )
            total_inspections = inspections_in_month.count()
            valid_inspections = inspections_in_month.filter(is_valid=True).count()
            invalid_inspections = total_inspections - valid_inspections
            
            # Statistiques quiz / formations
            quiz_subs_in_month = QuizSubmission.objects.filter(
                submitted_at__gte=first_day_of_curr_month,
                submitted_at__lte=last_day_of_curr_month
            )
            total_quiz = quiz_subs_in_month.count()
            passed_quiz = quiz_subs_in_month.filter(is_passed=True).count()
            
            months_data.append({
                'month': month_name,
                'year': first_day_of_curr_month.year,
                'month_num': first_day_of_curr_month.month,
                'worked_hours': worked_hours_per_month,
                'incidents': {
                    'accident': accidents_count,
                    'fatal': fatal_accidents_count,
                    'near_miss': near_miss_count,
                    'dangerous_situation': dangerous_sit_count,
                    'total': accidents_in_month.count()
                },
                'tf': round(tf, 2),
                'tg': round(tg, 2),
                'days_lost': days_lost_sum,
                'inspections': {
                    'total': total_inspections,
                    'valid': valid_inspections,
                    'invalid': invalid_inspections,
                    'compliance_rate': round((valid_inspections / total_inspections * 100), 1) if total_inspections > 0 else 100.0
                },
                'quiz': {
                    'total': total_quiz,
                    'passed': passed_quiz,
                    'pass_rate': round((passed_quiz / total_quiz * 100), 1) if total_quiz > 0 else 100.0
                }
            })
            
        # Statistiques globales des actions
        actions_stats = {
            'todo': Action.objects.filter(status='todo').count(),
            'in_progress': Action.objects.filter(status='in_progress').count(),
            'done': Action.objects.filter(status='done').count(),
            'total': Action.objects.count()
        }
            
        return Response({
            'months': months_data,
            'actions': actions_stats,
            'active_users': active_users,
            'worked_hours_monthly': worked_hours_per_month
        })


class UserDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        today = now.date()

        # 1. Prochain autocontrôle
        from controls.models import EquipmentItem, Inspection
        active_items = EquipmentItem.objects.filter(technician=user, is_active=True, expiration_date__isnull=False)
        next_autocontrol = active_items.order_by('expiration_date').first()
        next_autocontrol_date = next_autocontrol.expiration_date.strftime('%Y-%m-%d') if next_autocontrol else None

        # 2. Future causerie du profil
        from slideshows.models import Slideshow, QuizSubmission
        upcoming_causeries_qs = Slideshow.objects.filter(
            Q(scheduled_date__gt=now) & (Q(is_public=True) | Q(invited_users=user) | Q(creator=user))
        ).distinct().order_by('scheduled_date')
        next_causerie = upcoming_causeries_qs.first()
        next_causerie_info = {
            'id': next_causerie.id,
            'title': next_causerie.title,
            'scheduled_date': next_causerie.scheduled_date.isoformat()
        } if next_causerie else None

        # 3. Taux de conformité des auto-contrôles
        user_inspections = Inspection.objects.filter(item__technician=user)
        total_inspections = user_inspections.count()
        if total_inspections > 0:
            valid_inspections = user_inspections.filter(is_valid=True).count()
            compliance_rate = round((valid_inspections / total_inspections) * 100, 1)
        else:
            compliance_rate = None  # Frontend matches N/A

        # 4. Réussite Formations (pass rate)
        user_submissions = QuizSubmission.objects.filter(user=user)
        total_subs = user_submissions.count()
        if total_subs > 0:
            passed_subs = user_submissions.filter(is_passed=True).count()
            quiz_pass_rate = round((passed_subs / total_subs) * 100, 1)
        else:
            quiz_pass_rate = 100.0

        # 5. Dernière causerie
        all_visible_causeries = Slideshow.objects.filter(
            Q(is_public=True) | Q(invited_users=user) | Q(creator=user)
        ).distinct().order_by('-created_at')
        latest_causerie = all_visible_causeries.first()
        latest_causerie_info = {
            'id': latest_causerie.id,
            'title': latest_causerie.title,
            'description': latest_causerie.description,
            'creator': latest_causerie.creator.username,
            'created_at': latest_causerie.created_at.isoformat()
        } if latest_causerie else None

        # 6. Causeries à venir (upcoming list)
        upcoming_list = []
        for c in upcoming_causeries_qs[:5]:
            upcoming_list.append({
                'id': c.id,
                'title': c.title,
                'scheduled_date': c.scheduled_date.isoformat()
            })

        # 7. Actions faites et à faire
        user_actions = Action.objects.filter(assigned_to=user)
        todo_actions = user_actions.filter(status__in=['todo', 'in_progress']).order_by('due_date')
        done_actions = user_actions.filter(status='done').order_by('-updated_at')

        def serialize_action(act):
            return {
                'id': act.id,
                'title': act.title,
                'description': act.description,
                'status': act.status,
                'priority': act.priority,
                'due_date': act.due_date.strftime('%Y-%m-%d') if act.due_date else None,
                'created_at': act.created_at.isoformat()
            }

        return Response({
            'next_autocontrol': next_autocontrol_date,
            'next_causerie': next_causerie_info,
            'compliance_rate': compliance_rate,
            'quiz_pass_rate': quiz_pass_rate,
            'latest_causerie': latest_causerie_info,
            'upcoming_causeries': upcoming_list,
            'actions': {
                'todo': [serialize_action(a) for a in todo_actions],
                'done': [serialize_action(a) for a in done_actions]
            }
        })


