'use client';

import { useEffect, useState } from 'react';
import { getHabilitations, prolongHabilitation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
    Award, 
    Calendar, 
    User, 
    FileText, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle,
    Search,
    Clock
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

export default function HabilitationListView() {
    const [habilitations, setHabilitations] = useState<Habilitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const handleProlongHabilitation = async (id: number) => {
        try {
            await prolongHabilitation(id);
            alert("Échéance de l'habilitation prolongée de 30 jours !");
            fetchHabilitations();
        } catch (error) {
            console.error("Erreur de prolongation:", error);
            alert("Impossible de prolonger l'échéance de cette habilitation.");
        }
    };

    useEffect(() => {
        fetchHabilitations();
    }, []);

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
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">
                        Habilitations & Visites Médicales
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Consultez et suivez la conformité des habilitations (SST, CACES, Électrique) et examens médicaux de vos équipes.
                    </p>
                </div>
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
                                            {(() => {
                                                const expD = new Date(hab.expiration_date);
                                                const tod = new Date();
                                                tod.setHours(0, 0, 0, 0);
                                                const diff = Math.ceil((expD.getTime() - tod.getTime()) / (1000 * 3600 * 24));
                                                return diff <= 30;
                                            })() && (
                                                <button 
                                                    onClick={() => handleProlongHabilitation(hab.id)}
                                                    className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5 bg-transparent border-0 cursor-pointer text-left mt-1"
                                                >
                                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                                    Rallonger de 30j
                                                </button>
                                            )}
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
        </div>
    );
}
