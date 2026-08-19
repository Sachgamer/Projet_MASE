'use client';

import { useEffect, useState } from 'react';
import api, { getPeriodicVisits, createPeriodicVisit, deletePeriodicVisit, prolongPeriodicVisit } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { 
    Calendar, 
    Plus, 
    Trash2, 
    Download, 
    Search, 
    AlertTriangle,
    Info,
    ShieldAlert,
    UserCheck,
    FileText,
    Clock,
    X,
    PlusCircle
} from 'lucide-react';

interface PeriodicVisit {
    id: number;
    visit_type: string;
    visit_type_display: string;
    custom_type: string | null;
    date: string;
    next_due_date: string | null;
    comments: string | null;
    inspector: string | null;
    document: string | null;
    created_at: string;
}

export default function PeriodicVisitsView() {
    const { user } = useAuth();
    const [visits, setVisits] = useState<PeriodicVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Create form state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formType, setFormType] = useState('electricity');
    const [formCustomType, setFormCustomType] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formNextDueDate, setFormNextDueDate] = useState('');
    const [formComments, setFormComments] = useState('');
    const [formInspector, setFormInspector] = useState('');
    const [formFile, setFormFile] = useState<File | null>(null);

    const isAdmin = user && (user.is_staff || user.is_superuser);

    useEffect(() => {
        fetchVisits();
    }, []);

    const fetchVisits = async () => {
        try {
            const response = await getPeriodicVisits();
            setVisits(response.data);
        } catch (error) {
            console.error("Erreur de récupération des visites périodiques:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formDate) return;

        try {
            const formData = new FormData();
            formData.append('visit_type', formType);
            if (formType === 'other') {
                formData.append('custom_type', formCustomType);
            }
            formData.append('date', formDate);
            if (formNextDueDate) {
                formData.append('next_due_date', formNextDueDate);
            }
            formData.append('comments', formComments);
            formData.append('inspector', formInspector);
            if (formFile) {
                formData.append('document', formFile);
            }

            await createPeriodicVisit(formData);

            // Reset Form
            setFormType('electricity');
            setFormCustomType('');
            setFormDate('');
            setFormNextDueDate('');
            setFormComments('');
            setFormInspector('');
            setFormFile(null);
            setShowCreateModal(false);

            fetchVisits();
        } catch (error) {
            console.error("Erreur lors de la création de la visite périodique:", error);
            alert("Erreur de création du registre.");
        }
    };

    const handleDeleteVisit = async (id: number) => {
        if (window.confirm("Voulez-vous vraiment supprimer ce rapport de visite périodique ?")) {
            try {
                await deletePeriodicVisit(id);
                setVisits(prev => prev.filter(v => v.id !== id));
            } catch (error) {
                console.error("Erreur lors de la suppression:", error);
            }
        }
    };

    const handleProlongVisit = async (id: number) => {
        try {
            const response = await prolongPeriodicVisit(id);
            alert(response.data.detail || "Échéance prolongée de 30 jours !");
            fetchVisits();
        } catch (error) {
            console.error("Erreur de prolongation:", error);
            alert("Impossible de prolonger cette échéance.");
        }
    };

    const isNearDeadline = (dateStr: string | null) => {
        if (!dateStr) return false;
        const limitDate = new Date(dateStr);
        const today = new Date();
        const diffTime = limitDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
    };

    const filteredVisits = visits.filter(v => {
        const term = searchTerm.toLowerCase();
        const typeLabel = v.visit_type === 'other' ? (v.custom_type || 'Autre') : v.visit_type_display;
        return (
            typeLabel.toLowerCase().includes(term) ||
            (v.inspector || '').toLowerCase().includes(term) ||
            (v.comments || '').toLowerCase().includes(term)
        );
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                        <ShieldAlert className="w-8 h-8 text-primary" />
                        Registre des Visites Périodiques Obligatoires
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Suivi des contrôles réglementaires des installations (Électricité, Eaux, Harnais antichute, etc.).
                    </p>
                </div>
                {isAdmin && (
                    <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Enregistrer une Visite
                    </Button>
                )}
            </div>

            {/* Warning alert */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-blue-800 dark:text-blue-200">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                    <span className="font-bold">Norme MASE :</span> Toutes les installations électriques et équipements de levage/anti-chute doivent faire l'objet de vérifications périodiques annuelles documentées avec traçabilité des anomalies.
                </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-4 items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par type de visite, organisme d'inspection, remarques..."
                    className="w-full bg-transparent border-0 text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-semibold">Type de visite</th>
                                    <th className="p-4 font-semibold">Date de visite</th>
                                    <th className="p-4 font-semibold">Inspecteur / Organisme</th>
                                    <th className="p-4 font-semibold">Prochaine Échéance</th>
                                    <th className="p-4 font-semibold">Observations</th>
                                    <th className="p-4 font-semibold text-right">Rapport / Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredVisits.map((v) => {
                                    const nearDead = isNearDeadline(v.next_due_date);
                                    return (
                                        <tr key={v.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-bold text-white">
                                                {v.visit_type === 'other' ? (v.custom_type || 'Autre') : v.visit_type_display}
                                            </td>
                                            <td className="p-4 text-xs text-gray-300">
                                                {new Date(v.date).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="p-4 text-xs font-semibold text-blue-400">
                                                {v.inspector || 'N/A'}
                                            </td>
                                            <td className="p-4">
                                                {v.next_due_date ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border w-fit ${
                                                            nearDead 
                                                                ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' 
                                                                : 'bg-green-500/10 text-green-400 border-green-500/20'
                                                        }`}>
                                                            {new Date(v.next_due_date).toLocaleDateString('fr-FR')}
                                                        </span>
                                                        {nearDead && (
                                                            <button 
                                                                onClick={() => handleProlongVisit(v.id)}
                                                                className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5 bg-transparent border-0 cursor-pointer text-left"
                                                            >
                                                                <Clock className="w-3 h-3" />
                                                                Rallonger de 30j
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-500">Non définie</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-xs text-gray-400 max-w-xs truncate italic">
                                                {v.comments || 'Aucune observation'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    {v.document ? (
                                                        <a 
                                                            href={v.document} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                        >
                                                            <Button variant="outline" className="p-2 border-white/20 text-white hover:bg-white/5" title="Télécharger le rapport PDF">
                                                                <Download className="w-4 h-4 text-primary" />
                                                            </Button>
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic p-2">Sans PDF</span>
                                                    )}
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={() => handleDeleteVisit(v.id)}
                                                            className="p-2 rounded bg-white/5 border border-white/10 hover:bg-red-500/20 transition-colors text-white cursor-pointer"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredVisits.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-gray-500 italic">Aucune visite enregistrée</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Create Visit */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4">
                        <button 
                            onClick={() => setShowCreateModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <PlusCircle className="w-5 h-5 text-primary" />
                            Enregistrer une visite périodique
                        </h2>
                        
                        <form onSubmit={handleCreateVisit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Type d'installation</label>
                                    <select
                                        value={formType}
                                        onChange={(e) => setFormType(e.target.value)}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none cursor-pointer"
                                    >
                                        <option value="electricity">Électricité</option>
                                        <option value="water">Eaux</option>
                                        <option value="harness">Harnais</option>
                                        <option value="other">Autre (Préciser...)</option>
                                    </select>
                                </div>
                                {formType === 'other' && (
                                    <div className="space-y-1 animate-in fade-in duration-200">
                                        <label className="block text-xs font-bold text-gray-400 uppercase">Nom du type personnalisé</label>
                                        <input 
                                            type="text"
                                            value={formCustomType}
                                            onChange={(e) => setFormCustomType(e.target.value)}
                                            placeholder="Ex: Ventilation, Levage"
                                            className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Date de visite</label>
                                    <input 
                                        type="date"
                                        value={formDate}
                                        onChange={(e) => setFormDate(e.target.value)}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Prochaine Échéance</label>
                                    <input 
                                        type="date"
                                        value={formNextDueDate}
                                        onChange={(e) => setFormNextDueDate(e.target.value)}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase">Organisme d'inspection / Inspecteur</label>
                                <input 
                                    type="text"
                                    value={formInspector}
                                    onChange={(e) => setFormInspector(e.target.value)}
                                    placeholder="Ex: Veritas, Apave"
                                    className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase">Observations / Commentaires</label>
                                <textarea 
                                    value={formComments}
                                    onChange={(e) => setFormComments(e.target.value)}
                                    placeholder="Observations, anomalies relevées, actions correctives associées..."
                                    rows={3}
                                    className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none resize-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase">Rapport de visite (Document PDF)</label>
                                <input 
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setFormFile(e.target.files[0]);
                                        }
                                    }}
                                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary file:text-white hover:file:bg-primary/95 cursor-pointer file:cursor-pointer"
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="border-white/20 text-white hover:bg-white/5"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Annuler
                                </Button>
                                <Button type="submit">
                                    Enregistrer la visite
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
