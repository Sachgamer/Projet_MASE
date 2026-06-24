'use client';

import { useState, useEffect } from 'react';
import { createReport } from '@/lib/api';
import { useView } from '@/context/ViewContext';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Camera, 
    Video, 
    Paperclip, 
    X, 
    Image as ImageIcon, 
    MapPin, 
    Calendar, 
    AlertTriangle, 
    FileText, 
    Check, 
    ArrowRight, 
    ArrowLeft, 
    Send, 
    Navigation, 
    Sparkles, 
    Trash2 
} from 'lucide-react';

interface PreviewFile {
    file: File;
    url: string;
    type: 'image' | 'video';
}

export default function ReportCreateView() {
    const { setView } = useView();
    
    // Étape active (1: Lieu & Date, 2: Détails, 3: Médias & Envoi)
    const [step, setStep] = useState(1);
    
    // État local pour les champs textuels du formulaire
    const [formData, setFormData] = useState({
        severity: 'low',
        incident_type: 'dangerous_situation',
        location: '',
        description: '',
        incident_date: '',
    });

    // Fichiers sélectionnés avec leurs URLs d'aperçu
    const [attachedFiles, setAttachedFiles] = useState<PreviewFile[]>([]);
    
    // Pour la gestion du glisser-déposer
    const [isDragOver, setIsDragOver] = useState(false);
    
    // Indicateur de présence d'un brouillon à restaurer
    const [hasDraft, setHasDraft] = useState(false);
    const [geolocating, setGeolocating] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Vérifie si un brouillon existe dans le localStorage au montage
    useEffect(() => {
        const draft = localStorage.getItem('report_create_draft');
        if (draft) {
            setHasDraft(true);
        }
    }, []);

    // Sauvegarde automatique des données textuelles à chaque changement
    useEffect(() => {
        if (formData.location || formData.description || formData.incident_date) {
            localStorage.setItem('report_create_draft', JSON.stringify(formData));
        }
    }, [formData]);

    // Libère les URLs d'aperçu pour éviter les fuites de mémoire
    useEffect(() => {
        return () => {
            attachedFiles.forEach(file => URL.revokeObjectURL(file.url));
        };
    }, []);

    // Restaure les données du brouillon
    const restoreDraft = () => {
        try {
            const draft = localStorage.getItem('report_create_draft');
            if (draft) {
                const parsed = JSON.parse(draft);
                setFormData(parsed);
                setHasDraft(false);
            }
        } catch (e) {
            console.error('Erreur de restauration du brouillon:', e);
        }
    };

    // Supprime le brouillon
    const discardDraft = () => {
        localStorage.removeItem('report_create_draft');
        setHasDraft(false);
    };

    // Récupère la position géographique de l'utilisateur (utile pour les chantiers extérieurs mobiles)
    const handleGeolocate = () => {
        if (!navigator.geolocation) {
            alert("La géolocalisation n'est pas supportée par votre navigateur.");
            return;
        }
        setGeolocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setFormData(prev => ({
                    ...prev,
                    location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Chantier extérieur)`
                }));
                setGeolocating(false);
            },
            (err) => {
                console.error("Erreur de géolocalisation:", err);
                alert("Impossible de récupérer la position GPS. Veuillez renseigner le lieu manuellement.");
                setGeolocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Met à jour les champs de saisie standards
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    // Ajoute des fichiers au tableau de médias attachés
    const addFiles = (files: File[]) => {
        const newFiles: PreviewFile[] = [];
        files.forEach(file => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            if (isImage || isVideo) {
                newFiles.push({
                    file,
                    url: URL.createObjectURL(file),
                    type: isImage ? 'image' : 'video'
                });
            }
        });

        if (newFiles.length > 0) {
            setAttachedFiles(prev => [...prev, ...newFiles]);
        }
    };

    // Supprime un média sélectionné
    const removeFile = (index: number) => {
        setAttachedFiles(prev => {
            const fileToRemove = prev[index];
            if (fileToRemove) {
                URL.revokeObjectURL(fileToRemove.url);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    // Gestion du glisser-déposer
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    // Soumission du formulaire
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        const MAX_SIZE = 200 * 1024 * 1024; // 200 Mo

        // Séparation des images et vidéos
        const imageFiles = attachedFiles.filter(f => f.type === 'image').map(f => f.file);
        const videoFiles = attachedFiles.filter(f => f.type === 'video').map(f => f.file);

        // Validation des tailles
        for (const fileItem of attachedFiles) {
            if (fileItem.file.size > MAX_SIZE) {
                setError(`Le fichier "${fileItem.file.name}" est trop volumineux (max 200 Mo).`);
                setIsSubmitting(false);
                return;
            }
        }

        try {
            const data = new FormData();
            data.append('severity', formData.severity);
            data.append('incident_type', formData.incident_type);
            data.append('location', formData.location);
            data.append('description', formData.description);
            
            if (!formData.incident_date) {
                setError('Veuillez renseigner la date de l\'incident.');
                setIsSubmitting(false);
                return;
            }
            const incidentDate = new Date(formData.incident_date);
            if (isNaN(incidentDate.getTime())) {
                setError('Date invalide.');
                setIsSubmitting(false);
                return;
            }
            data.append('incident_date', incidentDate.toISOString());

            // Envoi des images
            imageFiles.forEach(imgFile => {
                data.append('photos', imgFile);
            });

            // Envoi de la première vidéo si présente (selon le modèle backend actuel)
            if (videoFiles.length > 0) {
                data.append('video', videoFiles[0]);
            }

            await createReport(data);
            
            // Nettoyage du brouillon et des aperçus
            localStorage.removeItem('report_create_draft');
            attachedFiles.forEach(f => URL.revokeObjectURL(f.url));
            
            setView('report-list');
        } catch (err: any) {
            console.error('Erreur lors de la création du rapport:', err.response?.data || err.message);
            const is413 = err.response?.status === 413 || 
                          (typeof err.response?.data === 'string' && err.response.data.includes('413 Request Entity Too Large')) ||
                          !err.response;

            if (is413) {
                setError('Fichier trop volumineux. Veuillez réduire la taille de vos médias (max. 200 Mo).');
            } else if (err.response?.data) {
                const errorMsg = typeof err.response.data === 'string' 
                    ? (err.response.data.includes('<html') ? 'Erreur serveur.' : err.response.data)
                    : JSON.stringify(err.response.data);
                setError(errorMsg);
            } else {
                setError('Erreur lors de la création du rapport.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Validations d'étape
    const isStep1Valid = formData.location.trim().length > 0 && formData.incident_date !== '';
    const isStep2Valid = formData.description.trim().length >= 10;

    const nextStep = () => {
        if (step === 1 && !isStep1Valid) return;
        if (step === 2 && !isStep2Valid) return;
        setStep(prev => prev + 1);
    };

    const prevStep = () => {
        setStep(prev => prev - 1);
    };

    // Explications et couleurs pour les niveaux de gravité
    const getSeverityDetails = (sev: string) => {
        switch (sev) {
            case 'low': return { label: 'Faible', desc: 'Risque ou anomalie mineure, presque aucun impact physique.', border: 'border-l-green-500', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.15)] focus-within:ring-green-500/50' };
            case 'medium': return { label: 'Moyenne', desc: 'Dégât matériel léger ou incident corporel mineur sans arrêt.', border: 'border-l-yellow-500', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)] focus-within:ring-yellow-500/50' };
            case 'high': return { label: 'Élevée', desc: 'Accident avec arrêt de travail ou dégât matériel notable.', border: 'border-l-orange-500', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.2)] focus-within:ring-orange-500/50' };
            case 'critical': return { label: 'Critique', desc: 'Accident très grave, hospitalisation urgente ou décès.', border: 'border-l-red-600 shadow-[inset_4px_0_0_0_rgba(239,68,68,0.5)]', glow: 'shadow-[0_0_25px_rgba(239,68,68,0.25)] focus-within:ring-red-500/50' };
            default: return { label: sev, desc: '', border: 'border-l-gray-700', glow: '' };
        }
    };

    // Explications des 4 catégories
    const getCategoryDetails = (cat: string) => {
        switch (cat) {
            case 'dangerous_situation': return { label: 'Situation dangereuse', desc: 'Comportement ou état de fait présentant un danger potentiel.' };
            case 'near_miss': return { label: 'Presque accident', desc: 'Événement qui aurait pu causer un accident mais a été évité de justesse.' };
            case 'accident': return { label: 'Accident', desc: 'Événement soudain ayant provoqué une blessure ou un dégât matériel.' };
            case 'fatal_accident': return { label: 'Accident mortel', desc: 'Accident du travail d\'une gravité majeure ayant entraîné un décès.' };
            default: return { label: cat, desc: '' };
        }
    };

    const activeSeverity = getSeverityDetails(formData.severity);
    const activeCategory = getCategoryDetails(formData.incident_type);

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 text-white">
            
            {/* Bannière de Restauration de Brouillon */}
            {hasDraft && (
                <div className="mb-6 p-4 bg-blue-900/60 backdrop-blur-md rounded-2xl border border-blue-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-white">Brouillon en cours trouvé</h4>
                            <p className="text-xs text-blue-200">Vous avez un rapport non validé enregistré localement.</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                            onClick={restoreDraft}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-lg shadow cursor-pointer w-full sm:w-auto"
                        >
                            Restaurer
                        </button>
                        <button 
                            onClick={discardDraft}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-lg border border-gray-700 cursor-pointer w-full sm:w-auto text-gray-300 hover:text-white"
                        >
                            Ignorer
                        </button>
                    </div>
                </div>
            )}

            {/* Container Principal du Formulaire */}
            <div className={`bg-gray-800/80 backdrop-blur-md p-6 md:p-8 rounded-3xl shadow-2xl border border-gray-700/50 transition-all duration-300 border-l-4 ${activeSeverity.border} ${activeSeverity.glow}`}>
                
                {/* En-tête */}
                <div className="mb-8 border-b border-gray-700/60 pb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase">
                            Déclarer une remontée
                        </h1>
                        <p className="text-xs text-gray-400 mt-1">Formulaire de sécurité obligatoire conforme aux normes MASE.</p>
                    </div>
                    <button
                        onClick={() => setView('report-list')}
                        className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:bg-gray-700/50 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                        Retour historique
                    </button>
                </div>

                {/* Indicateur d'Étapes */}
                <div className="flex justify-between items-center mb-8 relative">
                    <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gray-700 -translate-y-1/2 z-0" />
                    {[1, 2, 3].map((s) => (
                        <div 
                            key={s} 
                            className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all duration-300 border ${
                                step === s 
                                    ? 'bg-blue-600 border-blue-500 text-white ring-4 ring-blue-500/25 scale-110' 
                                    : step > s 
                                        ? 'bg-green-600 border-green-500 text-white' 
                                        : 'bg-gray-800 border-gray-700 text-gray-400'
                             }`}
                        >
                            {step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="bg-red-500/20 border border-red-500/30 text-red-200 p-4 rounded-xl mb-6 flex items-center gap-2 animate-in fade-in duration-200">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    <AnimatePresence mode="wait">
                        
                        {/* ÉTAPE 1 : QUAND & OÙ */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                <div className="p-4 bg-gray-900/40 border border-gray-700/30 rounded-2xl">
                                    <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 mb-1">
                                        <MapPin className="w-4 h-4 text-blue-400" />
                                        Informations géographiques & temporelles
                                    </h3>
                                    <p className="text-xs text-gray-400">Renseignez précisément où et quand s'est déroulé l'événement sur vos chantiers.</p>
                                </div>

                                {/* Lieu de l'incident */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 flex justify-between items-center">
                                        <span>Lieu ou Nom du Chantier *</span>
                                        <button
                                            type="button"
                                            onClick={handleGeolocate}
                                            disabled={geolocating}
                                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/20"
                                        >
                                            <Navigation className={`w-3 h-3 ${geolocating ? 'animate-spin' : ''}`} />
                                            {geolocating ? 'Géolocalisation...' : 'Me géolocaliser'}
                                        </button>
                                    </label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        required
                                        maxLength={200}
                                        className="w-full p-3 rounded-xl bg-gray-900/60 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500 text-sm"
                                        placeholder="Ex: Chantier X - Autoroute A13, PK 24..."
                                    />
                                </div>

                                {/* Date & Heure */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-blue-400" />
                                        Date & Heure de l'incident *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        name="incident_date"
                                        value={formData.incident_date}
                                        onChange={handleChange}
                                        required
                                        className="w-full p-3 rounded-xl bg-gray-900/60 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* ÉTAPE 2 : DÉTAILS DE L'INCIDENT */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Catégorie d'incident */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 flex items-center gap-1">
                                        Type de Remontée (Catégorie) *
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {[
                                            { id: 'dangerous_situation', label: 'Situation dangereuse', color: 'border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400' },
                                            { id: 'near_miss', label: 'Presque accident', color: 'border-orange-500/20 hover:border-orange-500/40 text-orange-400' },
                                            { id: 'accident', label: 'Accident', color: 'border-red-500/20 hover:border-red-500/40 text-red-400' },
                                            { id: 'fatal_accident', label: 'Accident mortel', color: 'border-red-900/40 hover:border-red-900 text-red-500 bg-red-950/20' }
                                        ].map((cat) => {
                                            const isSelected = formData.incident_type === cat.id;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, incident_type: cat.id }))}
                                                    className={`p-3 rounded-xl border text-left text-sm font-semibold transition-all duration-200 flex justify-between items-center cursor-pointer ${
                                                        isSelected 
                                                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg scale-[1.02]' 
                                                            : `bg-gray-900/60 text-gray-300 ${cat.color}`
                                                    }`}
                                                >
                                                    <span>{cat.label}</span>
                                                    {isSelected && <Check className="w-4 h-4 text-white" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-2 italic bg-gray-900/20 p-2 rounded-lg border border-gray-700/20">
                                        💡 {activeCategory.desc}
                                    </p>
                                </div>

                                {/* Niveau de Gravité */}
                                <div>
                                    <label className="block text-sm font-bold mb-2">
                                        Niveau de Gravité estimé *
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { id: 'low', label: 'Faible', color: 'hover:border-green-500/40 active:bg-green-500/20', activeColor: 'bg-green-600 border-green-500' },
                                            { id: 'medium', label: 'Moyen', color: 'hover:border-yellow-500/40 active:bg-yellow-500/20', activeColor: 'bg-yellow-600 border-yellow-500' },
                                            { id: 'high', label: 'Élevé', color: 'hover:border-orange-500/40 active:bg-orange-500/20', activeColor: 'bg-orange-600 border-orange-500' },
                                            { id: 'critical', label: 'Critique', color: 'hover:border-red-500/40 active:bg-red-500/20', activeColor: 'bg-red-600 border-red-500' }
                                        ].map((g) => {
                                            const isSelected = formData.severity === g.id;
                                            return (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, severity: g.id }))}
                                                    className={`py-2 px-1 rounded-lg border text-center text-xs font-bold transition-all cursor-pointer ${
                                                        isSelected 
                                                            ? `${g.activeColor} text-white shadow-md scale-105` 
                                                            : `bg-gray-900/60 border-gray-700 text-gray-300 ${g.color}`
                                                    }`}
                                                >
                                                    {g.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-2 italic bg-gray-900/20 p-2 rounded-lg border border-gray-700/20">
                                        📌 {activeSeverity.desc}
                                    </p>
                                </div>

                                {/* Description détaillée */}
                                <div>
                                    <label className="block text-sm font-bold mb-2 flex justify-between items-center">
                                        <span>Explication détaillée (Qu'est-ce qu'il s'est passé ?) *</span>
                                        <span className={`text-xs ${formData.description.length >= 450 ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                                            {formData.description.length} / 500
                                        </span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute top-3 left-3 text-gray-400 pointer-events-none">
                                            <FileText className="w-4 h-4" />
                                        </span>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            required
                                            maxLength={500}
                                            rows={5}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-900/60 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500 text-sm"
                                            placeholder="Décrivez précisément les faits, les équipements concernés, les mesures immédiates de protection prises..."
                                        />
                                    </div>
                                    <span className="text-[10px] text-gray-500">Minimum 10 caractères. Soyez le plus factuel possible.</span>
                                </div>
                            </motion.div>
                        )}

                        {/* ÉTAPE 3 : MÉDIAS ET ENVOI */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                <div className="p-4 bg-gray-900/40 border border-gray-700/30 rounded-2xl">
                                    <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 mb-1">
                                        <Camera className="w-4 h-4 text-blue-400" />
                                        Preuves & médias joints (Facultatif)
                                    </h3>
                                    <p className="text-xs text-gray-400">Ajoutez des photos ou des vidéos pour documenter la remontée d'accident. Limite globale de 200 Mo par fichier.</p>
                                </div>

                                {/* Zone Drag & Drop */}
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => document.getElementById('media-upload-form')?.click()}
                                    className={`p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
                                        isDragOver 
                                            ? 'bg-blue-600/10 border-blue-500 scale-[1.01]' 
                                            : 'bg-gray-900/40 border-gray-700 hover:border-gray-600 hover:bg-gray-900/60'
                                    }`}
                                >
                                    <input
                                        id="media-upload-form"
                                        type="file"
                                        multiple
                                        accept="image/*,video/*"
                                        onChange={(e) => {
                                            if (e.target.files) {
                                                addFiles(Array.from(e.target.files));
                                            }
                                        }}
                                        className="hidden"
                                    />
                                    
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="p-3 bg-gray-800 border border-gray-700 rounded-full text-gray-400">
                                            <Paperclip className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">Faites glisser des fichiers ou cliquez pour importer</p>
                                            <p className="text-xs text-gray-400 mt-1">Formats acceptés : Photos (PNG, JPEG) et Vidéos (MP4, MOV)</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Prévisualisations des miniatures */}
                                {attachedFiles.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fichiers sélectionnés ({attachedFiles.length})</h4>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {attachedFiles.map((fileObj, idx) => (
                                                <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-700 bg-gray-900 flex items-center justify-center shadow-md">
                                                    {fileObj.type === 'image' ? (
                                                        <img src={fileObj.url} className="object-cover w-full h-full" alt="Miniature" />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center p-2 text-center w-full h-full">
                                                            <Video className="w-8 h-8 text-blue-400" />
                                                            <span className="text-[9px] text-gray-400 truncate w-full mt-1">{fileObj.file.name}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Hover overlay de suppression */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                                            className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer border-none"
                                                            title="Supprimer le fichier"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Récapitulatif condensé */}
                                <div className="p-4 bg-gray-900/60 border border-gray-800 rounded-2xl space-y-2 text-xs text-gray-300">
                                    <h4 className="font-bold text-white uppercase text-[10px] tracking-widest text-gray-400">Récapitulatif</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-gray-500">Lieu :</span> {formData.location}
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Type d'incident :</span> <span className="font-semibold text-blue-400">{activeCategory.label}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Gravité :</span> <span className="font-semibold text-orange-400">{activeSeverity.label}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Date :</span> {formData.incident_date ? new Date(formData.incident_date).toLocaleString('fr-FR') : ''}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        
                    </AnimatePresence>

                    {/* Pied de formulaire : Boutons de navigation */}
                    <div className="flex gap-4 border-t border-gray-700/60 pt-6 mt-6">
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={prevStep}
                                disabled={isSubmitting}
                                className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl border border-gray-600 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Précédent
                            </button>
                        )}
                        
                        {step < 3 ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:border-gray-800 disabled:text-gray-500 text-white font-bold rounded-xl border-none transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
                            >
                                Continuer
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-bold rounded-xl border-none transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg uppercase tracking-wider"
                            >
                                {isSubmitting ? (
                                    <>
                                        Enregistrement en cours...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Envoyer la remontée
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
