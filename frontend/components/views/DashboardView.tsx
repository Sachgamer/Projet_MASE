'use client';

import { useEffect, useState } from 'react';
import api, { deleteSlideshow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import { 
    Calendar, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Award, 
    BookOpen, 
    Archive, 
    Trash2,
    Eye,
    GraduationCap
} from 'lucide-react';

interface QuizSubmission {
    id: number;
    score: number;
    total_questions: number;
    is_passed: boolean;
    submitted_at: string;
}

interface Quiz {
    id: number;
    title: string;
    passing_score: number;
    user_submissions: QuizSubmission[];
    average_score: number | null;
}

interface Slideshow {
    id: number;
    title: string;
    description: string;
    creator: string;
    created_at: string;
    quiz: Quiz | null;
    scheduled_date: string | null;
    is_finished: boolean;
    is_archived: boolean;
}

export default function DashboardView() {
    const { user } = useAuth();
    const { setView } = useView();
    const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
    
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const isAdmin = user && (user.is_staff || user.is_superuser || user.role === 'admin');

    useEffect(() => {
        fetchSlideshows();
    }, [activeTab]);

    const fetchSlideshows = async () => {
        setLoading(true);
        try {
            const url = activeTab === 'archived' ? '/api/slideshows/?archived=true' : '/api/slideshows/';
            const response = await api.get(url);
            setSlideshows(response.data);
        } catch (error: any) {
            console.error("Erreur lors de la récupération des causeries:", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette causerie ? Cela effacera également son quiz.")) {
            try {
                await deleteSlideshow(id);
                setSlideshows(prev => prev.filter(s => s.id !== id));
            } catch (error: any) {
                console.error("Erreur lors de la suppression:", error.message);
                alert("Erreur lors de la suppression");
            }
        }
    };

    const toggleSelection = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedIds.length} causeries ? Cela effacera également leurs quiz.`)) {
            try {
                await Promise.all(selectedIds.map(id => deleteSlideshow(id)));
                setSlideshows(prev => prev.filter(s => !selectedIds.includes(s.id)));
                setSelectedIds([]);
                setSelectionMode(false);
            } catch (error: any) {
                console.error("Erreur lors de la suppression groupée:", error.message);
                alert("Erreur lors de la suppression");
                fetchSlideshows();
            }
        }
    };

    // Helper to categorize slideshows
    const isCompleted = (slideshow: Slideshow) => {
        return !!slideshow.quiz?.user_submissions && slideshow.quiz.user_submissions.length > 0;
    };

    const isFinished = (slideshow: Slideshow) => {
        if (slideshow.is_finished) return true;
        if (slideshow.scheduled_date && new Date(slideshow.scheduled_date) < new Date()) return true;
        return false;
    };

    // Categorized lists
    const todoList = slideshows.filter(s => !isCompleted(s) && !isFinished(s));
    const completedList = slideshows.filter(s => isCompleted(s) && !isFinished(s));
    const finishedList = slideshows.filter(s => isFinished(s));

    const renderSlideshowCard = (slideshow: Slideshow) => {
        const isOwner = user && (user.username === slideshow.creator || user.is_staff || user.is_superuser || user.role === 'admin');
        const done = isCompleted(slideshow);
        const finished = isFinished(slideshow);
        
        let statusBadge = null;
        if (done) {
            const passed = slideshow.quiz?.user_submissions.some(s => s.is_passed);
            statusBadge = passed 
                ? <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Réussi</span>
                : <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> À refaire</span>;
        } else if (finished) {
            statusBadge = <span className="text-[10px] font-bold text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded flex items-center gap-1"><Archive className="w-3.5 h-3.5" /> Clôturée</span>;
        } else {
            statusBadge = <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> À réaliser</span>;
        }

        return (
            <div key={slideshow.id} className="bg-white dark:bg-gray-900 overflow-hidden shadow-lg rounded-2xl border border-gray-200 dark:border-white/10 hover:scale-[1.01] transition-all duration-200 relative flex flex-col justify-between">
                {selectionMode && isOwner && (
                    <div className="absolute top-3 right-3 z-10">
                        <input
                            type="checkbox"
                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            checked={selectedIds.includes(slideshow.id)}
                            onChange={() => toggleSelection(slideshow.id)}
                        />
                    </div>
                )}

                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                        <h3 className="text-md font-bold text-gray-900 dark:text-white line-clamp-1">
                            {slideshow.title}
                        </h3>
                        <div className="shrink-0">{statusBadge}</div>
                    </div>
                    
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
                        {slideshow.description}
                    </p>

                    <div className={`pt-2 flex flex-wrap gap-2 ${selectionMode ? 'opacity-30 pointer-events-none' : ''}`}>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 min-w-[70px] text-[11px] h-8 bg-transparent border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
                            onClick={() => setView('slideshow-detail', { id: slideshow.id })}
                        >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Voir
                        </Button>
                        {slideshow.quiz && (
                            <Button
                                size="sm"
                                className="flex-1 min-w-[70px] text-[11px] h-8 cursor-pointer"
                                onClick={() => setView('quiz', { id: slideshow.id })}
                            >
                                <GraduationCap className="w-3.5 h-3.5 mr-1" />
                                Quiz
                             </Button>
                        )}
                        {isOwner && (
                            <button
                                onClick={() => handleDelete(slideshow.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg bg-transparent border-0 cursor-pointer shrink-0"
                                title="Supprimer"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-white/2 px-6 py-3 border-t border-gray-100 dark:border-white/5 flex justify-between items-center text-[10px] text-gray-400 font-semibold">
                    <span>Créé par : {slideshow.creator}</span>
                    <span>le {new Date(slideshow.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-white">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">Causeries & Sensibilisation</h1>
                    <p className="text-gray-400 text-xs mt-1">Formations collectives et validation des acquis sécurité.</p>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {/* View filter tabs */}
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => { setActiveTab('active'); }}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border-0 cursor-pointer ${activeTab === 'active' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white bg-transparent'}`}
                        >
                            Causeries Actives
                        </button>
                        <button
                            onClick={() => { setActiveTab('archived'); }}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border-0 cursor-pointer ${activeTab === 'archived' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white bg-transparent'}`}
                        >
                            Archives
                        </button>
                    </div>

                    {activeTab === 'active' && (
                        <>
                            {isAdmin && (
                                selectionMode ? (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="text-white border-white/20 hover:bg-white/5"
                                            onClick={() => {
                                                setSelectionMode(false);
                                                setSelectedIds([]);
                                            }}
                                        >
                                            Annuler
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            disabled={selectedIds.length === 0}
                                            onClick={handleBulkDelete}
                                        >
                                            Supprimer ({selectedIds.length})
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" className="text-white border-white/20 hover:bg-white/5" onClick={() => setSelectionMode(true)}>
                                        Sélectionner
                                    </Button>
                                )
                            )}
                            <Button className="bg-primary hover:bg-primary-hover text-white cursor-pointer" onClick={() => setView('slideshow-create')}>
                                Nouvelle Causerie
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                </div>
            ) : activeTab === 'archived' ? (
                /* Archive Tab View */
                <div className="space-y-6">
                    {slideshows.length === 0 ? (
                        <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl text-gray-500 italic text-sm">
                            Aucune causerie archivée pour le moment.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {slideshows.map(slideshow => renderSlideshowCard(slideshow))}
                        </div>
                    )}
                </div>
            ) : (
                /* Active Tab View with 3 categorized groups */
                <div className="space-y-10">
                    
                    {/* Section 1 : À faire (To do) */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2 border-b border-white/5 pb-2 text-blue-400">
                            <Clock className="w-5 h-5" />
                            À réaliser ({todoList.length})
                        </h2>
                        {todoList.length === 0 ? (
                            <div className="text-center py-8 bg-white/2 border border-white/10 rounded-2xl text-gray-500 italic text-xs">
                                Aucune causerie en attente de réalisation !
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {todoList.map(slideshow => renderSlideshowCard(slideshow))}
                            </div>
                        )}
                    </div>

                    {/* Section 2 : Faites (Done) */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2 border-b border-white/5 pb-2 text-green-400">
                            <CheckCircle2 className="w-5 h-5" />
                            Faites ({completedList.length})
                        </h2>
                        {completedList.length === 0 ? (
                            <div className="text-center py-8 bg-white/2 border border-white/10 rounded-2xl text-gray-500 italic text-xs">
                                Vous n'avez pas encore validé de causerie.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {completedList.map(slideshow => renderSlideshowCard(slideshow))}
                            </div>
                        )}
                    </div>

                    {/* Section 3 : Terminées (Finished) */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2 border-b border-white/5 pb-2 text-gray-400">
                            <Archive className="w-5 h-5" />
                            Clôturées ({finishedList.length})
                        </h2>
                        {finishedList.length === 0 ? (
                            <div className="text-center py-8 bg-white/2 border border-white/10 rounded-2xl text-gray-500 italic text-xs">
                                Aucune causerie clôturée.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {finishedList.map(slideshow => renderSlideshowCard(slideshow))}
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}
