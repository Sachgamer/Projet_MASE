'use client';

import React, { useEffect, useState } from 'react';
import api, { getBaseURL, downloadInspectionPdf } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Loader2, CheckCircle2, AlertCircle, Camera, ChevronRight, ChevronLeft, HardHat, Wrench, Truck, Plus, Save } from 'lucide-react';

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
    category: 'EPI' | 'EQUIPEMENT' | 'VEHICULE';
    type_name: string;
    serial_number: string;
    expiration_date: string;
    technician: number; 
}

// Vue principale pour effectuer un auto-contrôle (multistep form)
export default function ControleView() {
    const { user } = useAuth();
    const [step, setStep] = useState(1); // Étape du formulaire (1 à 4)
    const [category, setCategory] = useState<'EPI' | 'EQUIPEMENT' | 'VEHICULE' | null>(null);
    const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
    const [defects, setDefects] = useState<Record<string, boolean>>({}); // Défauts cochés pour EPI/Équipement
    const [vehicleChecks, setVehicleChecks] = useState<Record<string, boolean>>({}); // Points de contrôle véhicule (Oui/Non)
    const [photo, setPhoto] = useState<File | null>(null);
    const [comments, setComments] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false); // État de réussite après envoi
    const [lastInspectionId, setLastInspectionId] = useState<number | null>(null);

    // États spécifiques à l'administration
    const [usersList, setUsersList] = useState<UserItem[]>([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [newEquip, setNewEquip] = useState({
        category: 'EPI',
        type_name: '',
        serial_number: '',
        expiration_date: '',
        technician: ''
    });
    const isAdmin = user?.is_staff || user?.is_superuser;

    useEffect(() => {
        if (user) {
            fetchEquipment();
            if (isAdmin) {
                fetchUsers();
            }
        }
    }, [user, isAdmin]);

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
    const handleCategorySelect = (cat: 'EPI' | 'EQUIPEMENT' | 'VEHICULE') => {
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
        if (isPhotoRequired && !photo) {
            alert("Veuillez fournir une preuve visuelle (photo) obligatoire pour l'auto-contrôle.");
            return;
        }

        setSubmitting(true);
        const formData = new FormData();
        formData.append('item', selectedItem.id.toString());
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

        formData.append('is_valid', (Object.values(defects).every(v => !v) && allVehicleChecksPassed).toString());
        formData.append('defects', JSON.stringify(defects));
        formData.append('vehicle_checks', JSON.stringify(vehicleChecks));
        formData.append('comments', comments);
        if (photo) {
            formData.append('photo', photo);
        }

        try {
            const response = await api.post('/api/controls/inspections/', formData);
            setLastInspectionId(response.data.id);
            setSuccess(true);
            setStep(4);
        } catch (error) {
            console.error("Error submitting inspection:", error);
            alert("Erreur lors de l'envoi de l'auto-contrôle.");
        } finally {
            setSubmitting(false);
        }
    };

    // Crée et assigne un nouvel équipement (Admin uniquement)
    const handleCreateEquipment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...newEquip };
            // Pas de date d'expiration pour les véhicules (pas de contrôle semestriel EPI)
            if (payload.category === 'VEHICULE' || !payload.expiration_date) {
                // @ts-ignore
                delete payload.expiration_date;
            }
            await api.post('/api/controls/equipment/', payload);
            alert("Équipement ajouté et assigné avec succès !");
            setNewEquip({ category: 'EPI', type_name: '', serial_number: '', expiration_date: '', technician: '' });
            setShowAdminPanel(false);
            fetchEquipment();
        } catch (error) {
            console.error("Error creating equipment:", error);
            alert("Erreur lors de la création de l'équipement.");
        }
    };

    // Réinitialise le formulaire pour un nouveau contrôle
    const reset = () => {
        setStep(1);
        setCategory(null);
        setSelectedItem(null);
        setDefects({});
        setVehicleChecks({});
        setPhoto(null);
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
                <h1 className="text-4xl font-extrabold text-white text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                    Auto-contrôle Technique & Sécurité
                </h1>
                {isAdmin && (
                    <Button
                        onClick={() => setShowAdminPanel(!showAdminPanel)}
                        variant={showAdminPanel ? "outline" : "default"}
                        className="flex items-center gap-2"
                    >
                        {showAdminPanel ? "Fermer Gestion" : <><Plus className="w-4 h-4" /> Gérer les équipements</>}
                    </Button>
                )}
            </div>

            {/* Panneau d'administration pour la gestion du parc matériel */}
            {isAdmin && showAdminPanel && (
                <div className="mb-12 bg-white/5 border border-primary/30 rounded-2xl p-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-primary/10">
                    <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                        <Wrench className="text-primary" /> Assigner un nouvel équipement
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
                                <option value="EPI">EPI</option>
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
                            <label className="text-sm text-gray-400">Assigner à</label>
                            <select
                                value={newEquip.technician}
                                onChange={e => setNewEquip({ ...newEquip, technician: e.target.value })}
                                className="w-full bg-secondary/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                                required
                            >
                                <option value="">Sélectionner un utilisateur</option>
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
                                <Save className="w-4 h-4" /> Assigner et Sauvegarder
                            </Button>
                        </div>
                    </form>
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
                    {/* Étape 1 : Choix de la catégorie (EPI, Matériel, Véhicule) */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                                <ChevronRight className="text-primary" /> Choisissez une catégorie
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <button
                                    onClick={() => handleCategorySelect('EPI')}
                                    className="group p-8 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                                >
                                    <HardHat className="w-12 h-12 mx-auto mb-4 text-primary group-hover:scale-110 transition-transform" />
                                    <span className="text-xl font-medium text-white">EPI</span>
                                    <p className="text-sm text-gray-400 mt-2">Équipement de Protection Individuelle</p>
                                </button>
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
                                {equipment.filter(e => e.category === category && e.technician === user?.id).length > 0 ? (
                                    equipment.filter(e => e.category === category && e.technician === user?.id).map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleItemSelect(item)}
                                            className="flex items-center justify-between p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
                                        >
                                            <div>
                                                <p className="text-lg font-semibold text-white">{item.type_name}</p>
                                                <p className="text-sm text-gray-400">{item.category === 'VEHICULE' ? "Plaque : " : "S/N : "}{item.serial_number}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs uppercase text-gray-500 mb-1">Date limite de contrôle</p>
                                                <p className={`text-sm font-medium ${!item.expiration_date ? 'text-gray-400' : new Date(item.expiration_date) < new Date() ? 'text-red-400' : 'text-green-400'}`}>
                                                    {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : 'N/A'}
                                                </p>
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
                                        /* Case à cocher pour les défauts EPI/Équipement */
                                        <div className="space-y-4">
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Recherche de défauts</p>
                                            {(category === 'EPI' ? ['Trou', 'Déchirure', 'Cassé', 'Absent'] : ['Dysfonctionnement', 'HS', 'Altéré']).map(defect => (
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
                                    {/* Capture de photo (obligatoire en cas de défaut ou pour véhicule) */}
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Preuve visuelle {(category === 'VEHICULE' || Object.values(defects).some(v => v)) ? '(Requis)' : '(Optionnel)'}</p>
                                        <div
                                            onClick={() => document.getElementById('photo-upload')?.click()}
                                            className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${photo ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-white/20 bg-white/5'
                                                }`}
                                        >
                                            <input
                                                id="photo-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                                            />
                                            {photo ? (
                                                <>
                                                    <CheckCircle2 className="w-8 h-8 text-primary mb-2" />
                                                    <p className="text-sm text-white font-medium">{photo.name}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Cliquer pour changer</p>
                                                </>
                                            ) : (
                                                <>
                                                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                                                    <p className="text-sm text-gray-400">Prendre une photo</p>
                                                </>
                                            )}
                                        </div>
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
                                        onClick={() => downloadInspectionPdf(lastInspectionId)}
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
