'use client';

import { useEffect, useState } from 'react';
import api, { getUsers, createUser, updateUser, deleteUser, getAgencies, createAgency } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
    Users, 
    Plus, 
    Edit, 
    Trash2, 
    Search, 
    Building2, 
    Check, 
    X, 
    Lock, 
    Shield, 
    Target,
    Activity
} from 'lucide-react';

interface Agency {
    id: number;
    name: string;
    region: string;
}

interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
    is_superuser: boolean;
    is_active: boolean;
    agency: number | null;
    agency_name: string | null;
    agency_region: string | null;
    min_slideshows_per_year: number;
}

export default function UserManagementView() {
    const [usersList, setUsersList] = useState<User[]>([]);
    const [agenciesList, setAgenciesList] = useState<Agency[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals visibility states
    const [showUserModal, setShowUserModal] = useState(false);
    const [showAgencyModal, setShowAgencyModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // User Form State
    const [formUsername, setFormUsername] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formFirstName, setFormFirstName] = useState('');
    const [formLastName, setFormLastName] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formAgency, setFormAgency] = useState<number | ''>('');
    const [formMinSlides, setFormMinSlides] = useState(10);
    const [formIsActive, setFormIsActive] = useState(true);

    // Agency Form State
    const [agencyName, setAgencyName] = useState('');
    const [agencyRegion, setAgencyRegion] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersRes, agenciesRes] = await Promise.all([
                getUsers(),
                getAgencies()
            ]);
            setUsersList(usersRes.data);
            setAgenciesList(agenciesRes.data);
        } catch (err) {
            console.error("Erreur de chargement des données utilisateurs/agences:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreateModal = () => {
        setSelectedUser(null);
        setFormUsername('');
        setFormEmail('');
        setFormFirstName('');
        setFormLastName('');
        setFormPassword('');
        setFormAgency('');
        setFormMinSlides(10);
        setFormIsActive(true);
        setShowUserModal(true);
    };

    const handleOpenEditModal = (u: User) => {
        setSelectedUser(u);
        setFormUsername(u.username);
        setFormEmail(u.email);
        setFormFirstName(u.first_name);
        setFormLastName(u.last_name);
        setFormPassword(''); // blank unless they want to override password
        setFormAgency(u.agency || '');
        setFormMinSlides(u.min_slideshows_per_year);
        setFormIsActive(u.is_active);
        setShowUserModal(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {
            username: formUsername,
            email: formEmail,
            first_name: formFirstName,
            last_name: formLastName,
            agency: formAgency === '' ? null : Number(formAgency),
            min_slideshows_per_year: Number(formMinSlides),
            is_active: formIsActive
        };

        if (formPassword.trim()) {
            payload.password = formPassword;
        }

        try {
            if (selectedUser) {
                await updateUser(selectedUser.id, payload);
            } else {
                if (!formPassword.trim()) {
                    alert("Le mot de passe est obligatoire pour la création.");
                    return;
                }
                await createUser(payload);
            }
            setShowUserModal(false);
            loadData();
        } catch (err: any) {
            console.error("Erreur lors de l'enregistrement de l'utilisateur:", err);
            alert(err.response?.data?.detail || "Erreur de validation. Veuillez vérifier les champs (ex: username unique).");
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (window.confirm("Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.")) {
            try {
                await deleteUser(id);
                loadData();
            } catch (err) {
                console.error("Erreur de suppression:", err);
                alert("Erreur lors de la suppression de l'utilisateur.");
            }
        }
    };

    const handleSaveAgency = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agencyName.trim() || !agencyRegion.trim()) return;

        try {
            await createAgency({ name: agencyName, region: agencyRegion });
            setAgencyName('');
            setAgencyRegion('');
            setShowAgencyModal(false);
            const res = await getAgencies();
            setAgenciesList(res.data);
        } catch (err) {
            console.error("Erreur de création d'agence:", err);
            alert("Impossible de créer l'agence (le nom doit être unique).");
        }
    };

    const filteredUsers = usersList.filter(u => {
        const query = searchTerm.toLowerCase();
        return (
            u.username.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query) ||
            (u.first_name || '').toLowerCase().includes(query) ||
            (u.last_name || '').toLowerCase().includes(query) ||
            (u.agency_name || '').toLowerCase().includes(query) ||
            (u.agency_region || '').toLowerCase().includes(query)
        );
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                        <Users className="w-8 h-8 text-primary" />
                        Gestion des Utilisateurs
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Configurez les comptes des collaborateurs, leurs agences régionales et leurs objectifs de causeries annuels.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setShowAgencyModal(true)} variant="outline" className="flex items-center gap-2 border-white/20 text-white hover:bg-white/5">
                        <Building2 className="w-4 h-4 text-primary" />
                        Nouvelle Agence
                    </Button>
                    <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Nouvel Utilisateur
                    </Button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-4 items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par nom, email, agence, région..."
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
                                    <th className="p-4 font-semibold">Identifiant / Nom</th>
                                    <th className="p-4 font-semibold">Email</th>
                                    <th className="p-4 font-semibold">Agence (Région)</th>
                                    <th className="p-4 font-semibold">Objectif causeries</th>
                                    <th className="p-4 font-semibold">Statut / Rôle</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{u.username}</div>
                                            <div className="text-xs text-gray-400 mt-0.5">{u.first_name} {u.last_name}</div>
                                        </td>
                                        <td className="p-4 text-xs text-gray-300">{u.email}</td>
                                        <td className="p-4">
                                            {u.agency_name ? (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <Building2 className="w-3.5 h-3.5 text-primary" />
                                                    <span className="font-semibold text-white">{u.agency_name}</span>
                                                    <span className="text-gray-400 font-normal">({u.agency_region})</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-500 italic">Aucune</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1 text-xs font-semibold text-white">
                                                <Target className="w-3.5 h-3.5 text-orange-400" />
                                                {u.min_slideshows_per_year} / an
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                    {u.is_active ? 'Actif' : 'Inactif'}
                                                </span>
                                                {(u.is_staff || u.is_superuser) && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-0.5">
                                                        <Shield className="w-3 h-3" />
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEditModal(u)}
                                                    className="p-1.5 rounded bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary/30 transition-colors text-white cursor-pointer"
                                                    title="Modifier"
                                                >
                                                    <Edit className="w-3.5 h-3.5 text-primary" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    className="p-1.5 rounded bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 transition-colors text-white cursor-pointer"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-gray-500 italic">Aucun utilisateur trouvé</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Add/Edit User */}
            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4">
                        <button 
                            onClick={() => setShowUserModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            {selectedUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
                        </h2>
                        
                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Identifiant (Unique)</label>
                                    <input 
                                        type="text"
                                        value={formUsername}
                                        onChange={(e) => setFormUsername(e.target.value)}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                        required
                                        disabled={selectedUser !== null}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Adresse Email</label>
                                    <input 
                                        type="email"
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Prénom</label>
                                    <input 
                                        type="text"
                                        value={formFirstName}
                                        onChange={(e) => setFormFirstName(e.target.value)}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Nom</label>
                                    <input 
                                        type="text"
                                        value={formLastName}
                                        onChange={(e) => setFormLastName(e.target.value)}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Agence (Région)</label>
                                    <select
                                        value={formAgency}
                                        onChange={(e) => setFormAgency(e.target.value)}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none cursor-pointer"
                                    >
                                        <option value="">-- Choisir une agence --</option>
                                        {agenciesList.map(a => (
                                            <option key={a.id} value={a.id}>{a.name} ({a.region})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Objectif Causeries / An</label>
                                    <input 
                                        type="number"
                                        value={formMinSlides}
                                        onChange={(e) => setFormMinSlides(Number(e.target.value))}
                                        className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                        required
                                        min={1}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    Mot de passe {selectedUser && "(Laisser vide pour ne pas modifier)"}
                                </label>
                                <input 
                                    type="password"
                                    value={formPassword}
                                    onChange={(e) => setFormPassword(e.target.value)}
                                    className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                    required={!selectedUser}
                                    placeholder={selectedUser ? "••••••••" : "Saisir le mot de passe"}
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input 
                                    type="checkbox"
                                    id="isActiveCheckbox"
                                    checked={formIsActive}
                                    onChange={(e) => setFormIsActive(e.target.checked)}
                                    className="rounded bg-gray-800 border-white/20 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                />
                                <label htmlFor="isActiveCheckbox" className="text-xs font-bold text-gray-300 cursor-pointer">Compte collaborateur actif</label>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="border-white/20 text-white hover:bg-white/5"
                                    onClick={() => setShowUserModal(false)}
                                >
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

            {/* Modal Add Agency */}
            {showAgencyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative space-y-4">
                        <button 
                            onClick={() => setShowAgencyModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-primary" />
                            Créer une Agence
                        </h2>
                        
                        <form onSubmit={handleSaveAgency} className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase">Nom de l'agence (Unique)</label>
                                <input 
                                    type="text"
                                    value={agencyName}
                                    onChange={(e) => setAgencyName(e.target.value)}
                                    placeholder="Ex: Agence Ouest, Agence Paris"
                                    className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase">Région</label>
                                <input 
                                    type="text"
                                    value={agencyRegion}
                                    onChange={(e) => setAgencyRegion(e.target.value)}
                                    placeholder="Ex: Bretagne, Île-de-France"
                                    className="w-full bg-gray-800 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="border-white/20 text-white hover:bg-white/5"
                                    onClick={() => setShowAgencyModal(false)}
                                >
                                    Annuler
                                </Button>
                                <Button type="submit">
                                    Créer l'agence
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
