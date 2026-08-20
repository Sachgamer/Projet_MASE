'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Plus, Save, Wrench, Trash2, Shield, AlertCircle, UserPlus, X } from 'lucide-react';

interface UserItem {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
}

interface EquipmentItem {
    id: number;
    category: 'EQUIPEMENT' | 'VEHICULE';
    type_name: string;
    serial_number: string;
    expiration_date: string | null;
    technician: number | null;
    technician_name?: string;
    technician_username?: string;
}

export default function EquipmentConfigView() {
    const { user } = useAuth();
    const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
    const [usersList, setUsersList] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [newEquip, setNewEquip] = useState({
        category: 'EQUIPEMENT',
        type_name: '',
        serial_number: '',
        expiration_date: '',
        technician: ''
    });

    const [assigningItem, setAssigningItem] = useState<EquipmentItem | null>(null);
    const [assignmentForm, setAssignmentForm] = useState({
        technician: '',
        serial_number: '',
        expiration_date: ''
    });

    const canManage = user?.is_staff || user?.is_superuser || user?.role === 'admin' || user?.role === 'agency';

    const handleAssignEquipment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assigningItem) return;
        setSubmitting(true);
        try {
            const payload = {
                category: assigningItem.category,
                type_name: assigningItem.type_name,
                technician: assignmentForm.technician ? parseInt(assignmentForm.technician) : null,
                serial_number: assignmentForm.serial_number,
                expiration_date: assignmentForm.expiration_date || null
            };
            if (payload.category === 'VEHICULE' || !payload.expiration_date) {
                // @ts-ignore
                delete payload.expiration_date;
            }
            if (!payload.technician) {
                alert("Veuillez sélectionner un technicien pour l'affectation.");
                setSubmitting(false);
                return;
            }
            await api.post('/api/controls/equipment/', payload);
            alert(`Une instance de "${assigningItem.type_name}" a été attribuée avec succès !`);
            setAssigningItem(null);
            setAssignmentForm({ technician: '', serial_number: '', expiration_date: '' });
            fetchEquipment();
        } catch (error) {
            console.error("Error duplicating/assigning equipment:", error);
            alert("Erreur lors de l'affectation de l'équipement.");
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        if (canManage) {
            fetchEquipment();
            fetchUsers();
        }
    }, [canManage]);

    const fetchEquipment = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/controls/equipment/');
            setEquipment(response.data);
        } catch (error) {
            console.error("Error fetching equipment:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users/');
            setUsersList(response.data);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const handleCreateEquipment = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...newEquip };
            if (payload.category === 'VEHICULE' || !payload.expiration_date) {
                // @ts-ignore
                delete payload.expiration_date;
            }
            if (!payload.technician) {
                // @ts-ignore
                delete payload.technician;
            }
            await api.post('/api/controls/equipment/', payload);
            alert("Équipement enregistré avec succès !");
            setNewEquip({ category: 'EQUIPEMENT', type_name: '', serial_number: '', expiration_date: '', technician: '' });
            fetchEquipment();
        } catch (error) {
            console.error("Error creating equipment:", error);
            alert("Erreur lors de la création de l'équipement.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateTechnician = async (itemId: number, technicianId: string) => {
        try {
            const techVal = technicianId ? parseInt(technicianId) : null;
            await api.patch(`/api/controls/equipment/${itemId}/`, { technician: techVal });
            alert("Affectation mise à jour avec succès !");
            fetchEquipment();
        } catch (error) {
            console.error("Error updating technician assignment:", error);
            alert("Erreur lors de la mise à jour de l'affectation.");
        }
    };

    const handleDeleteEquipment = async (itemId: number) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet équipement ?")) return;
        try {
            await api.delete(`/api/controls/equipment/${itemId}/`);
            alert("Équipement supprimé de la liste globale.");
            fetchEquipment();
        } catch (error) {
            console.error("Error deleting equipment:", error);
            alert("Erreur lors de la suppression de l'équipement.");
        }
    };

    if (!canManage) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
                <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl max-w-xl mx-auto shadow-lg backdrop-blur-md">
                    <p className="font-extrabold text-xl mb-2">Accès refusé</p>
                    <p className="text-sm font-medium">Vous n'avez pas l'autorisation d'accéder à la gestion du parc matériel.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 space-y-10 text-white">
            <div>
                <h1 className="text-4xl font-extrabold flex items-center gap-3">
                    <Wrench className="text-primary w-10 h-10" />
                    Gestion du Parc Matériel
                </h1>
                <p className="text-sm text-gray-400 mt-1">Enregistrez de nouveaux équipements ou véhicules et gérez leurs affectations aux techniciens.</p>
            </div>

            {/* Formulaire d'enregistrement */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-xl backdrop-blur-md">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                    <Plus className="text-primary w-6 h-6" /> Ajouter un matériel
                </h2>
                <form onSubmit={handleCreateEquipment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Catégorie</label>
                        <select
                            value={newEquip.category}
                            onChange={e => setNewEquip({ ...newEquip, category: e.target.value as any })}
                            className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                            required
                        >
                            <option value="EQUIPEMENT">Équipement</option>
                            <option value="VEHICULE">Véhicule</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">
                            {newEquip.category === 'VEHICULE' ? "Modèle du véhicule" : "Nom / Modèle"}
                        </label>
                        <input
                            type="text"
                            value={newEquip.type_name}
                            onChange={e => setNewEquip({ ...newEquip, type_name: e.target.value })}
                            className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                            placeholder={newEquip.category === 'VEHICULE' ? "ex: Renault Kangoo" : "ex: Harnais de sécurité"}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Assigner à (Optionnel)</label>
                        <select
                            value={newEquip.technician}
                            onChange={e => setNewEquip({ ...newEquip, technician: e.target.value })}
                            className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="">Enregistré en général (non assigné)</option>
                            {usersList.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.first_name} {u.last_name} ({u.username})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">
                            {newEquip.category === 'VEHICULE' ? "Plaque d'immatriculation" : "Numéro de série (Optionnel)"}
                        </label>
                        <input
                            type="text"
                            value={newEquip.serial_number}
                            onChange={e => setNewEquip({ ...newEquip, serial_number: e.target.value })}
                            className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                            placeholder={newEquip.category === 'VEHICULE' ? "ex: AB-123-CD" : "S/N..."}
                            required={newEquip.category === 'VEHICULE'}
                        />
                    </div>
                    {newEquip.category !== 'VEHICULE' && (
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Date limite de contrôle (Optionnel)</label>
                            <input
                                type="date"
                                value={newEquip.expiration_date}
                                onChange={e => setNewEquip({ ...newEquip, expiration_date: e.target.value })}
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                            />
                        </div>
                    )}
                    <div className="md:col-span-2 flex justify-end mt-2">
                        <Button type="submit" disabled={submitting} className="flex items-center gap-2 px-6 py-3 cursor-pointer bg-primary hover:bg-primary/80">
                            <Save className="w-4 h-4" /> {submitting ? "Enregistrement..." : "Enregistrer le matériel"}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Liste du matériel */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-xl backdrop-blur-md">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                    <Wrench className="text-primary w-6 h-6" /> Liste du matériel et affectations
                </h2>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left border-collapse bg-secondary/10">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <th className="p-4">Catégorie</th>
                                <th className="p-4">Nom / Modèle</th>
                                <th className="p-4">N° de série / Plaque</th>
                                <th className="p-4">Échéance</th>
                                <th className="p-4">Assigné à</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                            {equipment.map(item => (
                                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-semibold">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.category === 'VEHICULE' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                            {item.category === 'VEHICULE' ? 'VÉHICULE' : 'ÉQUIPEMENT'}
                                        </span>
                                    </td>
                                    <td className="p-4 font-bold text-white">{item.type_name}</td>
                                    <td className="p-4 font-mono text-gray-400">{item.serial_number || 'N/A'}</td>
                                    <td className={`p-4 font-semibold ${item.expiration_date && new Date(item.expiration_date) < new Date() ? 'text-red-400' : 'text-gray-400'}`}>
                                        {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString('fr-FR') : 'N/A'}
                                    </td>
                                    <td className="p-4">
                                        <select
                                            value={item.technician || ''}
                                            onChange={e => handleUpdateTechnician(item.id, e.target.value)}
                                            className="bg-secondary/50 border border-white/10 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-primary max-w-[200px]"
                                        >
                                            <option value="">Non assigné (Général)</option>
                                            {usersList.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.first_name} {u.last_name} ({u.username})
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setAssigningItem(item);
                                                setAssignmentForm({
                                                    technician: '',
                                                    serial_number: item.serial_number || '',
                                                    expiration_date: item.expiration_date || ''
                                                });
                                            }}
                                            className="p-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                                            title="Attribuer à un technicien (créer une copie)"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            Attribuer
                                        </button>
                                        <button
                                            onClick={() => handleDeleteEquipment(item.id)}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer"
                                            title="Supprimer l'équipement"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {equipment.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500 italic">
                                        Aucun équipement enregistré dans le parc matériel.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal d'affectation (Duplication/Attribution d'équipement) */}
            {assigningItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-secondary border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6 relative animate-in zoom-in duration-300">
                        <button
                            onClick={() => setAssigningItem(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <UserPlus className="text-primary w-5 h-5" />
                                Attribuer ce matériel
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                Créer une copie personnalisée de <strong>{assigningItem.type_name}</strong> pour un technicien.
                            </p>
                        </div>

                        <form onSubmit={handleAssignEquipment} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400">Technicien *</label>
                                <select
                                    value={assignmentForm.technician}
                                    onChange={e => setAssignmentForm({ ...assignmentForm, technician: e.target.value })}
                                    className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary text-sm"
                                    required
                                >
                                    <option value="">Sélectionnez un technicien</option>
                                    {usersList.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.first_name} {u.last_name} ({u.username})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                    {assigningItem.category === 'VEHICULE' ? "Plaque d'immatriculation *" : "Numéro de série spécifique (Optionnel)"}
                                </label>
                                <input
                                    type="text"
                                    value={assignmentForm.serial_number}
                                    onChange={e => setAssignmentForm({ ...assignmentForm, serial_number: e.target.value })}
                                    className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary text-sm"
                                    placeholder={assigningItem.category === 'VEHICULE' ? "ex: AB-123-CD" : "S/N spécifique..."}
                                    required={assigningItem.category === 'VEHICULE'}
                                />
                            </div>

                            {assigningItem.category !== 'VEHICULE' && (
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400">Date limite de contrôle (Optionnel)</label>
                                    <input
                                        type="date"
                                        value={assignmentForm.expiration_date}
                                        onChange={e => setAssignmentForm({ ...assignmentForm, expiration_date: e.target.value })}
                                        className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary text-sm"
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setAssigningItem(null)}
                                    className="border-white/10 text-white hover:bg-white/5 cursor-pointer text-sm"
                                >
                                    Annuler
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-primary hover:bg-primary/80 text-white font-bold cursor-pointer text-sm"
                                >
                                    Valider et attribuer
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
