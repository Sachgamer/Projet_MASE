'use client';

import { useEffect, useState } from 'react';
import api, { getHseStats, getReports, getBaseURL } from '@/lib/api';
import { useView } from '@/context/ViewContext';
import { Button } from '@/components/ui/button';
import { 
    Activity, 
    AlertTriangle, 
    CheckCircle, 
    GraduationCap, 
    Clock, 
    Calendar,
    Users,
    ChevronRight,
    TrendingUp,
    MapPin,
    User,
    HardHat,
    XCircle,
    CheckCircle2
} from 'lucide-react';

interface IncidentStats {
    accident: number;
    fatal: number;
    near_miss: number;
    dangerous_situation: number;
    total: number;
}

interface MonthData {
    month: string;
    year: number;
    month_num: number;
    worked_hours: number;
    incidents: IncidentStats;
    tf: number;
    tg: number;
    days_lost: number;
    inspections: {
        total: number;
        valid: number;
        invalid: number;
        compliance_rate: number;
    };
    quiz: {
        total: number;
        passed: number;
        pass_rate: number;
    };
}

interface ActionStats {
    todo: number;
    in_progress: number;
    done: number;
    total: number;
}

interface HseStatsResponse {
    months: MonthData[];
    actions: ActionStats;
    active_users: number;
    worked_hours_monthly: number;
}

interface AccidentReport {
    id: number;
    severity: string;
    incident_type: string;
    location: string;
    description: string;
    incident_date: string;
    reporter_name: string;
}

interface Inspection {
    id: number;
    date: string;
    is_valid: boolean;
    comments: string | null;
    item: number;
    item_details: {
        category: string;
        type_name: string;
        serial_number: string;
        technician_name: string;
    } | null;
}

