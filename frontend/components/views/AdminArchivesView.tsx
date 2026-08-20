'use client';

import { useEffect, useState } from 'react';
import api, { getBaseURL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Archive, FileText, ClipboardList, Calendar, User, ArrowDownToLine } from 'lucide-react';

interface ArchivedReport {
    id: number;
    incident_type_display: string;
    location: string;
    reporter_name: string;
    severity_display: string;
    severity: string;
    description: string;
    created_at: string;
    closed_at: string | null;
}

interface ArchivedAction {
    id: number;
    title: string;
    description: string;
    priority: string;
    assigned_to_fullname: string | null;
    completion_proof_text: string | null;
    completion_proof_file: string | null;
    due_date: string | null;
}

export default function AdminArchivesView() {
    const [reports, setReports] = useState<ArchivedReport[]>([]);
    const [actions, setActions] = useState<ArchivedAction[]>([]);
    const [subTab, setSubTab] = useState<'reports' | 'actions'>('reports');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchArchivedData();
    }, [subTab]);

    const fetchArchivedData = async () => {
        setLoading(true);
        try {
            if (subTab === 'reports') {
                const response = await api.get('/api/reports/accident-reports/?archived=true');
                setReports(response.data);
            } else {
                const response = await api.get('/api/reports/actions/?archived=true');
                setActions(response.data);
            }
        } catch (error) {
            console.error("Erreur lors de la récupération des archives:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold flex items-center gap-3">
                        <Archive className="text-primary w-8 h-8" />
                        Archives Globales
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">Consultez l'historique des remontées clôturées et des actions validées de plus de 24 heures.</p>
                </div>

                {/* Sub-tabs toggler */}
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                    <button
                        onClick={() => setSubTab('reports')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border-0 cursor-pointer flex items-center gap-2 ${subTab === 'reports' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white bg-transparent'}`}
                    >
                        <FileText className="w-4 h-4" />
                        Remontées ({reports.length})
                    </button>
                    <button
                        onClick={() => setSubTab('actions')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border-0 cursor-pointer flex items-center gap-2 ${subTab === 'actions' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white bg-transparent'}`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        Actions ({actions.length})
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                </div>
            ) : subTab === 'reports' ? (
                /* Archived Accident Reports List */
                <div className="space-y-4">
                    {reports.length === 0 ? (
                        <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl text-gray-500 italic text-sm">
                            Aucune remontée de sécurité archivée.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {reports.map((report) => {
                                const severityColors: Record<string, string> = {
                                    low: 'bg-green-500/10 text-green-400 border-green-500/20',
                                    medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                                    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                                    critical: 'bg-red-500/10 text-red-400 border-red-500/20'
                                };
                                return (
                                    <div key={report.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                                        <div className="flex justify-between items-start flex-wrap gap-4 border-b border-white/5 pb-3">
                                            <div>
                                                <h3 className="text-lg font-bold text-white">{report.incident_type_display}</h3>
                                                <p className="text-xs text-gray-400 mt-1">Lieu : {report.location} | Signalé par {report.reporter_name}</p>
                                            </div>
                                            <span className={`text-xs font-bold px-3 py-1 rounded border ${severityColors[report.severity] || 'bg-white/10 text-white'}`}>
                                                {report.severity_display}
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Description de l'incident</span>
                                            <p className="text-sm text-gray-300 whitespace-pre-wrap">{report.description}</p>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-gray-500 pt-2 border-t border-white/5">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Créé le : {new Date(report.created_at).toLocaleDateString('fr-FR')}
                                            </span>
                                            {report.closed_at && (
                                                <span className="flex items-center gap-1 text-green-500/80 font-bold">
                                                    Clôturé le : {new Date(report.closed_at).toLocaleDateString('fr-FR')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                /* Archived Corrective Actions List */
                <div className="space-y-4">
                    {actions.length === 0 ? (
                        <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl text-gray-500 italic text-sm">
                            Aucune action corrective archivée.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {actions.map((act) => (
                                <div key={act.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                                    <div className="flex justify-between items-start flex-wrap gap-4 border-b border-white/5 pb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{act.title}</h3>
                                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Responsable : {act.assigned_to_fullname || 'Non assigné'}</p>
                                        </div>
                                        <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded">
                                            Validée & Clôturée
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Description originale</span>
                                            <p className="text-xs text-gray-300 bg-white/2 p-3 rounded-lg border border-white/5 min-h-[60px] whitespace-pre-wrap">{act.description}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Explication de réalisation (Preuve)</span>
                                            <p className="text-xs text-gray-300 bg-white/2 p-3 rounded-lg border border-white/5 min-h-[60px] whitespace-pre-wrap">{act.completion_proof_text || "Aucune explication écrite fournie."}</p>
                                        </div>
                                    </div>
                                    {act.completion_proof_file && (
                                        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Justificatif de complétion</span>
                                            <a 
                                                href={`${getBaseURL()}${act.completion_proof_file}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-primary font-bold hover:underline flex items-center gap-1.5"
                                            >
                                                <ArrowDownToLine className="w-4 h-4" />
                                                Télécharger le justificatif
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
