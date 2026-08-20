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
        show_archived = self.request.query_params.get('archived') == 'true'
        
        # Archivage automatique 24h après clôture pour les remontées et les actions
        archive_time = timezone.now() - timedelta(hours=24)
        AccidentReport.objects.filter(is_closed=True, closed_at__lte=archive_time, is_archived=False).update(is_archived=True)
        Action.objects.filter(status='done', updated_at__lte=archive_time, is_archived=False).update(is_archived=True)
        
        qs = AccidentReport.objects.filter(is_deleted=False, is_archived=show_archived)
        if user.is_staff or user.is_superuser:
            return qs
        if user.agency:
            return qs.filter(reporter__agency=user.agency)
        return qs.filter(reporter=user)

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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def close_report(self, request, pk=None):
        report = self.get_object()
        report.is_closed = True
        report.closed_at = timezone.now()
        report.save()
        return Response({'detail': "Remontée clôturée avec succès. Elle sera archivée dans 24 heures."})

class ActionViewSet(viewsets.ModelViewSet):
    serializer_class = ActionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        show_archived = self.request.query_params.get('archived') == 'true'
        qs = Action.objects.filter(is_archived=show_archived)
        if user.is_staff or user.is_superuser:
            return qs
        if user.agency:
            return qs.filter(
                Q(assigned_to__agency=user.agency) | Q(reporter__agency=user.agency) | Q(assigned_to=user) | Q(reporter=user)
            ).distinct()
        return qs.filter(Q(assigned_to=user) | Q(reporter=user)).distinct()

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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def submit_proof(self, request, pk=None):
        action_item = self.get_object()
        if action_item.assigned_to != request.user and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': "Vous n'êtes pas le responsable de cette action."}, status=status.HTTP_403_FORBIDDEN)
        
        proof_text = request.data.get('completion_proof_text')
        proof_file = request.FILES.get('completion_proof_file')
        
        if not proof_text or not proof_file:
            return Response({'detail': "Une preuve écrite et une preuve visuelle (photo/fichier) sont obligatoires."}, status=status.HTTP_400_BAD_REQUEST)
            
        action_item.completion_proof_text = proof_text
        action_item.completion_proof_file = proof_file
        action_item.status = 'pending_validation'
        action_item.save()
        return Response({'detail': "Preuve soumise avec succès, en attente de validation par l'administrateur."})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def validate_action(self, request, pk=None):
        action_item = self.get_object()
        decision = request.data.get('decision')
        rejection_reason = request.data.get('rejection_reason', '')
        
        if decision == 'approve':
            action_item.status = 'done'
            action_item.save()
            return Response({'detail': "Action validée et clôturée avec succès."})
        elif decision == 'reject':
            action_item.status = 'in_progress'
            if rejection_reason:
                action_item.description += f"\n\n[Rejet Admin - {timezone.now().date().strftime('%d/%m/%Y')}]: {rejection_reason}"
            action_item.save()
            return Response({'detail': "Action rejetée et renvoyée en cours."})
        else:
            return Response({'detail': "Décision invalide. Choisissez 'approve' ou 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

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
        thirty_days_later = today + timedelta(days=30)

        # 1. Alertes d'expiration (J-30)
        from users.models import Habilitation
        from controls.models import EquipmentItem, Inspection
        from files.models import PeriodicVisit
        from slideshows.models import Slideshow, QuizSubmission

        expirations = []

        # Habilitations
        exp_habs = Habilitation.objects.filter(user=user, expiration_date__gte=today, expiration_date__lte=thirty_days_later)
        for h in exp_habs:
            expirations.append({
                'type': 'habilitation',
                'label': f"Votre habilitation {h.get_type_name_display()} ({h.custom_title or ''}) expire bientôt",
                'expiration_date': h.expiration_date.strftime('%Y-%m-%d'),
                'days_remaining': (h.expiration_date - today).days
            })

        # Autocontrôles
        exp_items = EquipmentItem.objects.filter(technician=user, is_active=True, expiration_date__gte=today, expiration_date__lte=thirty_days_later)
        for item in exp_items:
            expirations.append({
                'type': 'control',
                'label': f"Contrôle requis pour {item.type_name} ({item.get_category_display()})",
                'expiration_date': item.expiration_date.strftime('%Y-%m-%d'),
                'days_remaining': (item.expiration_date - today).days,
                'item_id': item.id
            })

        # Visites Périodiques
        exp_visits = PeriodicVisit.objects.filter(next_due_date__gte=today, next_due_date__lte=thirty_days_later)
        for v in exp_visits:
            expirations.append({
                'type': 'periodic_visit',
                'label': f"Visite périodique {v.get_visit_type_display() if v.visit_type != 'other' else (v.custom_type or 'Autre')} requise",
                'expiration_date': v.next_due_date.strftime('%Y-%m-%d'),
                'days_remaining': (v.next_due_date - today).days
            })

        # 2. Objectifs Annuels (Taux de conformité -> Nombre de causeries restantes à faire)
        done_slideshows = QuizSubmission.objects.filter(user=user, submitted_at__year=now.year, is_passed=True).values('quiz__slideshow').distinct().count()
        remaining_slideshows = max(0, user.min_slideshows_per_year - done_slideshows)

        done_reports = AccidentReport.objects.filter(reporter=user, created_at__year=now.year, is_deleted=False).count()
        remaining_reports = max(0, user.min_reports_per_year - done_reports)

        annual_goals = {
            'min_slideshows': user.min_slideshows_per_year,
            'done_slideshows': done_slideshows,
            'remaining_slideshows': remaining_slideshows,
            'min_reports': user.min_reports_per_year,
            'done_reports': done_reports,
            'remaining_reports': remaining_reports,
        }

        # 3. Actions de sécurité (Bloc 1)
        user_actions = Action.objects.filter(assigned_to=user, is_archived=False)
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

        actions_data = {
            'todo': [serialize_action(a) for a in todo_actions],
            'done': [serialize_action(a) for a in done_actions]
        }

        # 4. Causeries programmées (Bloc 2)
        all_active_causeries = Slideshow.objects.filter(
            is_archived=False, is_finished=False
        ).filter(
            Q(is_public=True) | Q(invited_users=user) | Q(creator=user)
        ).distinct()

        passed_quiz_ids = QuizSubmission.objects.filter(user=user, is_passed=True).values_list('quiz__slideshow_id', flat=True)
        remaining_causeries_qs = all_active_causeries.exclude(id__in=passed_quiz_ids).order_by('scheduled_date', 'created_at')

        scheduled_causeries = []
        for c in remaining_causeries_qs[:5]:
            scheduled_causeries.append({
                'id': c.id,
                'title': c.title,
                'scheduled_date': c.scheduled_date.isoformat() if c.scheduled_date else None,
                'creator': f"{c.creator.first_name} {c.creator.last_name}".strip() or c.creator.username,
                'created_at': c.created_at.isoformat()
            })

        all_causeries_done = remaining_causeries_qs.count() == 0

        # 5. Futurs Autocontrôles (Bloc 3)
        upcoming_controls_qs = EquipmentItem.objects.filter(technician=user, is_active=True).order_by('expiration_date')[:5]
        upcoming_controls = []
        for item in upcoming_controls_qs:
            upcoming_controls.append({
                'id': item.id,
                'type_name': item.type_name,
                'category': item.category,
                'category_display': item.get_category_display(),
                'serial_number': item.serial_number,
                'expiration_date': item.expiration_date.strftime('%Y-%m-%d') if item.expiration_date else None
            })

        # 6. Bandeau Remontées (Dernières remontées)
        latest_reports_qs = AccidentReport.objects.filter(is_deleted=False, is_archived=False).order_by('-created_at')[:8]
        latest_reports = []
        for r in latest_reports_qs:
            latest_reports.append({
                'id': r.id,
                'incident_type': r.incident_type,
                'incident_type_display': r.get_incident_type_display(),
                'severity': r.severity,
                'severity_display': r.get_severity_display(),
                'location': r.location,
                'created_at': r.created_at.isoformat(),
                'reporter_name': f"{r.reporter.first_name} {r.reporter.last_name}".strip() or r.reporter.username
            })

        return Response({
            'expirations': expirations,
            'annual_goals': annual_goals,
            'actions': actions_data,
            'scheduled_causeries': scheduled_causeries,
            'all_causeries_done': all_causeries_done,
            'upcoming_controls': upcoming_controls,
            'latest_reports': latest_reports
        })


