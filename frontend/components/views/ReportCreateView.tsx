'use client';

import { useState } from 'react';
import { createReport } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import { Button } from '@/components/ui/button';
import { Camera, Video, Paperclip, X, Image as ImageIcon } from 'lucide-react';

// Vue permettant à un utilisateur de créer une remontée d'accident/incident (QHSE)
export default function ReportCreateView() {
    const { setView } = useView();
    // État local pour les champs du formulaire
    const [formData, setFormData] = useState({
        severity: 'low',
        location: '',
        description: '',
        incident_date: '',
    });
    const [image, setImage] = useState<File | null>(null); // Fichier image attaché
    const [video, setVideo] = useState<File | null>(null); // Fichier vidéo attaché
    const [error, setError] = useState('');

    // Met à jour l'état lors de la saisie dans les champs
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    // Envoie le rapport au serveur via une requête multipart (FormData)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const MAX_SIZE = 100 * 1024 * 1024; // 100 Mo
        if (image && image.size > MAX_SIZE) {
            setError('Fichier trop volumineux. Veuillez réduire la taille de votre image (max. 100 Mo).');
            return;
        }
        if (video && video.size > MAX_SIZE) {
            setError('Fichier trop volumineux. Veuillez réduire la taille de votre vidéo (max. 100 Mo).');
            return;
        }

        try {
            const data = new FormData();
            data.append('severity', formData.severity);
            data.append('location', formData.location);
            data.append('description', formData.description);
            
            // Validation et conversion de la date locale en format ISO pour le backend
            if (!formData.incident_date) {
                setError('Veuillez renseigner la date de l\'incident.');
                return;
            }
            const incidentDate = new Date(formData.incident_date);
            if (isNaN(incidentDate.getTime())) {
                setError('Date invalide.');
                return;
            }
            data.append('incident_date', incidentDate.toISOString());

            // Ajout des fichiers médias si présents
            if (image) data.append('image', image);
            if (video) data.append('video', video);

            await createReport(data);
            // Redirection vers l'historique après succès
            setView('report-list');
        } catch (err: any) {
            console.error('Erreur lors de la création du rapport:', err.response?.data || err.message);
            const is413 = err.response?.status === 413 || 
                          (typeof err.response?.data === 'string' && err.response.data.includes('413 Request Entity Too Large')) ||
                          !err.response;

            if (is413) {
                setError('Fichier trop volumineux. Veuillez réduire la taille de votre image ou vidéo (max. 100 Mo).');
            } else if (err.response?.data) {
                // Évite d'afficher le HTML brut ou de stringifier une string
                const errorMsg = typeof err.response.data === 'string' 
                    ? (err.response.data.includes('<html') ? 'Erreur serveur.' : err.response.data)
                    : JSON.stringify(err.response.data);
                setError(errorMsg);
            } else {
                setError('Erreur lors de la création du rapport.');
            }
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 text-white">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
                <div className="mb-8 border-b border-gray-700 pb-6">
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                        <span className="text-red-500 italic">Remontée d'accident</span>
                    </h1>
                </div>

                {error && <div className="bg-red-500 text-white p-2 rounded mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold mb-2">Gravité</label>
                        <select
                            name="severity"
                            value={formData.severity}
                            onChange={handleChange}
                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
                        >
                            <option value="low">Faible</option>
                            <option value="medium">Moyenne</option>
                            <option value="high">Élevée</option>
                            <option value="critical">Critique</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Lieu</label>
                        <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            required
                            maxLength={100}
                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
                            placeholder="Lieu de l'incident..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Date & Heure</label>
                        <input
                            type="datetime-local"
                            name="incident_date"
                            value={formData.incident_date}
                            onChange={handleChange}
                            required
                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            required
                            maxLength={500}
                            rows={4}
                            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
                        ></textarea>
                    </div>

                    {/* Section de gestion des pièces jointes */}
                    <div className="flex flex-col gap-4">
                        <label className="text-sm font-bold">Médias (Photo/Vidéo)</label>
                        <input
                            id="media-upload"
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                files.forEach(file => {
                                    if (file.type.startsWith('image/')) setImage(file);
                                    if (file.type.startsWith('video/')) setVideo(file);
                                });
                            }}
                            className="hidden"
                        />
                        <div className="flex flex-wrap gap-4">
                            <button
                                type="button"
                                onClick={() => document.getElementById('media-upload')?.click()}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg border border-gray-600 transition-all shadow-lg"
                            >
                                <Paperclip className="w-5 h-5 text-red-500" />
                                Ajouter des médias
                            </button>

                            {/* Prévisualisation des noms de fichiers sélectionnés */}
                            {(image || video) && (
                                <div className="flex flex-wrap gap-2">
                                    {image && (
                                        <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                                            <ImageIcon className="w-4 h-4 text-red-400" />
                                            <span className="text-xs text-red-400 truncate max-w-[150px]">{image.name}</span>
                                            <button type="button" onClick={() => setImage(null)} className="text-red-500 hover:text-white">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                    {video && (
                                        <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                                            <Video className="w-4 h-4 text-blue-400" />
                                            <span className="text-xs text-blue-400 truncate max-w-[150px]">{video.name}</span>
                                            <button type="button" onClick={() => setVideo(null)} className="text-blue-500 hover:text-white">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 uppercase font-bold tracking-wider">
                        Envoyer la remontée
                    </Button>
                </form>
            </div>
        </div>
    );
}
