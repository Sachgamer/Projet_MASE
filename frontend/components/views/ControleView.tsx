'use client';

import React, { useEffect, useState } from 'react';
import api, { getBaseURL, downloadInspectionPdf, prolongEquipmentItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import { Loader2, CheckCircle2, AlertCircle, Camera, ChevronRight, ChevronLeft, HardHat, Wrench, Truck, Plus, Save, X, Image as ImageIcon, Clock, Trash2 } from 'lucide-react';

// Interface pour les utilisateurs (techniciens)
interface UserItem {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
}

// Interface pour les équipements/véhicules à contrôler
interface EquipmentItem {
    id: number;
    category: 'EQUIPEMENT' | 'VEHICULE';
    type_name: string;
    serial_number: string;
    expiration_date: string;
    technician: number | null;
    technician_name?: string;
    last_controlled_date?: string | null;
    is_valid?: boolean;
}

// Vue principale pour effectuer un auto-contrôle (multistep form)
export default function ControleView() {
    const { user } = useAuth();
    const { viewParams } = useView();
    const isAdmin = user?.is_staff || user?.is_superuser;
    const canManage = user?.is_staff || user?.is_superuser || user?.role === 'admin' || user?.role === 'agency';
    const [step, setStep] = useState(1); // Étape du formulaire (1 à 4)
    const [category, setCategory] = useState<'EQUIPEMENT' | 'VEHICULE' | null>(null);
    const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
    const [defects, setDefects] = useState<Record<string, boolean>>({}); // Défauts cochés pour EPI/Équipement
    const [vehicleChecks, setVehicleChecks] = useState<Record<string, boolean>>({}); // Points de contrôle véhicule (Oui/Non)
    const [photos, setPhotos] = useState<File[]>([]);
    const [comments, setComments] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false); // État de réussite après envoi
    const [lastInspectionId, setLastInspectionId] = useState<number | null>(null);

    // États spécifiques à l'administration
    const [usersList, setUsersList] = useState<UserItem[]>([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [newEquip, setNewEquip] = useState({
        category: 'EQUIPEMENT',
        type_name: '',
        serial_number: '',
        expiration_date: '',
        technician: ''
    });

    const isNearExpiration = (dateStr: string | null) => {
        if (!dateStr) return false;
        const limitDate = new Date(dateStr);
        const today = new Date();
        const diffTime = limitDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
    };

    const handleProlongEquipment = async (id: number) => {
        try {
            await prolongEquipmentItem(id);
            alert("Échéance de l'équipement prolongée de 30 jours !");
            fetchEquipment();
        } catch (error) {
            console.error("Erreur de prolongation:", error);
            alert("Impossible de prolonger l'échéance de cet équipement.");
        }
    };

    useEffect(() => {
        if (user) {
            fetchEquipment();
            if (canManage) {
                fetchUsers();
            }
        }
    }, [user, canManage]);

    useEffect(() => {
        if (viewParams?.itemId && equipment.length > 0) {
            const item = equipment.find(e => e.id === viewParams.itemId);
            if (item) {
                setCategory(item.category);
                setSelectedItem(item);
                setStep(3);
            }
        }
    }, [viewParams, equipment]);

    // Récupère la liste des utilisateurs pour l'assignation (Admin uniquement)
    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users/');
            setUsersList(response.data);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    // Récupère les équipements assignés à l'utilisateur actuel
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

    // Sélection de la catégorie et passage à l'étape 2
    const handleCategorySelect = (cat: 'EQUIPEMENT' | 'VEHICULE') => {
        setCategory(cat);
        setSelectedItem(null);
        setDefects({});
        setVehicleChecks({});
        setStep(2);
    };

    // Sélection de l'élément spécifique et passage à l'étape 3
    const handleItemSelect = (item: EquipmentItem) => {
        setSelectedItem(item);
        setStep(3);
    };

    // Gère le changement d'état d'un défaut (coché/décoché)
    const handleDefectChange = (defect: string) => {
        setDefects(prev => ({ ...prev, [defect]: !prev[defect] }));
    };

    // Gère la réponse (Oui/Non) d'un point de contrôle véhicule
    const handleVehicleCheckChange = (check: string) => {
        setVehicleChecks(prev => ({ ...prev, [check]: !prev[check] }));
    };

    // Envoie le rapport d'auto-contrôle au serveur
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) return;

        // Photo obligatoire si c'est un véhicule ou si des défauts sont détectés
        const isPhotoRequired = category === 'VEHICULE' || Object.values(defects).some(v => v);
        if (isPhotoRequired && photos.length === 0) {
            alert("Veuillez fournir au moins une preuve visuelle (photo) obligatoire pour l'auto-contrôle.");
            return;
        }

        setSubmitting(true);
        const formData = new FormData();
        formData.append('item', selectedItem.id.toString());

        // Vérification de la taille des photos avant envoi
        const MAX_SIZE = 200 * 1024 * 1024; // 200 Mo par fichier (parce que limit globale sur Nginx)
        for (const photo of photos) {
            if (photo.size > MAX_SIZE) {
                alert(`La photo ${photo.name} est trop volumineuse. Veuillez réduire sa taille (max. 200 Mo).`);
                setSubmitting(false);
                return;
            }
        }
        const vehicleCheckpoints = ['Feux (Avant/Arrière/Signalisation)', 'Carrosserie', 'Propreté (Intérieur/Extérieur)', 'Documents techniques présents', 'État des pneus', 'Niveaux (Huile/Liquide de refroidissement)', 'Freins'];

        // Vérifie que tous les points de contrôle véhicule ont été répondus
        if (category === 'VEHICULE') {
            const allAnswered = vehicleCheckpoints.every(check => vehicleChecks[check] !== undefined);
            if (!allAnswered) {
                alert("Veuillez répondre par OUI ou NON à tous les points de contrôle.");
                setSubmitting(false);
                return;
            }
        }

        // Le rapport n'est valide que si aucun défaut n'est coché et (pour véhicule) tout est "OUI"
        const allVehicleChecksPassed = category === 'VEHICULE'
            ? vehicleCheckpoints.every(check => vehicleChecks[check] === true)
            : true;

        const isValid = Object.values(defects).every(v => !v) && allVehicleChecksPassed;

        const fileToBase64 = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });
        };

        if (!navigator.onLine) {
            try {
                const serializedPhotos = await Promise.all(
                    photos.map(async (file) => {
                        const base64 = await fileToBase64(file);
                        return {
                            name: file.name,
                            type: file.type,
                            base64
                        };
                    })
                );
                const offlineData = {
                    item: selectedItem.id,
                    is_valid: isValid,
                    defects,
                    vehicle_checks: vehicleChecks,
                    comments,
                    photos: serializedPhotos
                };
                const pending = JSON.parse(localStorage.getItem('pending_inspections') || '[]');
                pending.push(offlineData);
                localStorage.setItem('pending_inspections', JSON.stringify(pending));
                
                alert("Vous êtes hors-ligne. Votre auto-contrôle a été enregistré localement et sera synchronisé automatiquement dès que vous retrouverez une connexion.");
                setSuccess(true);
                setStep(4);
            } catch (err) {
                console.error("Erreur d'enregistrement local de l'auto-contrôle:", err);
                alert("Erreur lors de l'enregistrement hors-ligne.");
            } finally {
                setSubmitting(false);
            }
            return;
        }

        formData.append('is_valid', isValid.toString());
        formData.append('defects', JSON.stringify(defects));
        formData.append('vehicle_checks', JSON.stringify(vehicleChecks));
        formData.append('comments', comments);
        photos.forEach(photo => {
            formData.append('photos', photo);
        });

        try {
            const response = await api.post('/api/controls/inspections/', formData);
            setLastInspectionId(response.data.id);
            setSuccess(true);
            setStep(4);
        } catch (error: any) {
            console.error("Error submitting inspection:", error);
            const is413 = error.response?.status === 413 || 
                          (typeof error.response?.data === 'string' && error.response.data.includes('413 Request Entity Too Large')) ||
                          !error.response;
            if (is413) {
                alert('Photo trop volumineuse. Veuillez réduire la taille de l\'image (max. 200 Mo).');
            } else {
                alert("Erreur lors de l'envoi de l'auto-contrôle.");
            }
        } finally {
            setSubmitting(false);
        }
    };


    // Crée et assigne un nouvel équipement (Admin/Agence)
    const handleCreateEquipment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...newEquip };
            // Pas de date d'expiration pour les véhicules (pas de contrôle semestriel EPI)
            if (payload.category === 'VEHICULE' || !payload.expiration_date) {
                // @ts-ignore
                delete payload.expiration_date;
            }
            if (!payload.technician) {
                // @ts-ignore
                delete payload.technician;
            }
            await api.post('/api/controls/equipment/', payload);
            alert("Équipement ajouté avec succès !");
            setNewEquip({ category: 'EQUIPEMENT', type_name: '', serial_number: '', expiration_date: '', technician: '' });
            fetchEquipment();
        } catch (error) {
            console.error("Error creating equipment:", error);
            alert("Erreur lors de la création de l'équipement.");
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

    // Réinitialise le formulaire pour un nouveau contrôle
    const reset = () => {
        setStep(1);
        setCategory(null);
        setSelectedItem(null);
        setDefects({});
        setVehicleChecks({});
        setPhotos([]);
        setComments('');
        setSuccess(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                <h1 className="text-4xl font-extrabold text-white text-center">
                    Auto-contrôle Technique & Sécurité
                </h1>
                {canManage && (
                    <Button
                        onClick={() => setShowAdminPanel(!showAdminPanel)}
                        variant={showAdminPanel ? "outline" : "default"}
                        className="flex items-center gap-2"
                    >
                        {showAdminPanel ? "Fermer Gestion" : <><Plus className="w-4 h-4" /> Gérer le parc matériel</>}
                    </Button>
                )}
            </div>

            {/* Panneau d'administration pour la gestion du parc matériel */}
            {canManage && showAdminPanel && (
                <div className="mb-12 bg-white/5 border border-primary/30 rounded-2xl p-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-primary/10">
                    <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                        <Wrench className="text-primary" /> Enregistrer un nouvel équipement
                    </h2>
                    <form onSubmit={handleCreateEquipment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Catégorie</label>
                            <select
                                value={newEquip.category}
                                onChange={e => setNewEquip({ ...newEquip, category: e.target.value })}
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
                            <Button type="submit" className="flex items-center gap-2">
                                <Save className="w-4 h-4" /> Enregistrer le matériel
                            </Button>
                        </div>
                    </form>

                    {/* Liste des équipements existants pour modification */}
                    <div className="mt-12 border-t border-white/10 pt-8">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Wrench className="text-primary w-5 h-5" /> Liste du matériel et affectations
                        </h3>
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
                                            <td className="p-4 text-right">
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
                </div>
            )}

            {/* Stepper : Indicateur d'étape actuelle */}
            {!showAdminPanel && (
                <div className="flex justify-between mb-12 relative px-4">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 z-0"></div>
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${step >= s ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/25' : 'bg-secondary text-gray-500'
                                }`}
                        >
                            {s}
                        </div>
                    ))}
                </div>
            )}

            {!showAdminPanel && (
                <div className="bg-secondary/30 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden">
                    {/* Étape 1 : Choix de la catégorie (Matériel, Véhicule) */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                                <ChevronRight className="text-primary" /> Choisissez une catégorie
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <button
                                    onClick={() => handleCategorySelect('EQUIPEMENT')}
                                    className="group p-8 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                                >
                                    <Wrench className="w-12 h-12 mx-auto mb-4 text-primary group-hover:scale-110 transition-transform" />
                                    <span className="text-xl font-medium text-white">Équipement</span>
                                    <p className="text-sm text-gray-400 mt-2">Matériel technique et outils</p>
                                </button>
                                <button
                                    onClick={() => handleCategorySelect('VEHICULE')}
                                    className="group p-8 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                                >
                                    <Truck className="w-12 h-12 mx-auto mb-4 text-primary group-hover:scale-110 transition-transform" />
                                    <span className="text-xl font-medium text-white">Véhicule</span>
                                    <p className="text-sm text-gray-400 mt-2">Suivi et maintenance véhicule</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Étape 2 : Liste des éléments appartenant à l'utilisateur dans cette catégorie */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                                    <ChevronRight className="text-primary" /> Sélectionnez votre {category?.toUpperCase()}
                                </h2>
                                <Button variant="ghost" onClick={() => setStep(1)} className="text-gray-400">
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {equipment.filter(e => e.category === category && (canManage || e.technician === user?.id)).length > 0 ? (
                                    equipment.filter(e => e.category === category && (canManage || e.technician === user?.id)).map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleItemSelect(item)}
                                            className="flex items-center justify-between p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
                                        >
                                            <div>
                                                <p className="text-lg font-semibold text-white">{item.type_name}</p>
                                                <p className="text-sm text-gray-400">{item.category === 'VEHICULE' ? "Plaque : " : "S/N : "}{item.serial_number}</p>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <p className="text-xs uppercase text-gray-500 mb-1">Date limite de contrôle</p>
                                                <div className="flex items-center gap-1.5">
                                                    {isNearExpiration(item.expiration_date) && (
                                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                    )}
                                                    <p className={`text-sm font-medium ${!item.expiration_date ? 'text-gray-400' : new Date(item.expiration_date) < new Date() ? 'text-red-400' : isNearExpiration(item.expiration_date) ? 'text-red-400 font-bold' : 'text-green-400'}`}>
                                                        {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                                {isNearExpiration(item.expiration_date) && (
                                                    <div 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleProlongEquipment(item.id);
                                                        }}
                                                        className="mt-1 text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer bg-white/5 px-2 py-0.5 rounded border border-white/10"
                                                    >
                                                        <Clock className="w-3 h-3" />
                                                        +30 jours
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-12 bg-white/5 rounded-xl">
                                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                                        <p className="text-gray-400">Aucun élément trouvé dans cette catégorie.</p>
                                        <Button onClick={() => setStep(1)} className="mt-4">Changer de catégorie</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Étape 3 : Formulaire d'inspection avec points de contrôle et photo */}
                    {step === 3 && selectedItem && (
                        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                                    <ChevronRight className="text-primary" /> Inspection : {selectedItem.type_name}
                                </h2>
                                <Button variant="ghost" type="button" onClick={() => setStep(2)} className="text-gray-400">
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    {/* Questions spécifiques aux véhicules (checklist) */}
                                    {category === 'VEHICULE' ? (
                                        <div className="space-y-4">
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Points de contrôle technique</p>
                                            {['Feux (Avant/Arrière/Signalisation)', 'Carrosserie', 'Propreté (Intérieur/Extérieur)', 'Documents techniques présents', 'État des pneus', 'Niveaux (Huile/Liquide de refroidissement)', 'Freins'].map(check => (
                                                <div key={check} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-white/5 border border-white/5">
                                                    <span className="text-white text-sm font-medium">{check}</span>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setVehicleChecks(prev => ({ ...prev, [check]: true }))}
                                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${vehicleChecks[check] === true ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                                        >
                                                            OUI
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setVehicleChecks(prev => ({ ...prev, [check]: false }))}
                                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${vehicleChecks[check] === false ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                                        >
                                                            NON
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        /* Case à cocher pour les défauts Équipement */
                                        <div className="space-y-4">
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Recherche de défauts</p>
                                            {['Dysfonctionnement', 'HS', 'Altéré'].map(defect => (
                                                <label key={defect} className="flex items-center gap-3 p-4 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={defects[defect] || false}
                                                        onChange={() => handleDefectChange(defect)}
                                                        className="w-5 h-5 rounded border-white/20 bg-transparent text-primary focus:ring-primary"
                                                    />
                                                    <span className="text-white">{defect}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    {/* Capture de photos (obligatoire en cas de défaut ou pour véhicule) */}
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Preuve visuelle {(category === 'VEHICULE' || Object.values(defects).some(v => v)) ? '(Requis)' : '(Optionnel)'}</p>
                                        <div
                                            onClick={() => document.getElementById('photo-upload')?.click()}
                                            className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10`}
                                        >
                                            <input
                                                id="photo-upload"
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    // Add only image files
                                                    const newPhotos = files.filter(f => f.type.startsWith('image/'));
                                                    setPhotos(prev => [...prev, ...newPhotos]);
                                                }}
                                            />
                                            <Camera className="w-8 h-8 text-gray-400 mb-2" />
                                            <p className="text-sm text-gray-400">Ajouter des photos</p>
                                            <p className="text-xs text-gray-500 mt-1">Cliquez ici pour sélectionner des fichiers</p>
                                        </div>
                                        
                                        {/* Galerie de photos sélectionnées */}
                                        {photos.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-4">
                                                {photos.map((photoFile, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                                                        <ImageIcon className="w-4 h-4 text-primary" />
                                                        <span className="text-xs text-primary truncate max-w-[120px]">{photoFile.name}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPhotos(prev => prev.filter((_, i) => i !== idx));
                                                            }} 
                                                            className="text-primary hover:text-white"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Commentaires additionnels</p>
                                        <textarea
                                            value={comments}
                                            onChange={(e) => setComments(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary transition-colors min-h-[120px]"
                                            placeholder="Précisez ici les détails de l'auto-contrôle..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/10 flex justify-end">
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={submitting}
                                    className="px-12 py-6 text-lg font-bold shadow-xl shadow-primary/20"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Envoi en cours...
                                        </>
                                    ) : "Valider l'auto-contrôle"}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Étape 4 : Confirmation de succès et téléchargement du PDF */}
                    {step === 4 && (
                        <div className="text-center py-12 animate-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-4">Auto-contrôle Enregistré !</h2>
                            <p className="text-gray-400 text-lg mb-10">
                                Merci, vos vérifications ont été transmises avec succès.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Button onClick={reset} size="lg" variant="outline" className="px-8">
                                    Faire un nouvel auto-contrôle
                                </Button>
                                 {lastInspectionId && (
                                    <button
                                        onClick={() => {
                                            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
                                            const username = user?.username || 'unknown';
                                            const objName = selectedItem?.type_name.replace(/\s+/g, '-').replace(/[^\w\-_\.]/g, '') || 'objet';
                                            const filename = `${username}_${dateStr}_${objName}.pdf`;
                                            downloadInspectionPdf(lastInspectionId, filename);
                                        }}
                                        className="inline-flex items-center justify-center px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                                    >
                                        Télécharger la fiche PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
