'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import { FileUp, File, X, Trash2, ChevronLeft, ChevronRight, Play, Settings, Plus } from 'lucide-react';

// Interface représentant un slide (une diapositive de la formation)
interface Slide {
    id: number;
    file: string; // URL du fichier (image ou PDF)
    content: string; // Texte de description du slide
    order: number; // Ordre d'affichage
}

// Interface représentant une causerie (formation) complète
interface Slideshow {
    id: number;
    title: string;
    description: string;
    creator: string;
    slides: Slide[];
    is_public: boolean;
    invited_users: number[];
    scheduled_date: string | null;
}

// Vue détaillée d'une causerie (visionneuse de slides + gestion admin)
export default function SlideshowDetailView() {
    const { viewParams, setView } = useView();
    const id = viewParams.id; // ID de la formation actuelle
    const [slideshow, setSlideshow] = useState<Slideshow | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [newSlideContent, setNewSlideContent] = useState('');
    const [newSlideFile, setNewSlideFile] = useState<File | null>(null);
    const [addingSlide, setAddingSlide] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0); // Slide actuellement affiché

    // Navigation : Passe au slide suivant
    const handleNextSlide = () => {
        if (slideshow && currentSlideIndex < slideshow.slides.length - 1) {
            setCurrentSlideIndex(prev => prev + 1);
        }
    };

    // Navigation : Revient au slide précédent
    const handlePrevSlide = () => {
        if (currentSlideIndex > 0) {
            setCurrentSlideIndex(prev => prev - 1);
        }
    };

    // Active la navigation par flèches du clavier
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') handleNextSlide();
            if (e.key === 'ArrowLeft') handlePrevSlide();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSlideIndex, slideshow]);

    // Récupère les données complètes de la causerie au chargement
    useEffect(() => {
        const fetchSlideshow = async () => {
            try {
                const response = await api.get(`/api/slideshows/${id}/`);
                setSlideshow(response.data);
            } catch (error: any) {
                console.error("Failed to fetch slideshow:", error.message);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchSlideshow();
    }, [id]);

    // Ajoute une nouvelle diapositive à la présentation actuelle
    const handleAddSlide = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSlideFile || !slideshow) return;

        const formData = new FormData();
        formData.append('slideshow', slideshow.id.toString());
        formData.append('file', newSlideFile);
        formData.append('content', newSlideContent);
        formData.append('order', (slideshow.slides.length + 1).toString());

        try {
            setAddingSlide(true);
            await api.post('/api/slides/', formData);
            // Rafraîchissement des données après l'ajout
            const updated = await api.get(`/api/slideshows/${id}/`);
            setSlideshow(updated.data);
            setNewSlideContent('');
            setNewSlideFile(null);
            const fileInput = document.getElementById('slide-file') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (error: any) {
            console.error("Erreur lors de l'ajout du slide:", error.message);
            const is413 = error.response?.status === 413 || 
                          (typeof error.response?.data === 'string' && error.response.data.includes('413 Request Entity Too Large')) ||
                          !error.response;

            if (is413) {
                alert('Fichier trop volumineux. Veuillez réduire la taille du fichier (max. 200 Mo).');
            } else {
                alert("Erreur lors de l'ajout du slide.");
            }
        } finally {
            setAddingSlide(false);
        }
    };

    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editIsPublic, setEditIsPublic] = useState(true);
    const [editInvitedUsers, setEditInvitedUsers] = useState<number[]>([]);
    const [editScheduledDate, setEditScheduledDate] = useState('');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [participantsReport, setParticipantsReport] = useState<any[] | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [activeTab, setActiveTab] = useState<'slides' | 'report'>('slides');

    // Fetch users for invitation management
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

    // Fetch participation report when tab changes to 'report'
    useEffect(() => {
        if (activeTab === 'report' && id) {
            fetchReport();
        }
    }, [activeTab, id]);

    const fetchReport = async () => {
        setLoadingReport(true);
        try {
            const response = await api.get(`/api/slideshows/${id}/participants_report/`);
            setParticipantsReport(response.data);
        } catch (error) {
            console.error("Erreur de chargement du rapport de participation:", error);
        } finally {
            setLoadingReport(false);
        }
    };

    // Ouvre le mode édition du titre/description et des invitations
    const handleEditClick = () => {
        if (slideshow) {
            setEditTitle(slideshow.title);
            setEditDescription(slideshow.description);
            setEditIsPublic(slideshow.is_public);
            setEditInvitedUsers(slideshow.invited_users || []);
            setEditScheduledDate(
                slideshow.scheduled_date
                    ? new Date(slideshow.scheduled_date).toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).replace(' ', 'T').substring(0, 16)
                    : ''
            );
            setEditing(true);
        }
    };

    // Met à jour les informations de base de la causerie
    const handleUpdateSlideshow = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (slideshow) {
                await api.patch(`/api/slideshows/${slideshow.id}/`, {
                    title: editTitle,
                    description: editDescription,
                    is_public: editIsPublic,
                    invited_users: editInvitedUsers,
                    scheduled_date: editScheduledDate ? new Date(editScheduledDate).toISOString() : null
                });
                const updated = await api.get(`/api/slideshows/${id}/`);
                setSlideshow(updated.data);
                setEditing(false);
                if (activeTab === 'report') {
                    fetchReport();
                }
            }
        } catch (error: any) {
            console.error("Erreur lors de la mise à jour de la présentation:", error.message);
            alert("Erreur lors de la mise à jour de la présentation");
        }
    };

    // Supprime entièrement la causerie (formation)
    const handleDeleteSlideshow = async () => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette présentation ?")) {
            try {
                if (slideshow) {
                    await api.delete(`/api/slideshows/${slideshow.id}/`);
                    setView('dashboard');
                }
            } catch (error: any) {
                console.error("Erreur lors de la suppression de la présentation:", error.message);
                alert("Erreur lors de la suppression de la présentation");
            }
        }
    };

    // Supprime un slide spécifique
    const handleDeleteSlide = async (slideId: number) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce slide ?")) {
            try {
                await api.delete(`/api/slides/${slideId}/`);
                const updated = await api.get(`/api/slideshows/${id}/`);
                setSlideshow(updated.data);
            } catch (error: any) {
                console.error("Erreur lors de la suppression du slide:", error.message);
                alert("Erreur lors de la suppression du slide");
            }
        }
    };

    // S'assure que l'index du slide courant reste valide après une suppression
    useEffect(() => {
        if (slideshow && currentSlideIndex >= slideshow.slides.length) {
            setCurrentSlideIndex(Math.max(0, slideshow.slides.length - 1));
        }
    }, [slideshow, currentSlideIndex]);

    if (loading) return <div>Loading...</div>;
    if (!slideshow) return <div>Slideshow not found</div>;

    // Vérifie si l'utilisateur a le droit de modifier (créateur ou admin)
    const isOwner = user && (user.username === slideshow.creator || user.is_staff || user.is_superuser);

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 relative text-white">
            <Button variant="ghost" className="mb-4 text-gray-400" onClick={() => setView('dashboard')}>
                &larr; Retour aux causeries
            </Button>

            {/* Modal d'édition du titre et de la description */}
            {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg w-full max-w-lg text-black overflow-y-auto max-h-[90vh] shadow-xl">
                        <h2 className="text-xl font-bold mb-4">Modifier la causerie</h2>
                        <form onSubmit={handleUpdateSlideshow} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Titre</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2 text-black mt-1"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2 text-black mt-1"
                                    rows={3}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date de présence obligatoire</label>
                                <input
                                    type="datetime-local"
                                    value={editScheduledDate}
                                    onChange={(e) => setEditScheduledDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2 text-black mt-1"
                                />
                            </div>

                            {/* Choix de la visibilité */}
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-gray-700">Visibilité de la causerie</label>
                                <div className="flex gap-4 mt-1">
                                    <label className="flex items-center gap-2 border border-gray-200 p-2.5 rounded-lg cursor-pointer flex-1 hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="editIsPublicRadio"
                                            checked={editIsPublic === true}
                                            onChange={() => setEditIsPublic(true)}
                                            className="text-blue-600 focus:ring-0"
                                        />
                                        <div>
                                            <span className="font-bold text-xs block text-gray-800">Publique</span>
                                            <span className="text-[10px] text-gray-500">Visible par tout le monde.</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2 border border-gray-200 p-2.5 rounded-lg cursor-pointer flex-1 hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="editIsPublicRadio"
                                            checked={editIsPublic === false}
                                            onChange={() => setEditIsPublic(false)}
                                            className="text-blue-600 focus:ring-0"
                                        />
                                        <div>
                                            <span className="font-bold text-xs block text-gray-800">Privée</span>
                                            <span className="text-[10px] text-gray-500">Uniquement pour les invités.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Liste d'invitation des utilisateurs */}
                            <div className="space-y-1">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Gérer les participants {editIsPublic ? "(Optionnel - présence obligatoire)" : "(Obligatoire pour voir la causerie)"}
                                </label>
                                <input
                                    type="text"
                                    placeholder="Rechercher un utilisateur..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2 text-sm mt-1 text-black"
                                />
                                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50 mt-1">
                                    {allUsers.filter(u => 
                                        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
                                        `${u.first_name} ${u.last_name}`.toLowerCase().includes(userSearch.toLowerCase())
                                    ).map((u) => {
                                        const name = `${u.first_name} ${u.last_name}`.trim() || u.username;
                                        const isChecked = editInvitedUsers.includes(u.id);
                                        return (
                                            <label key={u.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-gray-200 rounded-md cursor-pointer transition-colors">
                                                <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        if (isChecked) {
                                                            setEditInvitedUsers(editInvitedUsers.filter(id => id !== u.id));
                                                        } else {
                                                            setEditInvitedUsers([...editInvitedUsers, u.id]);
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-0"
                                                />
                                                <span className="text-sm font-medium text-black">{name} <span className="text-gray-500 font-normal">({u.username})</span></span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 mt-4">
                                <Button type="button" variant="outline" className="text-black border-gray-300 hover:bg-gray-100" onClick={() => setEditing(false)}>Annuler</Button>
                                <Button type="submit">Sauvegarder</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">{slideshow.title}</h1>
                    <p className="text-gray-400 mt-2">{slideshow.description}</p>
                    {slideshow.scheduled_date && (
                        <p className="text-sm text-yellow-400 mt-1 font-semibold">
                            Date de présence obligatoire : {new Date(slideshow.scheduled_date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">Créé par {slideshow.creator}</p>
                </div>
                {isOwner && (
                    <div className="flex gap-2">
                        <Button variant="outline" className="text-white" onClick={handleEditClick}>Modifier</Button>
                        <Button variant="destructive" onClick={handleDeleteSlideshow}>Supprimer</Button>
                    </div>
                )}
            </div>

            {/* Onglets pour les créateurs/admins */}
            {isOwner && (
                <div className="flex gap-4 border-b border-white/10 mb-6">
                    <button
                        onClick={() => setActiveTab('slides')}
                        className={`pb-2 px-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'slides' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        Diapositives
                    </button>
                    <button
                        onClick={() => setActiveTab('report')}
                        className={`pb-2 px-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'report' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        Suivi des participants
                    </button>
                </div>
            )}

            {(!isOwner || activeTab === 'slides') ? (
                <div className="space-y-8">
                    {slideshow.slides.length === 0 ? (
                    <p className="text-gray-500 italic">Aucune diapositive pour le moment.</p>
                ) : (
                    <div className="flex flex-col items-center">
                        {/* Visionneuse de Slides */}
                        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center">
                            {(() => {
                                const slide = slideshow.slides[currentSlideIndex];
                                if (!slide) return <p className="text-white">Diapositive non trouvée</p>;
                                if (!slide.file) return <p className="text-white">Aucun contenu de fichier</p>;

                                const isImage = slide.file.match(/\.(jpeg|jpg|gif|png)$/i);
                                const isPDF = slide.file.match(/\.pdf$/i);

                                // Affichage dynamique selon le type de fichier
                                if (isImage) {
                                    return <img src={slide.file} alt="Slide" className="w-full h-full object-contain" />;
                                } else if (isPDF) {
                                    return <iframe src={slide.file} className="w-full h-full border-0" title="PDF Slide" />;
                                } else {
                                    return (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-sm p-8 text-center">
                                            <div className="bg-white/10 p-6 rounded-2xl border border-white/10 max-w-md w-full">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-white mx-auto mb-4 opacity-80">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                                </svg>
                                                <h3 className="text-xl font-semibold text-white mb-2">Fichier de présentation ({slide.file.split('.').pop()?.toUpperCase()})</h3>
                                                <p className="text-gray-300 mb-6 text-sm">
                                                    Ce type de fichier ne peut pas être affiché directement.
                                                </p>
                                                <a
                                                    href={slide.file}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition w-full font-medium shadow-lg"
                                                >
                                                    Télécharger pour voir
                                                </a>
                                            </div>
                                        </div>
                                    );
                                }
                            })()}

                            {/* Boutons de navigation Flèche Gauche / Droite */}
                            <button
                                onClick={handlePrevSlide}
                                disabled={currentSlideIndex === 0}
                                className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110 shadow-lg shadow-black/20'}`}
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                onClick={handleNextSlide}
                                disabled={currentSlideIndex === slideshow.slides.length - 1}
                                className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all ${currentSlideIndex === slideshow.slides.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110 shadow-lg shadow-black/20'}`}
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>

                            {/* Option admin : Supprimer le slide affiché */}
                            {isOwner && slideshow.slides[currentSlideIndex] && (
                                <button
                                    onClick={() => handleDeleteSlide(slideshow.slides[currentSlideIndex].id)}
                                    className="absolute top-4 right-4 bg-red-600/90 text-white p-2 rounded-full hover:bg-red-700 transition-all hover:rotate-90 shadow-lg"
                                    title="Supprimer ce slide"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        <div className="mt-4 text-center">
                            <p className="text-lg font-medium">Diapositive {currentSlideIndex + 1} sur {slideshow.slides.length}</p>
                            <p className="text-gray-400 mt-2">{slideshow.slides[currentSlideIndex]?.content || 'Aucune description.'}</p>
                        </div>
                    </div>
                )}
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-white space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold">Suivi des participants</h2>
                        <Button size="sm" variant="outline" className="text-white border-white/10 hover:bg-white/5" onClick={fetchReport}>
                            Rafraîchir
                        </Button>
                    </div>
                    
                    {loadingReport ? (
                        <p className="text-sm text-gray-400 italic">Chargement du suivi...</p>
                    ) : !participantsReport || participantsReport.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Aucun participant invité pour cette causerie.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                                        <th className="py-3 px-4">Utilisateur</th>
                                        <th className="py-3 px-4">Adresse Email</th>
                                        <th className="py-3 px-4">Quiz Complété</th>
                                        <th className="py-3 px-4">Score</th>
                                        <th className="py-3 px-4">Statut</th>
                                        <th className="py-3 px-4">Date de validation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participantsReport.map((participant) => (
                                        <tr key={participant.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-sm">
                                            <td className="py-3 px-4 font-semibold">{participant.fullname} <span className="text-gray-400 font-normal">({participant.username})</span></td>
                                            <td className="py-3 px-4 text-gray-300">{participant.email || 'N/A'}</td>
                                            <td className="py-3 px-4">
                                                {participant.quiz_status.completed ? (
                                                    <span className="bg-green-800/30 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-xs font-semibold">Oui</span>
                                                ) : (
                                                    <span className="bg-red-800/30 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-xs font-semibold">Non</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {participant.quiz_status.completed ? (
                                                    <span>{participant.quiz_status.score} / {participant.quiz_status.total_questions}</span>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {participant.quiz_status.completed ? (
                                                    participant.quiz_status.is_passed ? (
                                                        <span className="text-green-400 font-bold">Réussi</span>
                                                    ) : (
                                                        <span className="text-red-400 font-bold">Échoué</span>
                                                    )
                                                ) : (
                                                    <span className="text-yellow-500 italic">En attente</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-gray-400">
                                                {participant.quiz_status.submitted_at || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Section Administrateur : Ajout de diapositives et accès à la gestion du quiz */}
            {isOwner && (
                <div className="mt-12 bg-white/5 p-6 rounded-lg border border-white/10 text-white">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Ajouter une Slide</h3>
                        <Button variant="outline" className="text-white" onClick={() => setView('quiz-manage', { id: slideshow.id })}>
                            Gérer le Quiz
                        </Button>
                    </div>
                    <form onSubmit={handleAddSlide} className="space-y-4">
                        <div className="flex flex-col gap-4">
                            <label className="block text-sm font-medium">Fichier (Image, PDF, etc.)</label>
                            <input
                                id="slide-file"
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => setNewSlideFile(e.target.files ? e.target.files[0] : null)}
                                required
                                className="hidden"
                            />
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('slide-file')?.click()}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20"
                                >
                                    <FileUp className="w-5 h-5" />
                                    Parcourir les fichiers
                                </button>
                                
                                {newSlideFile && (
                                    <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                                        <File className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm text-gray-300 truncate max-w-[200px]">{newSlideFile.name}</span>
                                        <button type="button" onClick={() => {
                                            setNewSlideFile(null);
                                            const fileInput = document.getElementById('slide-file') as HTMLInputElement;
                                            if (fileInput) fileInput.value = '';
                                        }} className="text-gray-500 hover:text-white">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Contenu / Description</label>
                            <textarea
                                value={newSlideContent}
                                onChange={(e) => setNewSlideContent(e.target.value)}
                                rows={3}
                                className="mt-1 block w-full rounded-md bg-white/10 border-white/20 p-2 text-white"
                            />
                        </div>
                        <Button type="submit" disabled={addingSlide}>
                            {addingSlide ? 'Ajout...' : 'Ajouter la Slide'}
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
}
