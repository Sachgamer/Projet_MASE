'use client';

import { useEffect, useState } from 'react';
import api, { createChoice, deleteQuestion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';

// Interface pour les choix d'une question
interface Choice {
    id: number;
    text: string;
    is_correct: boolean;
}

// Interface pour une question de quiz
interface Question {
    id: number;
    text: string;
    order: number;
    choices: Choice[];
}

// Interface pour un quiz complet
interface Quiz {
    id: number;
    title: string;
    questions: Question[];
}

// Vue pour l'administration permettant de créer et modifier le quiz d'une formation
export default function QuizManageView() {
    const { viewParams, setView } = useView();
    const id = viewParams.id; // ID de la formation associée
    const { user, loading: authLoading } = useAuth();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [passingScore, setPassingScore] = useState(10); // Score minimum pour réussir le quiz

    // États pour le formulaire d'ajout d'une nouvelle question
    const [questionText, setQuestionText] = useState('');
    const [option1, setOption1] = useState('');
    const [option2, setOption2] = useState('');
    const [option3, setOption3] = useState('');
    const [option4, setOption4] = useState('');
    const [correctOption, setCorrectOption] = useState<number>(0);

    // Redirige vers la connexion si l'utilisateur n'est pas authentifié
    useEffect(() => {
        if (!authLoading && !user) setView('login');
    }, [user, authLoading]);

    useEffect(() => {
        if (id) fetchQuiz();
    }, [id]);

    // Récupère les données du quiz associé à la formation
    const fetchQuiz = async () => {
        try {
            const response = await api.get(`/api/slideshows/${id}/`);
            if (response.data.quiz) {
                setQuiz(response.data.quiz);
                setPassingScore(response.data.quiz.passing_score || 10);
            } else {
                setQuiz(null);
            }
        } catch (error: any) {
            console.error("Erreur lors de la récupération du quiz:", error.message);
        } finally {
            setLoading(false);
        }
    };

    // Crée un nouveau quiz s'il n'en existe pas encore pour cette formation
    const createQuiz = async () => {
        try {
            await api.post('/api/quizzes/', { slideshow: id, title: 'Quiz', passing_score: passingScore });
            fetchQuiz();
        } catch (error: any) {
            console.error("Erreur lors de la création du quiz:", error.message);
        }
    };

    // Met à jour le score requis pour le quiz
    const updateQuizSettings = async () => {
        if (!quiz) return;
        try {
            await api.patch(`/api/quizzes/${quiz.id}/`, { passing_score: passingScore });
            alert("Paramètres mis à jour !");
        } catch (error: any) {
            console.error("Erreur lors de la mise à jour du quiz:", error.message);
        }
    };

    // Ajoute une nouvelle question avec ses 4 options au quiz
    const addQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quiz) return;

        try {
            // 1. Création de la question
            const response = await api.post('/api/questions/', {
                quiz: quiz.id,
                text: questionText,
                order: quiz.questions ? quiz.questions.length + 1 : 1
            });

            const newQuestion = response.data;
            const options = [option1, option2, option3, option4];

            // 2. Création des 4 choix possibles (en parallèle)
            await Promise.all(options.map((opt, index) => {
                if (!opt) return null;
                return createChoice({
                    question: newQuestion.id,
                    text: opt,
                    is_correct: correctOption === (index + 1)
                });
            }));

            // Réinitialisation du formulaire
            setQuestionText('');
            setOption1('');
            setOption2('');
            setOption3('');
            setOption4('');
            setCorrectOption(0);
            fetchQuiz();
        } catch (error: any) {
            console.error("Erreur lors de l'ajout de la question:", error.message);
        }
    };

    // Supprime une question du quiz
    const handleDeleteQuestion = async (questionId: number) => {
        if (!confirm("Supprimer cette question ?")) return;
        try {
            await deleteQuestion(questionId);
            fetchQuiz();
        } catch (error: any) {
            console.error("Erreur lors de la suppression:", error.message);
        }
    };

    if (loading) return <div className="p-8 text-white">Chargement...</div>;

    // Interface affichée si aucun quiz n'est encore créé
    if (!quiz) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-8 text-white text-black">
                <Button variant="ghost" className="mb-4 text-gray-400" onClick={() => setView('slideshow-detail', { id })}>
                    &larr; Retour
                </Button>
                <h1 className="text-2xl font-bold mb-4">Gérer le Quiz</h1>
                <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
                    <p className="mb-4 text-black">Pas de quizz existant pour cette présentation.</p>
                    <div className="flex items-center gap-4 mb-4">
                        <label className="text-sm font-bold text-black">Score requis :</label>
                        <input
                            type="number"
                            value={passingScore}
                            onChange={(e) => setPassingScore(parseInt(e.target.value) || 0)}
                            className="border rounded px-2 py-1 w-20 text-black"
                        />
                    </div>
                    <Button onClick={createQuiz}>Créer le Quiz</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 text-white">
            <Button variant="ghost" className="mb-4 text-gray-400" onClick={() => setView('slideshow-detail', { id })}>
                &larr; Retour à la causerie
            </Button>
            <h1 className="text-2xl font-bold mb-6">Gérer le Quiz : {quiz.title}</h1>

            {/* Réglages du score de passage */}
            <div className="bg-white/10 p-4 rounded-lg mb-6 flex items-center justify-between border border-white/10">
                <div className="flex items-center gap-4">
                    <label className="font-medium">Score requis :</label>
                    <input
                        type="number"
                        value={passingScore}
                        onChange={(e) => setPassingScore(parseInt(e.target.value) || 0)}
                        className="border rounded px-2 py-1 w-20 text-black"
                    />
                </div>
                <Button onClick={updateQuizSettings} variant="outline" className="text-white">Mettre à jour</Button>
            </div>

            {/* Liste des questions existantes */}
            <div className="mb-8 space-y-6">
                {quiz.questions && quiz.questions.map((q, idx) => (
                    <div key={q.id} className="border border-white/10 p-4 rounded bg-white shadow-sm relative text-black">
                        <div className="flex justify-between items-start">
                            <p className="font-bold text-lg">Q{idx + 1}: {q.text}</p>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteQuestion(q.id)}>Supprimer</Button>
                        </div>
                        <ul className="mt-3 ml-4 space-y-1 list-disc">
                            {q.choices && q.choices.map((c) => (
                                <li key={c.id} className={c.is_correct ? "text-green-600 font-semibold" : ""}>
                                    {c.text} {c.is_correct && "(Correct)"}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {/* Formulaire de création de question */}
            <div className="bg-white p-6 rounded-lg border text-black">
                <h3 className="text-lg font-bold mb-4">Ajouter une question</h3>
                <form onSubmit={addQuestion} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold">Question</label>
                        <input
                            type="text"
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 p-2 border"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((num) => (
                            <div key={num} className="flex flex-col">
                                <label className="text-sm font-bold">Option {num}</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={num === 1 ? option1 : num === 2 ? option2 : num === 3 ? option3 : option4}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (num === 1) setOption1(val);
                                            else if (num === 2) setOption2(val);
                                            else if (num === 3) setOption3(val);
                                            else setOption4(val);
                                        }}
                                        required
                                        className="flex-grow rounded-md border-gray-300 p-2 border"
                                    />
                                    <input
                                        type="radio"
                                        name="correctOption"
                                        checked={correctOption === num}
                                        onChange={() => setCorrectOption(num)}
                                        required
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button type="submit">Ajouter</Button>
                </form>
            </div>
        </div>
    );
}
