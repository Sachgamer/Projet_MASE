'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Shield, Trash2, Search, Clock, AlertCircle, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Interface pour les adresses MAC bloquées
interface BlockedMac {
    id: number;
    mac_address: string;
    blocked_at: string;
    reason: string;
    failed_attempts: number;
    is_active: boolean;
    notes: string | null;
    user: number | null;
    username: string | null;
    user_email: string | null;
    user_full_name: string | null;
}

// Vue pour l'administrateur permettant de voir toutes les adresses MAC bloquées
export default function BlockedMacListView() {
    const { user } = useAuth();
    const [blockedMacs, setBlockedMacs] = useState<BlockedMac[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchBlockedMacs();
    }, []);

    // Récupère toutes les adresses MAC bloquées (Admin seulement via API)
    const fetchBlockedMacs = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/blocked-macs/');
            setBlockedMacs(response.data);
        } catch (error) {
            console.error("Error fetching blocked MACs:", error);
        } finally {
            setLoading(false);
        }
    };

    // Débloque une adresse MAC en la supprimant
    const handleUnblock = async (id: number) => {
        if (!window.confirm("Êtes-vous sûr de vouloir débloquer cette adresse MAC ?")) {
            return;
        }

        try {
            await api.delete(`/api/blocked-macs/${id}/`);
            setBlockedMacs(blockedMacs.filter(mac => mac.id !== id));
        } catch (error) {
            console.error("Error unblocking MAC:", error);
            alert("Erreur lors du déverrouillage.");
        }
    };

    // Filtre les MACs selon la recherche
    const filteredMacs = blockedMacs.filter(mac => {
        const searchInput = searchTerm.toLowerCase();
        return (
            mac.mac_address.toLowerCase().includes(searchInput) ||
            mac.reason.toLowerCase().includes(searchInput) ||
            (mac.username && mac.username.toLowerCase().includes(searchInput)) ||
            (mac.user_email && mac.user_email.toLowerCase().includes(searchInput)) ||
            (mac.user_full_name && mac.user_full_name.toLowerCase().includes(searchInput))
        );
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
                        Adresses MAC Bloquées
                    </h1>
                    <p className="text-gray-400 mt-2">Gestion des machines bannies après plusieurs tentatives 2FA infructueuses</p>
                </div>
            </div>

            {/* Barre de recherche */}
            <div className="mb-8 relative max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    type="text"
                    placeholder="Rechercher par adresse MAC ou raison..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
            </div>

            {/* Liste des MACs bloquées */}
            {filteredMacs.length > 0 ? (
                <div className="grid gap-4">
                    {filteredMacs.map(mac => (
                        <div key={mac.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-red-500/30 hover:bg-red-500/5 transition-all">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                        <Shield className="w-5 h-5 text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-mono font-semibold text-white">{mac.mac_address}</p>
                                        <p className="text-xs text-gray-500">Bloquée le {new Date(mac.blocked_at).toLocaleDateString('fr-FR', { 
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}</p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    mac.is_active ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {mac.is_active ? '🚫 BLOQUÉE' : '✅ DÉVERROUILLÉE'}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Raison du blocage</p>
                                    <p className="text-sm text-gray-300">{mac.reason}</p>
                                </div>

                                {mac.username && (
                                    <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-sm flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <UserIcon className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Utilisateur concerné</p>
                                            <p className="text-sm text-white font-medium">
                                                {mac.user_full_name || mac.username}
                                                <span className="text-gray-400 font-mono text-xs ml-2">(@{mac.username})</span>
                                            </p>
                                            {mac.user_email && (
                                                <p className="text-xs text-gray-400">{mac.user_email}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 font-bold">Tentatives infructueuses</p>
                                        <p className="text-lg font-bold text-red-400 mt-1">{mac.failed_attempts}/5</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 font-bold">Date de blocage</p>
                                        <p className="text-sm text-white mt-1 flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            {new Date(mac.blocked_at).toLocaleDateString('fr-FR')}
                                        </p>
                                    </div>
                                </div>

                                {mac.notes && (
                                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-sm text-blue-300">
                                        <p className="font-semibold flex items-center gap-2 mb-1">
                                            <AlertCircle className="w-4 h-4" />
                                            Notes supplémentaires
                                        </p>
                                        <p>{mac.notes}</p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    {mac.is_active && (
                                        <Button
                                            onClick={() => handleUnblock(mac.id)}
                                            variant="destructive"
                                            size="sm"
                                            className="flex-1 flex items-center justify-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Débloquer cette machine
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 bg-white/5 rounded-3xl border border-dashed border-white/10 mt-8">
                    <Shield className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <h3 className="text-xl font-bold text-gray-400">Aucune machine bloquée</h3>
                    <p className="text-gray-500 mt-2">C'est une bonne nouvelle ! Aucune adresse MAC n'est actuellement bloquée.</p>
                </div>
            )}
        </div>
    );
}
