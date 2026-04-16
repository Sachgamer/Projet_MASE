'use client';

import { useState, useEffect } from 'react';
import { getReports, deleteReport, updateReport, getBaseURL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import { Button } from '@/components/ui/button';

// Interface représentant une remontée d'accident/incident
interface AccidentReport {
    id: number;
    severity: string;
    location: string;
    description: string;
    incident_date: string;
    image: string | null;
    video: string | null;
    published: boolean; // Si vrai, le rapport est considéré comme "Validé" par l'admin
    created_at: string;
    reporter_name: string;
}

// Vue affichant l'historique des remontées QHSE, séparées en "Non lues" et "Validées"
export default function ReportListView() {
    const { user, loading: authLoading } = useAuth();
    const { setView } = useView();
    const [reports, setReports] = useState<AccidentReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null); // Pour la modal d'aperçu d'image

    useEffect(() => {
        loadReports();
    }, []);

    // Récupère tous les rapports de remontées
    const loadReports = async () => {
        try {
            const response = await getReports();
            setReports(response.data);
            setLoading(false);
        } catch (err: any) {
            console.error('Erreur de chargement des rapports:', err.message);
            setError('Erreur de chargement des rapports');
            setLoading(false);
        }
    };

    // Supprime un rapport après confirmation (Admin uniquement en pratique via l'UI)
    const handleDelete = async (id: number) => {
        if (!window.confirm('Voulez-vous vraiment supprimer ce rapport ?')) return;
        try {
            await deleteReport(id);
            setReports(prev => prev.filter(r => r.id !== id));
        } catch (err: any) {
            // Gestion du cas où le rapport a déjà été supprimé
            if (err.response?.status === 404) {
                setReports(prev => prev.filter(r => r.id !== id));
                return;
            }
            alert('Erreur lors de la suppression.');
        }
    };

    // Valide un rapport (le fait passer dans la section "Rapports Validés")
    const handleValidate = async (id: number) => {
        try {
            await updateReport(id, { published: true });
            setReports(reports.map(r => r.id === id ? { ...r, published: true } : r));
        } catch (err: any) {
            alert('Erreur de validation');
        }
    };

    // Utilitaire pour définir la couleur et le label selon la gravité
    const getSeverityDetails = (severity: string) => {
        switch (severity) {
            case 'low': return { color: 'bg-green-600', label: 'Faible' };
            case 'medium': return { color: 'bg-yellow-600', label: 'Moyen' };
            case 'high': return { color: 'bg-orange-600', label: 'Élevé' };
            case 'critical': return { color: 'bg-red-600', label: 'Critique' };
            default: return { color: 'bg-gray-600', label: severity };
        }
    };

    if (loading || authLoading) return <div className="p-8 text-white">Chargement...</div>;

    return (
        <div className="container mx-auto p-4 pt-12 text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-3xl font-bold">Remontées d'accidents</h1>
                <Button className="bg-red-600" onClick={() => setView('report-create')}>Nouveau Rapport</Button>
            </div>

            {error && <div className="bg-red-500 p-3 rounded-lg mb-6">{error}</div>}

            <div className="space-y-10">
                {/* Section 1 : Rapports n'ayant pas encore été validés par l'administration */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 text-orange-400">Rapports Non Lus</h2>
                    <div className="grid grid-cols-1 gap-6">
                        {reports.filter(r => !r.published).map((report) => (
                            <div key={report.id} className="p-6 bg-gray-800 rounded-xl shadow-xl border-l-4 border-orange-500">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getSeverityDetails(report.severity).color}`}>
                                        {getSeverityDetails(report.severity).label}
                                    </span>
                                    <span className="text-xs text-gray-500">{new Date(report.incident_date).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xl font-bold">{report.location}</h3>
                                    <span className="text-sm text-blue-400 font-medium italic">Par: {report.reporter_name}</span>
                                </div>
                                <p className="text-gray-300 mb-4">{report.description}</p>
                                
                                {/* Affichage des médias (Image ou Vidéo) attachés au rapport */}
                                {(report.image || report.video) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        {report.image && (
                                            <img 
                                                src={report.image.startsWith('http') ? report.image : `${getBaseURL()}${report.image}`} 
                                                className="rounded-lg object-cover h-40 w-full cursor-pointer hover:opacity-90 transition-opacity" 
                                                onClick={() => setSelectedImage(report.image?.startsWith('http') ? report.image : `${getBaseURL()}${report.image}`)}
                                                alt="Rapport d'accident"
                                            />
                                        )}
                                        {report.video && <video src={report.video.startsWith('http') ? report.video : `${getBaseURL()}${report.video}`} controls className="rounded-lg h-40 w-full object-cover" />}
                                    </div>
                                )}

                                {/* Boutons d'administration (Supprimer / Valider) */}
                                {(user?.is_staff || user?.is_superuser) && (
                                    <div className="flex gap-4 border-t border-gray-700 pt-4">
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(report.id)}>Supprimer</Button>
                                        <Button className="bg-green-600" size="sm" onClick={() => handleValidate(report.id)}>Valider</Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section 2 : Archives des rapports ayant été validés */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 text-green-400">Rapports Validés</h2>
                    <div className="grid grid-cols-1 gap-6">
                        {reports.filter(r => r.published).map((report) => (
                            <div key={report.id} className="p-6 bg-gray-800/50 rounded-xl shadow-md border-l-4 border-green-600">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getSeverityDetails(report.severity).color}`}>
                                        {getSeverityDetails(report.severity).label}
                                    </span>
                                    <span className="text-[10px] text-gray-500">{new Date(report.incident_date).toLocaleString()}</span>
                                </div>
                                <h3 className="text-lg font-bold text-white">{report.location}</h3>
                                <p className="text-sm text-gray-400 mb-4">{report.description}</p>
                                
                                {(report.image || report.video) && (
                                    <div className="grid grid-cols-2 gap-2 mb-2 opacity-75 grayscale hover:grayscale-0 transition-all">
                                        {report.image && (
                                            <img 
                                                src={report.image.startsWith('http') ? report.image : `${getBaseURL()}${report.image}`} 
                                                className="rounded object-cover h-20 w-full cursor-pointer hover:scale-105 transition-transform" 
                                                onClick={() => setSelectedImage(report.image?.startsWith('http') ? report.image : `${getBaseURL()}${report.image}`)}
                                                alt="Aperçu du rapport"
                                            />
                                        )}
                                        {report.video && <video src={report.video.startsWith('http') ? report.video : `${getBaseURL()}${report.video}`} className="rounded h-20 w-full object-cover" />}
                                    </div>
                                )}

                                {(user?.is_staff || user?.is_superuser) && (
                                    <div className="flex gap-2 border-t border-gray-700/50 pt-2">
                                        <Button variant="destructive" size="sm" className="h-7 text-[10px]" onClick={() => handleDelete(report.id)}>Supprimer</Button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {reports.filter(r => r.published).length === 0 && (
                            <p className="text-gray-500 italic">Aucun rapport validé pour le moment.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal d'aperçu d'image en plein écran */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center">
                        <img 
                            src={selectedImage} 
                            alt="Visualisation" 
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300"
                        />
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors border-0 cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
