'use client';

import { useEffect, useState } from 'react';
import api, { deleteSlideshow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';

// Interface pour les données d'une formation (causerie)
interface Slideshow {
    id: number;
    title: string;
    description: string;
    creator: string;
    created_at: string;
}

// Vue principale affichant la liste des formations disponibles
export default function DashboardView() {
    const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
    const { user } = useAuth();
    const { setView } = useView();
    const [loading, setLoading] = useState(true);
    const [selectionMode, setSelectionMode] = useState(false); // Mode pour supprimer plusieurs éléments à la fois
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    useEffect(() => {
        fetchSlideshows();
    }, []);

    // Récupère la liste des formations depuis le serveur
    const fetchSlideshows = async () => {
        try {
            const response = await api.get('/api/slideshows/');
            setSlideshows(response.data);
        } catch (error: any) {
            console.error("Erreur lors de la récupération des présentations:", error.message);
        } finally {
            setLoading(false);
        }
    };

    // Supprime une formation spécifique
    const handleDelete = async (id: number) => {
        if (window.confirm("Êtes vous sûre de vouloir supprimer cette présentations ? Cela effacera également son quizz.")) {
            try {
                await deleteSlideshow(id);
                setSlideshows(prev => prev.filter(s => s.id !== id));
            } catch (error: any) {
                console.error("Erreur lors de la suppression:", error.message);
                alert("Erreur lors de la suppression");
            }
        }
    };

    // Alterne la sélection d'un élément pour la suppression groupée
    const toggleSelection = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // Supprime tous les éléments sélectionnés
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        if (window.confirm(`Êtes vous sûre de vouloir supprimer ${selectedIds.length} ? Cela effacera également leurs quizz.`)) {
            try {
                // Envoie toutes les requêtes de suppression en parallèle
                await Promise.all(selectedIds.map(id => deleteSlideshow(id)));
                setSlideshows(prev => prev.filter(s => !selectedIds.includes(s.id)));
                setSelectedIds([]);
                setSelectionMode(false);
            } catch (error: any) {
                console.error("Erreur lors de la suppression:", error.message);
                alert("Erreur lors de la suppression");
                fetchSlideshows();
            }
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-3xl font-bold text-white">Causeries</h1>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {user && (
                        <>
                            {selectionMode ? (
                                <>
                                    <Button
                                        variant="outline"
                                        className="flex-1 sm:flex-none text-white"
                                        onClick={() => {
                                            setSelectionMode(false);
                                            setSelectedIds([]);
                                        }}
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1 sm:flex-none"
                                        disabled={selectedIds.length === 0}
                                        onClick={handleBulkDelete}
                                    >
                                        Supprimer ({selectedIds.length})
                                    </Button>
                                </>
                            ) : (
                                <Button variant="outline" className="flex-1 sm:flex-none text-white" onClick={() => setSelectionMode(true)}>
                                    Sélectionner
                                </Button>
                            )}
                        </>
                    )}
                    <Button className="flex-1 sm:flex-none w-full" onClick={() => setView('slideshow-create')}>
                        Nouvelle Causerie
                    </Button>
                </div>
            </div>

            {loading ? (
                <p>Chargement...</p>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {slideshows.map((slideshow) => {
                        // Vérifie si l'utilisateur a le droit de modifier/supprimer (créateur ou admin)
                        const isOwner = user && (user.username === slideshow.creator || user.is_staff || user.is_superuser);
                        return (
                            <div key={slideshow.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow relative text-black">
                                {selectionMode && isOwner && (
                                    <div className="absolute top-2 right-2 z-10">
                                        <input
                                            type="checkbox"
                                            className="h-6 w-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={selectedIds.includes(slideshow.id)}
                                            onChange={() => toggleSelection(slideshow.id)}
                                        />
                                    </div>
                                )}

                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 truncate">
                                        {slideshow.title}
                                    </h3>
                                    <p className="mt-1 max-w-2xl text-sm text-gray-500 line-clamp-2">
                                        {slideshow.description}
                                    </p>
                                    <div className={`mt-4 flex flex-wrap gap-2 ${selectionMode ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className='flex-1 min-w-[80px] text-xs text-white'
                                            onClick={() => setView('slideshow-detail', { id: slideshow.id })}
                                        >
                                            Voir
                                        </Button>
                                        <Button
                                            size="sm"
                                            className='flex-1 min-w-[80px] text-xs'
                                            onClick={() => setView('quiz', { id: slideshow.id })}
                                        >
                                            Quiz
                                        </Button>
                                        {isOwner && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className='flex-1 min-w-[80px] text-xs'
                                                onClick={() => handleDelete(slideshow.id)}
                                            >
                                                Supprimer
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                                    <div className="text-sm">
                                        <span className="text-gray-500">Crée par : {slideshow.creator}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {slideshows.length === 0 && (
                        <div className="col-span-full text-center py-12">
                            <p className="text-gray-400">Aucune causerie trouvée. Créez-en une en cliquant sur le bouton ci-dessus!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
