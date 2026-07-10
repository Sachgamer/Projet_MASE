'use client';

import { useEffect, useState } from 'react';
import api, { getHabilitations, createHabilitation, deleteHabilitation } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { 
    Award, 
    Plus, 
    Trash2, 
    Calendar, 
    User, 
    FileText, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle,
    Search
} from 'lucide-react';

interface Habilitation {
    id: number;
    user: number;
    username: string;
    user_fullname: string;
    type_name: 'sst' | 'caces' | 'elec' | 'hauteur' | 'medical' | 'other';
    type_name_display: string;
    custom_title: string | null;
    obtained_date: string;
    expiration_date: string;
    certificate: string | null;
    created_at: string;
}

interface UserOption {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
}

export default function HabilitationListView() {
    const { user } = useAuth();
    const [habilitations, setHabilitations] = useState<Habilitation[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Create form state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formUser, setFormUser] = useState('');
    const [formType, setFormType] = useState('sst');
    const [formTitle, setFormTitle] = useState('');
    const [formObtainedDate, setFormObtainedDate] = useState('');
    const [formExpirationDate, setFormExpirationDate] = useState('');
    const [formFile, setFormFile] = useState<File | null>(null);

    const isAdmin = user && (user.is_staff || user.is_superuser);

    useEffect(() => {
        fetchHabilitations();
        if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin]);

    const fetchHabilitations = async () => {
        try {
            const response = await getHabilitations();
            setHabilitations(response.data);
        } catch (error) {
            console.error("Erreur de récupération des habilitations:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users/');
            setUsers(response.data);
        } catch (error) {
            console.error("Erreur de récupération des utilisateurs:", error);
        }
    };

    const handleCreateHabilitation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formObtainedDate || !formExpirationDate) return;

        try {
            const formData = new FormData();
            // If admin, use selected user. Otherwise, backend defaults to logged user.
            if (isAdmin && formUser) {
                formData.append('user', formUser);
            }
            formData.append('type_name', formType);
            formData.append('custom_title', formTitle);
            formData.append('obtained_date', formObtainedDate);
            formData.append('expiration_date', formExpirationDate);
            if (formFile) {
                formData.append('certificate', formFile);
            }

            await createHabilitation(formData);

            // Reset
            setFormUser('');
            setFormType('sst');
            setFormTitle('');
            setFormObtainedDate('');
            setFormExpirationDate('');
            setFormFile(null);
            setShowCreateModal(false);

            fetchHabilitations();
        } catch (error) {
            console.error("Erreur de création de l'habilitation:", error);
            alert("Erreur lors de la création");
        }
    };

    const handleDeleteHabilitation = async (id: number) => {
        if (window.confirm("Voulez-vous vraiment supprimer cette habilitation ?")) {
            try {
                await deleteHabilitation(id);
                setHabilitations(prev => prev.filter(h => h.id !== id));
            } catch (error) {
                console.error("Erreur de suppression:", error);
            }
        }
    };

    // Expiry check logic
    const getExpirationStatus = (expDateStr: string) => {
        const expDate = new Date(expDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const timeDiff = expDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysDiff < 0) {
            return {
                label: 'Expiré',
                color: 'text-red-400 bg-red-500/10 border-red-500/20',
                icon: <XCircle className="w-4 h-4 text-red-500" />
            };
        } else if (daysDiff <= 30) {
            return {
                label: `Expire sous ${daysDiff} j.`,
                color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                icon: <AlertTriangle className="w-4 h-4 text-orange-500" />
            };
        } else {
            return {
                label: 'Valide',
                color: 'text-green-400 bg-green-500/10 border-green-500/20',
                icon: <CheckCircle2 className="w-4 h-4 text-green-500" />
            };
        }
    };

    const filteredHabilitations = habilitations.filter(h => {
        const term = searchTerm.toLowerCase();
        return (
            h.username.toLowerCase().includes(term) ||
            h.user_fullname.toLowerCase().includes(term) ||
            h.type_name_display.toLowerCase().includes(term) ||
            (h.custom_title && h.custom_title.toLowerCase().includes(term))
        );
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                        Habilitations & Visites Médicales
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Consultez et suivez la conformité des habilitations (SST, CACES, Électrique) et examens médicaux de vos équipes.
                    </p>
                </div>
                {isAdmin && (
                    <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Ajouter un Certificat
                    </Button>
                )}
            </div>

            {/* Filter / Search Bar */}
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-4 items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par nom de collaborateur, habilitation..."
                    className="w-full bg-transparent border-0 text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                />
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredHabilitations.map((hab) => {
                        const status = getExpirationStatus(hab.expiration_date);
                        return (
                            <div key={hab.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:shadow-lg transition-all backdrop-blur-md flex flex-col justify-between space-y-4">
                                <div className="space-y-3">
                                    {/* Expiration badge */}
                                    <div className="flex justify-between items-start">
                                        <span className={`flex items-center gap-1.5 border text-xs px-2.5 py-0.5 rounded-full font-bold ${status.color}`}>
                                            {status.icon}
                                            {status.label}
                                        </span>
                                        <Award className="w-6 h-6 text-primary/70" />
                                    </div>

                                    {/* Habilitation Title */}
                                    <div>
                                        <h3 className="text-lg font-extrabold text-white">{hab.type_name_display}</h3>
                                        {hab.custom_title && (
                                            <p className="text-sm text-gray-400 font-semibold">{hab.custom_title}</p>
                                        )}
                                    </div>

                                    {/* User Details */}
                                    <div className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 rounded-lg p-2.5">
                                        <User className="w-4 h-4 text-primary" />
                                        <span className="font-bold">{hab.user_fullname || hab.username}</span>
                                    </div>

                                    {/* Dates details */}
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-500">Obtention</span>
                                            <span className="font-bold text-white">{new Date(hab.obtained_date).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-500">Expiration</span>
                                            <span className="font-bold text-white">{new Date(hab.expiration_date).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 border-t border-white/5 pt-4">
                                    {hab.certificate ? (
                                        <a 
                                            href={hab.certificate} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex-1 text-decoration-none"
                                        >
                                            <Button variant="outline" className="w-full text-white border-white/20 hover:bg-white/5 flex items-center justify-center gap-1 text-xs">
                                                <FileText className="w-3.5 h-3.5" />
                                                Voir Justificatif
                                            </Button>
                                        </a>
                                    ) : (
                                        <Button variant="outline" disabled className="flex-1 text-gray-500 border-white/10 bg-transparent flex items-center justify-center gap-1 text-xs">
                                            Aucun Fichier
                                        </Button>
                                    )}

                                    {isAdmin && (
                                        <Button 
                                            variant="destructive" 
                                            className="p-2"
                                            onClick={() => handleDeleteHabilitation(hab.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredHabilitations.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-gray-400">Aucun enregistrement d'habilitation ou visite médicale trouvé.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create Certification Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-secondary/95 border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold">Consigner un Certificat</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer text-xl">×</button>
                        </div>
                        <form onSubmit={handleCreateHabilitation} className="p-6 space-y-4">
                            {isAdmin && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Collaborateur *</label>
                                    <select
                                        required
                                        value={formUser}
                                        onChange={(e) => setFormUser(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="">Sélectionner un collaborateur...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {`${u.first_name} ${u.last_name}`.trim() || u.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Type de document *</label>
                                <select
                                    required
                                    value={formType}
                                    onChange={(e) => setFormType(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                >
                                    <option value="sst">Sauveteur Secouriste du Travail (SST)</option>
                                    <option value="caces">CACES (Engins de chantier)</option>
                                    <option value="elec">Habilitation Électrique</option>
                                    <option value="hauteur">Travail en Hauteur</option>
                                    <option value="medical">Visite Médicale Périodique</option>
                                    <option value="other">Autre Habilitation / Certificat</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Intitulé personnalisé (optionnel)</label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="Ex: H0B0 - Basse Tension"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Date d'obtention *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formObtainedDate}
                                        onChange={(e) => setFormObtainedDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Date d'expiration *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formExpirationDate}
                                        onChange={(e) => setFormExpirationDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Justificatif PDF (optionnel)</label>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setFormFile(e.target.files[0]);
                                        }
                                    }}
                                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:opacity-90 file:cursor-pointer"
                                />
                            </div>

                            <div className="pt-4 border-t border-white/10 flex justify-end gap-2">
                                <Button type="button" variant="outline" className="text-white border-white/20" onClick={() => setShowCreateModal(false)}>
                                    Annuler
                                </Button>
                                <Button type="submit">
                                    Enregistrer
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
