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
            if (error.response?.status === 413) {
                alert('Fichier trop volumineux. Veuillez réduire la taille du fichier (max. 100 Mo).');
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

    // Ouvre le mode édition du titre/description
    const handleEditClick = () => {
        if (slideshow) {
            setEditTitle(slideshow.title);
            setEditDescription(slideshow.description);
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
                    description: editDescription
                });
                const updated = await api.get(`/api/slideshows/${id}/`);
                setSlideshow(updated.data);
                setEditing(false);
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md text-black">
                        <h2 className="text-xl font-bold mb-4">Modifier la causerie</h2>
                        <form onSubmit={handleUpdateSlideshow} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Titre</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full border rounded p-2"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Description</label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full border rounded p-2"
                                    rows={3}
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" className="text-white" onClick={() => setEditing(false)}>Annuler</Button>
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
                    <p className="text-sm text-gray-500 mt-1">Créé par {slideshow.creator}</p>
                </div>
                {isOwner && (
                    <div className="flex gap-2">
                        <Button variant="outline" className="text-white" onClick={handleEditClick}>Modifier</Button>
                        <Button variant="destructive" onClick={handleDeleteSlideshow}>Supprimer</Button>
                    </div>
                )}
            </div>

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
