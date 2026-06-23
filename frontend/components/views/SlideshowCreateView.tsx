'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useView } from '@/context/ViewContext';
import { FileUp, File, X } from 'lucide-react';

// Vue permettant à un administrateur ou formateur de créer une nouvelle "Causerie" (formation)
export default function SlideshowCreateView() {
    const { setView } = useView();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null); // Fichier de présentation optionnel à la création
    const [loading, setLoading] = useState(false);

    const [isPublic, setIsPublic] = useState(true);
    const [invitedUsers, setInvitedUsers] = useState<number[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await api.get('/api/users/');
                setAllUsers(response.data.results || response.data);
            } catch (error) {
                console.error("Erreur de récupération des utilisateurs:", error);
            }
        };
        fetchUsers();
    }, []);

    // Gère la création de la présentation et l'upload initial du premier slide
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Création de l'entité Slideshow (Titre + Description + Visibilité + Invitations)
            const response = await api.post('/api/slideshows/', { 
                title, 
                description,
                is_public: isPublic,
                invited_users: invitedUsers
            });
            const slideshowId = response.data.id;

            // 2. Si un fichier a été sélectionné, on le télécharge comme étant le premier slide
            if (file) {
                const MAX_SIZE = 200 * 1024 * 1024; // 200 Mo
                if (file.size > MAX_SIZE) {
                    alert('Fichier trop volumineux. Veuillez réduire la taille du fichier (max. 200 Mo).');
                    setLoading(false);
                    return;
                }
                const formData = new FormData();
                formData.append('slideshow', slideshowId);
                formData.append('file', file);
                formData.append('content', 'Présentation principale'); // Description par défaut
                formData.append('order', '1');

                await api.post('/api/slides/', formData);
            }

            // Redirection vers la vue détaillée pour ajouter d'autres slides ou un quiz
            setView('slideshow-detail', { id: slideshowId });
        } catch (error: any) {
            console.error("Erreur lors de la création de la présentation", error);
            const is413 = error.response?.status === 413 || 
                          (typeof error.response?.data === 'string' && error.response.data.includes('413 Request Entity Too Large')) ||
                          !error.response;

            if (is413) {
                alert('Fichier trop volumineux. Veuillez réduire la taille du fichier (max. 200 Mo).');
            } else {
                alert('Erreur lors de la création. Veuillez réessayer.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 text-white">
            <Button variant="ghost" className="mb-4 text-gray-400" onClick={() => setView('dashboard')}>
                &larr; Retour
            </Button>
            <h1 className="text-2xl font-bold mb-6">Créer une causerie</h1>
            <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 p-6 rounded-lg border border-white/10">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium">Titre</label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        maxLength={100}
                        className="mt-1 block w-full rounded-md bg-white/10 border-white/20 p-2 text-white"
                    />
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium">Description</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        maxLength={500}
                        rows={4}
                        className="mt-1 block w-full rounded-md bg-white/10 border-white/20 p-2 text-white"
                    />
                </div>
                {/* Choix de la visibilité */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Visibilité de la causerie</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-lg cursor-pointer hover:bg-white/10 transition-all flex-1">
                            <input
                                type="radio"
                                name="isPublicRadio"
                                checked={isPublic === true}
                                onChange={() => setIsPublic(true)}
                                className="text-blue-600 focus:ring-0"
                            />
                            <div>
                                <span className="font-semibold text-sm block">Publique</span>
                                <span className="text-xs text-gray-400">Visible par tout le monde.</span>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-lg cursor-pointer hover:bg-white/10 transition-all flex-1">
                            <input
                                type="radio"
                                name="isPublicRadio"
                                checked={isPublic === false}
                                onChange={() => setIsPublic(false)}
                                className="text-blue-600 focus:ring-0"
                            />
                            <div>
                                <span className="font-semibold text-sm block">Privée</span>
                                <span className="text-xs text-gray-400">Uniquement pour les invités.</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Liste d'invitation des utilisateurs */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">
                        Inviter des participants {isPublic ? "(Optionnel - présence obligatoire)" : "(Obligatoire pour voir la causerie)"}
                    </label>
                    <input
                        type="text"
                        placeholder="Rechercher un utilisateur par nom ou pseudo..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full rounded-md bg-white/10 border-white/20 p-2 text-white text-sm"
                    />
                    <div className="max-h-48 overflow-y-auto bg-white/5 border border-white/10 rounded-lg p-2 space-y-1">
                        {allUsers.filter(u => 
                            u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
                            `${u.first_name} ${u.last_name}`.toLowerCase().includes(userSearch.toLowerCase())
                        ).map((u) => {
                            const name = `${u.first_name} ${u.last_name}`.trim() || u.username;
                            const isChecked = invitedUsers.includes(u.id);
                            return (
                                <label key={u.id} className="flex items-center gap-3 py-2 px-3 hover:bg-white/5 rounded-md cursor-pointer transition-colors">
                                    <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                            if (isChecked) {
                                                setInvitedUsers(invitedUsers.filter(id => id !== u.id));
                                            } else {
                                                setInvitedUsers([...invitedUsers, u.id]);
                                            }
                                        }}
                                        className="rounded bg-white/10 border-white/20 text-blue-600 focus:ring-0"
                                    />
                                    <span className="text-sm font-medium text-white">{name} <span className="text-gray-400 font-normal">({u.username})</span></span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Section d'importation de fichier */}
                <div className="flex flex-col gap-4">
                    <label htmlFor="file" className="block text-sm font-medium">Fichier de présentation (Optionnel)</label>
                    <input 
                        id="file"
                        type="file" 
                        accept=".pptx,.odp,.pdf,image/*" 
                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                        className="hidden"
                    />
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => document.getElementById('file')?.click()}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20"
                        >
                            <FileUp className="w-5 h-5" />
                            Parcourir les fichiers
                        </button>
                        
                        {/* Affiche le nom du fichier sélectionné avant l'upload */}
                        {file && (
                            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                                <File className="w-4 h-4 text-blue-400" />
                                <span className="text-sm text-gray-300 truncate max-w-[200px]">{file.name}</span>
                                <button type="button" onClick={() => {
                                    setFile(null);
                                    const fileInput = document.getElementById('file') as HTMLInputElement;
                                    if (fileInput) fileInput.value = '';
                                }} className="text-gray-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Création...' : 'Créer la causerie'}
                </Button>
            </form>
        </div>
    );
}
