'use client';

import { useEffect, useState } from 'react';
import api, { getUserDashboard, getBaseURL } from '@/lib/api';
import { useView } from '@/context/ViewContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { 
    AlertTriangle, 
    CheckCircle, 
    GraduationCap, 
    Calendar,
    Users,
    ChevronRight,
    User,
    HardHat,
    XCircle,
    CheckCircle2,
    Clock,
    PlayCircle,
    CheckSquare,
    ClipboardList,
    AlertCircle,
    Award,
    History,
    LayoutDashboard
} from 'lucide-react';

interface CauserieInfo {
    id: number;
    title: string;
    scheduled_date: string;
    description?: string;
    creator?: string;
    created_at?: string;
}

interface ActionItem {
    id: number;
    title: string;
    description: string;
    status: string;
    priority: string;
    due_date: string | null;
    created_at: string;
}

interface ExpirationAlert {
    type: 'control' | 'habilitation' | 'visit';
    label: string;
    expiration_date: string;
    days_remaining: number;
    item_id?: number;
}

interface AnnualGoals {
    min_slideshows: number;
    done_slideshows: number;
    remaining_slideshows: number;
    min_reports: number;
    done_reports: number;
    remaining_reports: number;
}

interface LatestReport {
    id: number;
    location: string;
    incident_type_display: string;
    severity: string;
    severity_display: string;
    reporter_name: string;
    created_at: string;
}

interface ScheduledCauserie {
    id: number;
    title: string;
    scheduled_date: string | null;
    creator: string;
}

interface UpcomingControl {
    id: number;
    type_name: string;
    category_display: string;
    serial_number: string;
    expiration_date: string | null;
}

interface DashboardData {
    next_autocontrol: string | null;
    next_causerie: CauserieInfo | null;
    compliance_rate: number | null;
    quiz_pass_rate: number;
    latest_causerie: CauserieInfo | null;
    upcoming_causeries: CauserieInfo[];
    actions: {
        todo: ActionItem[];
        done: ActionItem[];
    };
    expirations: ExpirationAlert[];
    annual_goals: AnnualGoals;
    latest_reports: LatestReport[];
    all_causeries_done: boolean;
    scheduled_causeries: ScheduledCauserie[];
    upcoming_controls: UpcomingControl[];
}

interface Slideshow {
    id: number;
    title: string;
    has_quiz: boolean;
}

interface ParticipantReport {
    id: number;
    username: string;
    fullname: string;
    email: string;
    quiz_status: {
        completed: boolean;
        score: number | null;
        total_questions: number | null;
        is_passed: boolean;
        submitted_at: string | null;
        attempts: any[];
    };
}