export default function HseDashboardView() {
    const { setView } = useView();
    const [stats, setStats] = useState<HseStatsResponse | null>(null);
    const [recentAccidents, setRecentAccidents] = useState<AccidentReport[]>([]);
    const [recentInspections, setRecentInspections] = useState<Inspection[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState<'overview' | 'accidents' | 'inspections'>('overview');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStatsAndDetails();
    }, []);

    const fetchStatsAndDetails = async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch aggregated stats
            const statsResponse = await getHseStats();
            setStats(statsResponse.data);
        } catch (err: any) {
            console.error("Erreur lors de la récupération des stats HSE:", err);
            const status = err.response?.status;
            const detail = err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message;
            setError(status ? `Erreur API (${status}) : ${detail}` : `Erreur de connexion : ${err.message}`);
        }

        try {
            // Fetch detailed list of accidents/incidents
            const accidentsResponse = await getReports();
            setRecentAccidents(accidentsResponse.data);
        } catch (err: any) {
            console.error("Erreur lors de la récupération des rapports d'accidents:", err);
        }

        try {
            // Fetch detailed list of inspections
            const inspectionsResponse = await api.get('/api/controls/inspections/');
            setRecentInspections(inspectionsResponse.data);
        } catch (err: any) {
            console.error("Erreur lors de la récupération des inspections:", err);
        }

        setLoading(false);
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-white space-y-6">
                <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl max-w-xl mx-auto shadow-lg backdrop-blur-md">
                    <p className="font-extrabold text-xl mb-2">Impossible de charger le tableau de bord HSE</p>
                    <p className="text-sm opacity-90 leading-relaxed font-mono">{error}</p>
                </div>
                <Button className="px-6 py-3 text-sm font-semibold rounded-xl" onClick={fetchStatsAndDetails}>
                    Réessayer de charger
                </Button>
            </div>
        );
    }

    if (!stats || stats.months.length === 0) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-white">
                <p className="text-gray-400 text-lg">Aucune donnée disponible pour le moment.</p>
            </div>
        );
    }

    // Latest month data
    const latestMonth = stats.months[stats.months.length - 1];

    // Max values for chart scaling
    const maxIncidents = Math.max(...stats.months.map(m => m.incidents.total), 5);
    const maxTf = Math.max(...stats.months.map(m => m.tf), 10);
    const maxTg = Math.max(...stats.months.map(m => m.tg), 1);

    // Categories styling
    const getCategoryBadge = (type: string) => {
        switch (type) {
            case 'dangerous_situation': 
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20 label-Situation-dangereuse';
            case 'near_miss': 
                return 'bg-orange-500/10 text-orange-400 border-orange-500/20 label-Presque-accident';
            case 'accident': 
                return 'bg-red-500/10 text-red-400 border-red-500/20 label-Accident';
            case 'fatal_accident': 
                return 'bg-red-900/20 text-red-500 border-red-900/30 label-Accident-mortel';
            default: 
                return 'bg-muted/20 text-muted-foreground border-border';
        }
    };

    const getCategoryLabel = (type: string) => {
        switch (type) {
            case 'dangerous_situation': return 'Situation dangereuse';
            case 'near_miss': return 'Presque accident';
            case 'accident': return 'Accident';
            case 'fatal_accident': return 'Accident mortel';
            default: return type;
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'low': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
            default: return 'bg-muted/20 text-muted-foreground border-border';
        }
    };

    const getSeverityLabel = (severity: string) => {
        switch (severity) {
            case 'low': return 'Faible';
            case 'medium': return 'Moyenne';
            case 'high': return 'Élevée';
            case 'critical': return 'Critique';
            default: return severity;
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white space-y-12 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                        Indicateurs & Stats HSE
                    </h1>
                    <p className="text-gray-400 mt-1.5">
                        Tableau de bord de suivi de la sécurité au travail (SST) - Conformité MASE.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="text-white border-white/20 px-5" onClick={() => setView('report-create')}>
                        Signaler un Incident
                    </Button>
                    <Button className="px-5" onClick={() => setView('action-plan')}>
                        Plan d'Actions
                    </Button>
                </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* TF Card */}
                <div className="bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/20 rounded-2xl p-8 hover:scale-[1.02] transition-transform duration-200 shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Taux de Fréquence (TF)</p>
                            <h3 className="text-4xl font-black mt-3 text-white">{latestMonth.tf}</h3>
                        </div>
                        <div className="p-3.5 rounded-xl bg-red-500/10 text-red-500">
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-6 text-xs text-gray-400 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-red-400" />
                        <span>Mois : {latestMonth.month}</span>
                    </div>
                </div>

                {/* TG Card */}
                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-2xl p-8 hover:scale-[1.02] transition-transform duration-200 shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Taux de Gravité (TG)</p>
                            <h3 className="text-4xl font-black mt-3 text-white">{latestMonth.tg}</h3>
                        </div>
                        <div className="p-3.5 rounded-xl bg-yellow-500/10 text-yellow-500">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-6 text-xs text-gray-400">
                        <span>Arrêt de travail : <strong className="text-white">{latestMonth.days_lost}</strong> jours</span>
                    </div>
                </div>

                {/* Inspection Compliance */}
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-8 hover:scale-[1.02] transition-transform duration-200 shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Conformité Équipements</p>
                            <h3 className="text-4xl font-black mt-3 text-white">{latestMonth.inspections.compliance_rate}%</h3>
                        </div>
                        <div className="p-3.5 rounded-xl bg-green-500/10 text-green-500">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-6 text-xs text-gray-400">
                        <span><strong className="text-white">{latestMonth.inspections.valid}</strong> conformes / {latestMonth.inspections.total} contrôles</span>
                    </div>
                </div>

                {/* Quiz Success */}
                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl p-8 hover:scale-[1.02] transition-transform duration-200 shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Réussite Formations</p>
                            <h3 className="text-4xl font-black mt-3 text-white">{latestMonth.quiz.pass_rate}%</h3>
                        </div>
                        <div className="p-3.5 rounded-xl bg-blue-500/10 text-blue-500">
                            <GraduationCap className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-6 text-xs text-gray-400">
                        <span><strong className="text-white">{latestMonth.quiz.passed}</strong> réussis / {latestMonth.quiz.total} validés</span>
                    </div>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex gap-4 border-b border-white/10 pb-2">
                {(['overview', 'accidents', 'inspections'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        className={`px-5 py-3 text-sm font-bold rounded-t-xl transition-all border-b-2 bg-transparent cursor-pointer ${selectedTab === tab ? 'border-primary text-primary bg-white/5' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        {tab === 'overview' ? 'Vue Globale' : tab === 'accidents' ? 'Accidents & Incidents' : 'Auto-contrôles'}
                    </button>
                ))}
            </div>

            {/* Overview Tab Content */}
            {selectedTab === 'overview' && (
                <div className="space-y-12">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Accidents Chart */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md lg:col-span-2 flex flex-col justify-between space-y-8">
                            <div>
                                <h3 className="text-xl font-bold mb-1.5">Évolution des Signalements (Incidents)</h3>
                                <p className="text-sm text-gray-400">Accidents, situations dangereuses et presque accidents par mois.</p>
                            </div>
                            {/* Custom Chart */}
                            <div className="h-80 flex items-end gap-6 px-4">
                                {stats.months.map((m, idx) => {
                                    const total = m.incidents.total;
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                                            <div className="w-full flex flex-col justify-end items-center relative gap-1 h-[80%]">
                                                {/* Tooltip */}
                                                <div className="absolute -top-16 bg-gray-900 border border-white/10 rounded-lg p-2.5 text-[11px] leading-relaxed hidden group-hover:block z-10 whitespace-nowrap shadow-2xl">
                                                    <strong className="text-white block border-b border-white/10 pb-1 mb-1">{m.month}</strong>
                                                    Accidents : <span className="text-red-400 font-bold">{m.incidents.accident}</span><br />
                                                    Presque : <span className="text-orange-400 font-bold">{m.incidents.near_miss}</span><br />
                                                    Situations : <span className="text-blue-400 font-bold">{m.incidents.dangerous_situation}</span>
                                                </div>
                                                {/* Bar Parts using responsive percentage sizing */}
                                                {m.incidents.accident > 0 && (
                                                    <div 
                                                        className="w-full bg-red-500 rounded-t-sm"
                                                        style={{ height: `${(m.incidents.accident / maxIncidents) * 100}%` }}
                                                    />
                                                )}
                                                {m.incidents.near_miss > 0 && (
                                                    <div 
                                                        className="w-full bg-orange-500" 
                                                        style={{ height: `${(m.incidents.near_miss / maxIncidents) * 100}%` }}
                                                    />
                                                )}
                                                {m.incidents.dangerous_situation > 0 && (
                                                    <div 
                                                        className="w-full bg-blue-400 rounded-b-sm" 
                                                        style={{ height: `${(m.incidents.dangerous_situation / maxIncidents) * 100}%` }}
                                                    />
                                                )}
                                                {total === 0 && (
                                                    <div className="w-full h-1 bg-white/10 rounded" />
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-400 mt-3 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full font-medium">
                                                {m.month.split(' ')[0]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Legend */}
                            <div className="flex flex-wrap gap-6 mt-4 text-xs justify-center border-t border-white/5 pt-6">
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 bg-red-500 rounded-sm" />
                                    <span className="font-semibold">Accidents</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 bg-orange-500 rounded-sm" />
                                    <span className="font-semibold">Presque Accidents</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 bg-blue-400 rounded-sm" />
                                    <span className="font-semibold">Situations dangereuses</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Plan CAPA Progress Card */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md flex flex-col justify-between space-y-8">
                            <div>
                                <h3 className="text-xl font-bold mb-1.5">Plan d'Actions (CAPA)</h3>
                                <p className="text-sm text-gray-400">État des actions de sécurité ouvertes.</p>
                            </div>
                            
                            {/* Status breakdown */}
                            <div className="space-y-5 flex-1 flex flex-col justify-center">
                                <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                                    <span className="text-red-400 flex items-center gap-2.5 font-semibold">
                                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                        À faire
                                    </span>
                                    <span className="font-black text-white">{stats.actions.todo}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                                    <span className="text-orange-400 flex items-center gap-2.5 font-semibold">
                                        <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                                        En cours
                                    </span>
                                    <span className="font-black text-white">{stats.actions.in_progress}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                                    <span className="text-green-400 flex items-center gap-2.5 font-semibold">
                                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                        Clôturées
                                    </span>
                                    <span className="font-black text-white">{stats.actions.done}</span>
                                </div>
                                
                                {/* Horizontal cumulative progress bar */}
                                <div className="w-full h-3 rounded-full overflow-hidden bg-white/10 flex mt-6">
                                    {stats.actions.total > 0 ? (
                                        <>
                                            <div className="bg-red-500" style={{ width: `${(stats.actions.todo / stats.actions.total) * 100}%` }} />
                                            <div className="bg-orange-500" style={{ width: `${(stats.actions.in_progress / stats.actions.total) * 100}%` }} />
                                            <div className="bg-green-500" style={{ width: `${(stats.actions.done / stats.actions.total) * 100}%` }} />
                                        </>
                                    ) : (
                                        <div className="w-full bg-white/10" />
                                    )}
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button 
                                    variant="outline" 
                                    className="w-full text-white border-white/20 hover:bg-white/5 flex items-center justify-center gap-1.5 text-xs py-5"
                                    onClick={() => setView('action-plan')}
                                >
                                    Gérer le plan d'actions
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Données Récentes (Overview list block) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        {/* 3 Dernières Remontées */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <h4 className="text-lg font-bold flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                                    Signalements Récents
                                </h4>
                                <span className="text-xs text-gray-400">3 derniers</span>
                            </div>
                            <div className="space-y-4">
                                {recentAccidents.slice(0, 3).map((acc) => (
                                    <div key={acc.id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2.5">
                                        <div className="flex justify-between items-start gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadge(acc.incident_type)}`}>
                                                {getCategoryLabel(acc.incident_type)}
                                            </span>
                                            <span className="text-[10px] text-gray-500 flex items-center gap-1 font-bold">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(acc.incident_date).toLocaleDateString('fr-FR')}
                                            </span>
                                        </div>
                                        <div className="text-sm font-semibold flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                            {acc.location}
                                        </div>
                                        <div className="text-xs text-gray-400 line-clamp-1 italic">
                                            "{acc.description}"
                                        </div>
                                    </div>
                                ))}
                                {recentAccidents.length === 0 && (
                                    <p className="text-xs text-gray-500 italic text-center py-4">Aucun incident à afficher</p>
                                )}
                            </div>
                            <Button 
                                variant="ghost" 
                                className="w-full text-xs text-primary hover:bg-white/5 gap-1.5"
                                onClick={() => setView('report-list')}
                            >
                                Voir tout l'historique
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        {/* 3 Derniers Auto-contrôles */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <h4 className="text-lg font-bold flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    Auto-contrôles Récents
                                </h4>
                                <span className="text-xs text-gray-400">3 derniers</span>
                            </div>
                            <div className="space-y-4">
                                {recentInspections.slice(0, 3).map((insp) => (
                                    <div key={insp.id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2.5">
                                        <div className="flex justify-between items-start gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${insp.is_valid ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                {insp.is_valid ? 'CONFORME' : 'ANOMALIE'}
                                            </span>
                                            <span className="text-[10px] text-gray-500 flex items-center gap-1 font-bold">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(insp.date).toLocaleDateString('fr-FR')}
                                            </span>
                                        </div>
                                        <div className="text-sm font-semibold flex items-center gap-1">
                                            <HardHat className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                            {insp.item_details?.type_name || `Équipement #${insp.item}`}
                                        </div>
                                        <div className="text-xs text-gray-400 flex items-center gap-1">
                                            <User className="w-3.5 h-3.5 text-gray-500" />
                                            Par : {insp.item_details?.technician_name}
                                        </div>
                                    </div>
                                ))}
                                {recentInspections.length === 0 && (
                                    <p className="text-xs text-gray-500 italic text-center py-4">Aucune inspection à afficher</p>
                                )}
                            </div>
                            <Button 
                                variant="ghost" 
                                className="w-full text-xs text-primary hover:bg-white/5 gap-1.5"
                                onClick={() => setView('auto-control-list')}
                            >
                                Gérer les auto-contrôles
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Accidents Detailed Tab Content */}
            {selectedTab === 'accidents' && (
                <div className="space-y-12">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* TF Chart */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md space-y-8">
                            <div>
                                <h3 className="text-xl font-bold mb-1.5 text-red-400">Évolution du Taux de Fréquence (TF)</h3>
                                <p className="text-sm text-gray-400">Objectif national standard : inférieur à 10.</p>
                            </div>
                            
                            <div className="h-80 flex items-end gap-6 px-4">
                                {stats.months.map((m, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                                        <div className="text-xs font-bold mb-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            {m.tf}
                                        </div>
                                        <div 
                                            className="w-full bg-red-600/30 border border-red-500 rounded-t-md transition-all group-hover:bg-red-600/50"
                                            style={{ height: `${m.tf > 0 ? (m.tf / maxTf) * 100 : 2}%` }}
                                        />
                                        <span className="text-xs text-gray-400 mt-3 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full font-medium">
                                            {m.month.split(' ')[0]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* TG Chart */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md space-y-8">
                            <div>
                                <h3 className="text-xl font-bold mb-1.5 text-yellow-400">Évolution du Taux de Gravité (TG)</h3>
                                <p className="text-sm text-gray-400">Nombre de journées d'arrêt de travail par millier d'heures.</p>
                            </div>
                            
                            <div className="h-80 flex items-end gap-6 px-4">
                                {stats.months.map((m, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                                        <div className="text-xs font-bold mb-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            {m.tg}
                                        </div>
                                        <div 
                                            className="w-full bg-yellow-500/30 border border-yellow-500 rounded-t-md transition-all group-hover:bg-yellow-500/50"
                                            style={{ height: `${m.tg > 0 ? (m.tg / maxTg) * 100 : 2}%` }}
                                        />
                                        <span className="text-xs text-gray-400 mt-3 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full font-medium">
                                            {m.month.split(' ')[0]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Historique détaillé des accidents */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">5 Derniers Accidents & Incidents Signalés</h3>
                                <p className="text-xs text-gray-400 mt-1">Détails des remontées de sécurité QHSE enregistrées.</p>
                            </div>
                            <Button variant="outline" className="text-white border-white/20 text-xs px-4" onClick={() => setView('report-list')}>
                                Gérer les Remontées
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                                        <th className="pb-3 font-semibold">Date</th>
                                        <th className="pb-3 font-semibold">Type</th>
                                        <th className="pb-3 font-semibold">Lieu</th>
                                        <th className="pb-3 font-semibold">Gravité</th>
                                        <th className="pb-3 font-semibold">Description</th>
                                        <th className="pb-3 font-semibold">Signaleur</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recentAccidents.slice(0, 5).map((acc) => (
                                        <tr key={acc.id} className="hover:bg-white/5 transition-colors">
                                            <td className="py-4 whitespace-nowrap text-xs">
                                                {new Date(acc.incident_date).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadge(acc.incident_type)}`}>
                                                    {getCategoryLabel(acc.incident_type)}
                                                </span>
                                            </td>
                                            <td className="py-4 whitespace-nowrap font-medium flex items-center gap-1 mt-1">
                                                <MapPin className="w-3.5 h-3.5 text-red-400" />
                                                {acc.location}
                                            </td>
                                            <td className="py-4 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(acc.severity)}`}>
                                                    {getSeverityLabel(acc.severity)}
                                                </span>
                                            </td>
                                            <td className="py-4 max-w-xs truncate text-xs text-gray-300">
                                                {acc.description}
                                            </td>
                                            <td className="py-4 whitespace-nowrap text-xs font-semibold text-blue-400">
                                                {acc.reporter_name}
                                            </td>
                                        </tr>
                                    ))}
                                    {recentAccidents.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-6 text-gray-500 italic">Aucun incident enregistré</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Inspections Tab Content */}
            {selectedTab === 'inspections' && (
                <div className="space-y-12">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Compliance Chart */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md space-y-8">
                            <div>
                                <h3 className="text-xl font-bold mb-1.5 text-green-400">Taux de Conformité des Auto-contrôles</h3>
                                <p className="text-sm text-gray-400">Pourcentage d'équipements/véhicules validés sans défaut.</p>
                            </div>
                            
                            <div className="h-80 flex items-end gap-6 px-4">
                                {stats.months.map((m, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                                        <div className="text-xs font-bold mb-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            {m.inspections.compliance_rate}%
                                        </div>
                                        <div 
                                            className="w-full bg-green-500/30 border border-green-500 rounded-t-md transition-all group-hover:bg-green-500/50"
                                            style={{ height: `${m.inspections.compliance_rate}%` }}
                                        />
                                        <span className="text-xs text-gray-400 mt-3 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full font-medium">
                                            {m.month.split(' ')[0]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Controls Done Details */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md flex flex-col justify-between space-y-8">
                            <div>
                                <h3 className="text-xl font-bold mb-1.5">Volume d'Auto-contrôles Mensuels</h3>
                                <p className="text-sm text-gray-400">Nombre total d'inspections d'équipements réalisées par les techniciens.</p>
                            </div>
                            
                            <div className="h-64 flex items-end gap-6 px-4">
                                {stats.months.map((m, idx) => {
                                    const maxVol = Math.max(...stats.months.map(m => m.inspections.total), 5);
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                                            <div className="text-xs font-bold mb-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                {m.inspections.total}
                                            </div>
                                            <div 
                                                className="w-full bg-blue-500/40 border border-blue-400 rounded-t-md transition-all group-hover:bg-blue-500/60"
                                                style={{ height: `${m.inspections.total > 0 ? (m.inspections.total / maxVol) * 100 : 2}%` }}
                                            />
                                            <span className="text-xs text-gray-400 mt-3 text-center font-medium">
                                                {m.month.split(' ')[0]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4">
                                <Button 
                                    variant="outline" 
                                    className="w-full text-white border-white/20 hover:bg-white/5 flex items-center justify-center gap-1.5 text-xs py-5"
                                    onClick={() => setView('controle')}
                                >
                                    Effectuer un auto-contrôle
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Historique détaillé des auto-contrôles */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">5 Derniers Auto-contrôles Réalisés</h3>
                                <p className="text-xs text-gray-400 mt-1">Détails des dernières validations d'équipements/véhicules.</p>
                            </div>
                            <Button variant="outline" className="text-white border-white/20 text-xs px-4" onClick={() => setView('auto-control-list')}>
                                Gérer les Rapports
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                                        <th className="pb-3 font-semibold">Date</th>
                                        <th className="pb-3 font-semibold">Équipement</th>
                                        <th className="pb-3 font-semibold">Catégorie</th>
                                        <th className="pb-3 font-semibold">État</th>
                                        <th className="pb-3 font-semibold">Remarques / Commentaires</th>
                                        <th className="pb-3 font-semibold">Technicien</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recentInspections.slice(0, 5).map((insp) => (
                                        <tr key={insp.id} className="hover:bg-white/5 transition-colors">
                                            <td className="py-4 whitespace-nowrap text-xs">
                                                {new Date(insp.date).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="py-4 whitespace-nowrap font-medium flex items-center gap-1 mt-1">
                                                <HardHat className="w-3.5 h-3.5 text-primary" />
                                                {insp.item_details?.type_name || `Équipement #${insp.item}`}
                                            </td>
                                            <td className="py-4 whitespace-nowrap text-xs text-gray-400">
                                                {insp.item_details?.category}
                                            </td>
                                            <td className="py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${insp.is_valid ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                    {insp.is_valid ? 'CONFORME' : 'DÉFAUT'}
                                                </span>
                                            </td>
                                            <td className="py-4 max-w-xs truncate text-xs text-gray-300 italic">
                                                {insp.comments ? `"${insp.comments}"` : 'Aucun'}
                                            </td>
                                            <td className="py-4 whitespace-nowrap text-xs text-gray-400">
                                                {insp.item_details?.technician_name}
                                            </td>
                                        </tr>
                                    ))}
                                    {recentInspections.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-6 text-gray-500 italic">Aucun auto-contrôle enregistré</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
