'use client';

import React, { useEffect, useState } from 'react';
import api, { getBaseURL, downloadInspectionPdf } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ClipboardCheck, AlertTriangle, CheckCircle2, Search, Filter, Calendar, User, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Interface pour les rapports d'auto-contrôle (EPI, Véhicules)
interface Inspection {
    id: number;
    date: string;
    is_valid: boolean; // Si tout est conforme
    is_read: boolean; // Si l'admin a lu le rapport
    defects: Record<string, boolean>; // Liste des problèmes cochés
    vehicle_checks: Record<string, boolean>;
    photo: string | null;
    comments: string | null;
    item: number;
    item_details: {
        category: string;
        type_name: string;
        serial_number: string;
        technician_name: string;
        technician_username: string;
    } | null;
}

// Vue pour l'administrateur permettant de voir tous les rapports d'inspection
export default function AutoControlListView() {
    const { user } = useAuth();
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [loading, setLoading] = useState(true);
    // État du filtre (Tous, Conformes, Non conformes, Non lus)
    const [filter, setFilter] = useState<'ALL' | 'VALID' | 'INVALID' | 'UNREAD'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        fetchInspections();
    }, []);

    // Récupère tous les rapports d'auto-contrôle (Admin seulement via API)
    const fetchInspections = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/controls/inspections/');
            setInspections(response.data);
        } catch (error) {
            console.error("Error fetching inspections:", error);
        } finally {
            setLoading(false);
        }
    };

    // Alterne l'état "lu / non lu" d'un rapport
    const toggleReadStatus = async (id: number, currentStatus: boolean) => {
        try {
            await api.patch(`/api/controls/inspections/${id}/`, { is_read: !currentStatus });
            setInspections(inspections.map(insp => 
                insp.id === id ? { ...insp, is_read: !currentStatus } : insp
            ));
        } catch (error) {
            console.error("Error toggling read status:", error);
        }
    };

    // Supprime un rapport définitivement
    const handleDelete = async (id: number) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce rapport ?")) {
            return;
        }

        try {
            await api.delete(`/api/controls/inspections/${id}/`);
            setInspections(inspections.filter(insp => insp.id !== id));
        } catch (error) {
            console.error("Error deleting inspection:", error);
            alert("Erreur lors de la suppression du rapport.");
        }
    };

    // Filtre les rapports selon le bouton cliqué et la barre de recherche
    const filteredInspections = inspections.filter(insp => {
        const matchesFilter = 
            filter === 'ALL' || 
            (filter === 'VALID' && insp.is_valid) || 
            (filter === 'INVALID' && !insp.is_valid) ||
            (filter === 'UNREAD' && !insp.is_read);
        
        const searchInput = searchTerm.toLowerCase();
        const matchesSearch = 
            insp.item_details?.type_name.toLowerCase().includes(searchInput) ||
            insp.item_details?.technician_name.toLowerCase().includes(searchInput) ||
            insp.item_details?.serial_number.toLowerCase().includes(searchInput);
        
        return matchesFilter && matchesSearch;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                        Rapports d'Auto-contrôle
                    </h1>
                    <p className="text-gray-400 mt-2">Suivi de la conformité des équipements et véhicules</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/10">
                    <Button 
                        variant={filter === 'ALL' ? 'default' : 'ghost'} 
                        onClick={() => setFilter('ALL')}
                        className="rounded-lg h-9"
                    >
                        Tous
                    </Button>
                    <Button 
                        variant={filter === 'VALID' ? 'default' : 'ghost'} 
                        onClick={() => setFilter('VALID')}
                        className="rounded-lg h-9 text-green-400 hover:text-green-300"
                    >
                        Conformes
                    </Button>
                    <Button 
                        variant={filter === 'INVALID' ? 'default' : 'ghost'} 
                        onClick={() => setFilter('INVALID')}
                        className="rounded-lg h-9 text-red-400 hover:text-red-300"
                    >
                        Non Conformes
                    </Button>
                    <Button 
                        variant={filter === 'UNREAD' ? 'default' : 'ghost'} 
                        onClick={() => setFilter('UNREAD')}
                        className="rounded-lg h-9 text-blue-400 hover:text-blue-300"
                    >
                        Non Lus
                    </Button>
                </div>
            </div>

            <div className="mb-8 relative max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    type="text"
                    placeholder="Rechercher par équipement, technicien, plaque ou S/N..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-primary transition-all placeholder:text-gray-500"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInspections.map((insp) => (
                    <div 
                        key={insp.id} 
                        className={`group bg-secondary/30 backdrop-blur-md border rounded-2xl overflow-hidden transition-all hover:scale-[1.02] duration-300 flex flex-col ${
                            insp.is_valid ? 'border-white/10' : 'border-red-500/30 shadow-lg shadow-red-500/5'
                        }`}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                                    insp.is_valid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                    {insp.is_valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                    {insp.is_valid ? 'CONFORME' : 'DÉFAUT DÉTECTÉ'}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {!insp.is_read && (
                                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-full animate-pulse">
                                            NOUVEAU
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(insp.date).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            
                            <h3 className="text-xl font-bold truncate group-hover:text-primary transition-colors">
                                {insp.item_details?.type_name || `Équipement #${insp.item}`}
                            </h3>
                            <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-1">
                                <HardHat className="w-4 h-4 text-primary" />
                                {insp.item_details?.category} • {insp.item_details?.category === 'VEHICULE' ? "Plaque d'immatriculation: " : 'S/N: '} {insp.item_details?.serial_number || 'N/A'}
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4 flex-grow">
                            <div className="flex items-center gap-2 text-sm">
                                <User className="w-4 h-4 text-primary" />
                                <span className="font-medium">{insp.item_details?.technician_name}</span>
                                <span className="text-gray-500">({insp.item_details?.technician_username})</span>
                            </div>

                            {insp.comments && (
                                <div className="bg-white/5 p-3 rounded-lg text-sm italic text-gray-300 border-l-2 border-primary">
                                    "{insp.comments}"
                                </div>
                            )}

                            {/* Défauts listés */}
                            {!insp.is_valid && Object.keys(insp.defects).length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Défauts listés :</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(insp.defects).filter(([k, v]) => v).map(([k]) => (
                                            <span key={k} className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded border border-red-500/20">
                                                {k}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 pt-0 space-y-2">
                            {insp.photo && (
                                <button 
                                    onClick={() => setSelectedImage(insp.photo?.startsWith('http') ? insp.photo : `${getBaseURL()}${insp.photo}`)}
                                    className="block w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary text-center text-xs font-bold rounded-lg transition-colors border border-primary/20 cursor-pointer"
                                >
                                    VOIR PHOTO DE PREUVE
                                </button>
                            )}
                            <button 
                                onClick={() => downloadInspectionPdf(insp.id)}
                                className="block w-full py-2 bg-white/5 hover:bg-white/10 text-white text-center text-xs font-bold rounded-lg transition-colors border border-white/10"
                            >
                                TÉLÉCHARGER RAPPORT PDF
                            </button>
                            <button 
                                onClick={() => toggleReadStatus(insp.id, insp.is_read)}
                                className={`block w-full py-2 text-center text-xs font-bold rounded-lg transition-colors border ${
                                    insp.is_read 
                                    ? 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20' 
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                                }`}
                            >
                                {insp.is_read ? 'MARQUER COMME NON LU' : 'MARQUER COMME LU'}
                            </button>
                            {insp.is_read && (
                                <button 
                                    onClick={() => handleDelete(insp.id)}
                                    className="block w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-center text-xs font-bold rounded-lg transition-colors border border-red-500/20"
                                >
                                    SUPPRIMER LE RAPPORT
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredInspections.length === 0 && (
                <div className="text-center py-24 bg-white/5 rounded-3xl border border-dashed border-white/10 mt-8">
                    <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <h3 className="text-xl font-bold text-gray-400">Aucun rapport trouvé</h3>
                    <p className="text-gray-500 mt-2">Essayez de modifier vos filtres ou votre recherche.</p>
                </div>
            )}

            {/* Modal de visualisation d'image */}
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