export default function HseDashboardView() {
    const { setView } = useView();
    const { user } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'admin_quiz'>('dashboard');

    // Admin quiz tab state
    const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
    const [selectedSlideshow, setSelectedSlideshow] = useState<number | ''>('');
    const [participants, setParticipants] = useState<ParticipantReport[]>([]);
    const [loadingReport, setLoadingReport] = useState(false);

    const isAdmin = user && (user.is_staff || user.is_superuser);

    useEffect(() => {
        fetchDashboardData();
        if (isAdmin) {
            fetchSlideshows();
        }
    }, [isAdmin]);

    const fetchDashboardData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getUserDashboard();
            setData(response.data);
        } catch (err: any) {
            console.error("Erreur de chargement du dashboard:", err);
            setError("Impossible de charger les données du tableau de bord. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    const fetchSlideshows = async () => {
        try {
            const response = await api.get('/api/slideshows/');
            setSlideshows(response.data);
            if (response.data.length > 0) {
                setSelectedSlideshow(response.data[0].id);
                fetchParticipantsReport(response.data[0].id);
            }
        } catch (err) {
            console.error("Erreur lors de la récupération des causeries:", err);
        }
    };

    const fetchParticipantsReport = async (slideshowId: number) => {
        setLoadingReport(true);
        try {
            const response = await api.get(`/api/slideshows/${slideshowId}/participants_report/`);
            setParticipants(response.data);
        } catch (err) {
            console.error("Erreur lors du rapport des participants:", err);
        } finally {
            setLoadingReport(false);
        }
    };

    const handleSlideshowChange = (id: number) => {
        setSelectedSlideshow(id);
        fetchParticipantsReport(id);
    };

    const handleActionStatusToggle = async (actionId: number, currentStatus: string) => {
        const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
        try {
            await api.patch(`/api/actions/${actionId}/`, { status: nextStatus });
            fetchDashboardData();
        } catch (err) {
            console.error("Erreur lors de la modification du statut de l'action:", err);
        }
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-24 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-6">
                <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl max-w-xl mx-auto shadow-lg backdrop-blur-md">
                    <p className="font-extrabold text-xl mb-2">Erreur de chargement</p>
                    <p className="text-sm font-medium">{error}</p>
                </div>
                <Button className="px-6 py-3 font-semibold rounded-xl" onClick={fetchDashboardData}>
                    Réessayer
                </Button>
            </div>
        );
    }

    // Pie chart metrics calculation
    const completedCount = participants.filter(p => p.quiz_status.completed).length;
    const notCompletedCount = participants.length - completedCount;
    const completionRate = participants.length > 0 ? Math.round((completedCount / participants.length) * 100) : 0;

    // SVG Pie chart calculation variables
    const strokeDasharray = 2 * Math.PI * 40; // circumference for radius 40
    const completedStrokeOffset = strokeDasharray - (completionRate / 100) * strokeDasharray;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">
                        Mon Tableau de Bord Sécurité
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Bonjour <span className="text-primary font-bold">{user?.first_name || user?.username}</span>. Suivi personnel de vos causeries, auto-contrôles et actions.
                    </p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                            <button
                                onClick={() => setActiveTab('dashboard')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Dashboard Profil
                            </button>
                            <button
                                onClick={() => setActiveTab('admin_quiz')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'admin_quiz' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Suivi Quiz (Admin)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'dashboard' && (
                <>
                    {/* Expirations Alerts Banner (J-30) */}
                    {data.expirations && data.expirations.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Alertes d'expiration (J-30)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.expirations.map((exp, idx) => (
                                    <div key={idx} className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center justify-between text-xs font-semibold">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-5 h-5 shrink-0" />
                                            <div>
                                                <p>{exp.label}</p>
                                                <p className="text-[10px] text-red-500/70 mt-0.5">Date limite : {new Date(exp.expiration_date).toLocaleDateString('fr-FR')} ({exp.days_remaining} jours restants)</p>
                                            </div>
                                        </div>
                                        {exp.type === 'control' && (
                                            <button 
                                                onClick={() => setView('controle', { itemId: exp.item_id })}
                                                className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold text-[10px] hover:bg-red-600 transition-colors border-0 cursor-pointer shrink-0 ml-2"
                                            >
                                                Contrôler
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Objectifs Annuels */}
                    {data.annual_goals && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                                <Award className="w-5 h-5 text-yellow-500" />
                                Objectifs Annuels
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Causeries Goal */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Objectif causeries dans l'année</p>
                                        <h3 className="text-xl font-black mt-1 text-white">
                                            {data.annual_goals.done_slideshows} / {data.annual_goals.min_slideshows} causeries faites
                                        </h3>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            Restantes à faire : <span className="text-yellow-500 font-bold">{data.annual_goals.remaining_slideshows}</span>
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-400 shrink-0">
                                        <LayoutDashboard className="w-6 h-6" />
                                    </div>
                                </div>

                                {/* Remontées Goal */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Objectif remontées de sécurité</p>
                                        <h3 className="text-xl font-black mt-1 text-white">
                                            {data.annual_goals.done_reports} / {data.annual_goals.min_reports} remontées faites
                                        </h3>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            Restantes à faire : <span className="text-primary font-bold">{data.annual_goals.remaining_reports}</span>
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Latest Reports Horizontal Banner */}
                    {data.latest_reports && data.latest_reports.length > 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <History className="w-5 h-5 text-blue-400" />
                                Dernières Remontées de Sécurité
                            </h2>
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
                                {data.latest_reports.map((report) => {
                                    const severityColors: Record<string, string> = {
                                        low: 'bg-green-500/10 text-green-400 border-green-500/20',
                                        medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                                        high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                                        critical: 'bg-red-500/10 text-red-400 border-red-500/20'
                                    };
                                    return (
                                        <div key={report.id} className="min-w-[280px] max-w-[320px] bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 flex-shrink-0">
                                            <div className="flex justify-between items-start">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[150px]">{report.incident_type_display}</span>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${severityColors[report.severity] || 'bg-white/10 text-white border-white/20'}`}>
                                                    {report.severity_display}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-xs text-white line-clamp-2 font-semibold">Lieu : {report.location}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">Par {report.reporter_name} le {new Date(report.created_at).toLocaleDateString('fr-FR')}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Three Vertical Blocks */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Bloc 1 : Actions de sécurité */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between space-y-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                                    <ClipboardList className="w-5 h-5 text-orange-400" />
                                    Actions de Sécurité
                                </h2>
                                <p className="text-xs text-gray-400">Actions de prévention affectées.</p>
                            </div>

                            <div className="flex-1 space-y-6 overflow-y-auto max-h-[350px] pr-1">
                                {/* À faire */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        À réaliser ({data.actions.todo.length})
                                    </h3>
                                    {data.actions.todo.map((act) => (
                                        <div key={act.id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                                            <h4 className="text-sm font-bold text-white leading-tight">{act.title}</h4>
                                            <p className="text-[11px] text-gray-400 line-clamp-2">{act.description}</p>
                                            <div className="flex justify-between items-center text-[10px] text-gray-500 pt-2 border-t border-white/5">
                                                <span className={`font-bold ${act.priority === 'high' || act.priority === 'critical' ? 'text-red-400' : 'text-gray-400'}`}>
                                                    Priorité : {act.priority.toUpperCase()}
                                                </span>
                                                <span className="font-bold">
                                                    Échéance : {act.due_date ? new Date(act.due_date).toLocaleDateString('fr-FR') : 'Non spécifiée'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {data.actions.todo.length === 0 && (
                                        <p className="text-xs text-gray-500 italic text-center py-2">Aucune action en attente</p>
                                    )}
                                </div>

                                {/* Faites */}
                                <div className="space-y-3 pt-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Clôturées ({data.actions.done.length})
                                    </h3>
                                    {data.actions.done.slice(0, 3).map((act) => (
                                        <div key={act.id} className="p-3 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center gap-4 opacity-70">
                                            <div className="truncate">
                                                <h4 className="text-xs font-bold text-white line-through truncate">{act.title}</h4>
                                                <p className="text-[10px] text-gray-400 truncate mt-0.5">Clôturée</p>
                                            </div>
                                        </div>
                                    ))}
                                    {data.actions.done.length === 0 && (
                                        <p className="text-xs text-gray-500 italic text-center py-2">Aucune action terminée</p>
                                    )}
                                </div>
                            </div>

                            <Button 
                                variant="outline" 
                                className="w-full text-white border-white/20 hover:bg-white/5 py-5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                onClick={() => setView('action-plan')}
                            >
                                Gérer mes actions
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Bloc 2 : Causeries programmées */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between space-y-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                                    <Calendar className="w-5 h-5 text-blue-400" />
                                    Causeries Programmées
                                </h2>
                                <p className="text-xs text-gray-400">Sessions de sensibilisation à réaliser.</p>
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto max-h-[350px] pr-1">
                                {data.all_causeries_done ? (
                                    <div className="text-center p-8 bg-green-500/5 border border-green-500/10 rounded-xl text-green-400 flex flex-col items-center justify-center space-y-2 h-48">
                                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                                        <p className="font-bold text-sm">Pas de prochaine causerie</p>
                                        <p className="text-[11px] text-gray-400">Toutes les causeries disponibles ont été réalisées.</p>
                                    </div>
                                ) : (
                                    <>
                                        {data.scheduled_causeries.map((c) => (
                                            <div key={c.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center hover:bg-white/10 transition-colors">
                                                <div className="min-w-0 flex-1 mr-2">
                                                    <h4 className="font-bold text-xs text-white truncate">{c.title}</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">Par {c.creator}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    {c.scheduled_date && (
                                                        <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                                                            {new Date(c.scheduled_date).toLocaleDateString('fr-FR')}
                                                        </span>
                                                    )}
                                                    <button 
                                                        onClick={() => setView('dashboard')}
                                                        className="text-primary font-bold hover:underline text-[10px] flex items-center border-0 bg-transparent cursor-pointer"
                                                    >
                                                        Lancer
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            <Button 
                                variant="outline" 
                                className="w-full text-white border-white/20 hover:bg-white/5 py-5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                onClick={() => setView('dashboard')}
                            >
                                Voir les causeries
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Bloc 3 : Futurs autocontrôles */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between space-y-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                                    <HardHat className="w-5 h-5 text-teal-400" />
                                    Futurs Autocontrôles
                                </h2>
                                <p className="text-xs text-gray-400">Prochains contrôles d'équipements / véhicules.</p>
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto max-h-[350px] pr-1">
                                {data.upcoming_controls && data.upcoming_controls.length > 0 ? (
                                    <>
                                        {data.upcoming_controls.map((item) => (
                                            <div key={item.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center hover:bg-white/10 transition-colors">
                                                <div className="min-w-0 flex-1 mr-2">
                                                    <h4 className="font-bold text-xs text-white truncate">{item.type_name}</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.category_display} - Sn: {item.serial_number}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    {item.expiration_date && (
                                                        <span className="text-[9px] font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                                                            {new Date(item.expiration_date).toLocaleDateString('fr-FR')}
                                                        </span>
                                                    )}
                                                    <button 
                                                        onClick={() => setView('controle', { itemId: item.id })}
                                                        className="text-primary font-bold hover:underline text-[10px] flex items-center border-0 bg-transparent cursor-pointer"
                                                    >
                                                        Contrôler
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-center p-8 bg-white/5 border border-white/10 rounded-xl text-gray-500 italic text-xs flex flex-col items-center justify-center h-48">
                                        <CheckCircle className="w-8 h-8 text-teal-500 mb-2 opacity-50" />
                                        Aucun équipement ou véhicule à contrôler
                                    </div>
                                )}
                            </div>

                            <Button 
                                variant="outline" 
                                className="w-full text-white border-white/20 hover:bg-white/5 py-5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                onClick={() => setView('controle')}
                            >
                                Faire un autocontrôle
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                    </div>
                </>
            )}

            {activeTab === 'admin_quiz' && isAdmin && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                Rapport de Complétion des Quiz
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">Sélectionnez une causerie pour voir le statut de participation.</p>
                        </div>
                        <div className="w-full sm:w-72">
                            <select
                                value={selectedSlideshow}
                                onChange={(e) => handleSlideshowChange(Number(e.target.value))}
                                className="w-full bg-gray-800 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="">-- Choisir une causerie --</option>
                                {slideshows.filter(s => s.has_quiz).map(s => (
                                    <option key={s.id} value={s.id}>{s.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {loadingReport ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : selectedSlideshow ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                            {/* Custom SVG Pie Chart */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center justify-center space-y-6">
                                <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-400">Statistiques globales</h3>
                                
                                <div className="relative w-48 h-48 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        {/* Background Circle */}
                                        <circle 
                                            cx="50" 
                                            cy="50" 
                                            r="40" 
                                            className="stroke-white/10" 
                                            strokeWidth="12" 
                                            fill="transparent" 
                                        />
                                        {/* Completed Arc */}
                                        <circle 
                                            cx="50" 
                                            cy="50" 
                                            r="40" 
                                            className="stroke-primary transition-all duration-1000" 
                                            strokeWidth="12" 
                                            fill="transparent" 
                                            strokeDasharray={strokeDasharray}
                                            strokeDashoffset={completedStrokeOffset}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center justify-center text-center">
                                        <span className="text-4xl font-black text-white">{completionRate}%</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Complété</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 w-full gap-4 pt-4 border-t border-white/5 text-center">
                                    <div>
                                        <p className="text-2xl font-black text-primary">{completedCount}</p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Ont répondu</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-gray-400">{notCompletedCount}</p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">En attente</p>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed List */}
                            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md h-[340px] flex flex-col justify-between">
                                <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-400 mb-4">Statut des participants invités</h3>
                                <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                                    {participants.map((p) => {
                                        const statusColor = p.quiz_status.completed
                                            ? (p.quiz_status.is_passed 
                                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                                : 'bg-red-500/10 text-red-400 border border-red-500/20')
                                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';

                                        const statusText = p.quiz_status.completed
                                            ? (p.quiz_status.is_passed 
                                                ? `Réussi (${p.quiz_status.score}/${p.quiz_status.total_questions})` 
                                                : `Échoué (${p.quiz_status.score}/${p.quiz_status.total_questions})`)
                                            : 'Non démarré';

                                        return (
                                            <div key={p.id} className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-xl text-xs">
                                                <div>
                                                    <h4 className="font-bold text-white">{p.fullname}</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{p.email}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {p.quiz_status.completed && (
                                                        <span className="text-[10px] text-gray-500 font-bold">
                                                            Tents: {p.quiz_status.attempts?.length || 1}/2
                                                        </span>
                                                    )}
                                                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${statusColor}`}>
                                                        {statusText}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {participants.length === 0 && (
                                        <p className="text-xs text-gray-500 italic text-center py-12">Aucun participant invité pour cette causerie.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 italic text-sm">
                            Veuillez choisir une causerie contenant un quiz pour afficher les statistiques.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
