'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
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

// Interface pour les données du quiz
interface Quiz {
    id: number;
    title: string;
    passing_score: number;
    questions: Question[];
}

// Vue permettant à l'utilisateur de passer le quiz d'une formation
export default function QuizView() {
    const { viewParams, setView } = useView();
    const id = viewParams.id; // ID de la formation associée
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // Index de la question en cours
    const [score, setScore] = useState(0); // Nombre de bonnes réponses
    const [showResults, setShowResults] = useState(false); // État affichant le score final

    useEffect(() => {
        // Récupère le quiz via l'API de la formation
        const fetchQuiz = async () => {
            try {
                const response = await api.get(`/api/slideshows/${id}/`);
                if (response.data.quiz) {
                    setQuiz(response.data.quiz);
                }
            } catch (error: any) {
                console.error("Failed to fetch quiz:", error.message);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchQuiz();
    }, [id]);

    // Gère la réponse de l'utilisateur et passe à la question suivante
    const handleAnswer = (isCorrect: boolean) => {
        if (isCorrect) setScore(score + 1);

        if (currentQuestionIndex + 1 < (quiz?.questions.length || 0)) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            // Si c'était la dernière question, on affiche les résultats
            setShowResults(true);
        }
    };

    if (loading) return <div className="p-8 text-white">Chargement...</div>;
    if (!quiz) return <div className="p-8 text-white">Aucun quizz n'est disponible pour cette présentation.</div>;
    if (!quiz.questions || quiz.questions.length === 0) return <div className="p-8 text-white">Aucune question n'est disponible.</div>;

    // Affichage des résultats après la fin du quiz
    if (showResults) {
        const isPassed = score >= (quiz.passing_score || 0); // Vérifie si le score est suffisant
        return (
            <div className="max-w-2xl mx-auto px-4 py-8 text-center text-white">
                <h2 className="text-3xl font-bold mb-6">Résultats du quizz</h2>
                <div className={`p-8 rounded-lg shadow-lg mb-8 ${isPassed ? 'bg-green-800 border-2 border-green-500' : 'bg-red-800 border-2 border-red-500'}`}>
                    <p className="text-6xl mb-4">{isPassed ? '🎉' : '❌'}</p>
                    <h3 className="text-2xl font-bold mb-2">{isPassed ? 'Réussi !' : 'Échec'}</h3>
                    <p className="text-xl mb-4">{score} / {quiz.questions.length}</p>
                </div>
                <div className="flex justify-center gap-4">
                    <Button onClick={() => { setShowResults(false); setCurrentQuestionIndex(0); setScore(0); }}>Recommencer</Button>
                    <Button variant="outline" className="text-white" onClick={() => setView('dashboard')}>Tableau de bord</Button>
                </div>
            </div>
        );
    }

    const currentQuestion = quiz.questions[currentQuestionIndex];

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 text-white">
            <h1 className="text-2xl font-bold mb-2">{quiz.title}</h1>
            <div className="bg-white shadow rounded-lg p-6 mt-6 text-black">
                {/* En-tête de la question actuelle */}
                <div className="mb-4">
                    <span className="text-sm text-gray-500">Question {currentQuestionIndex + 1} sur {quiz.questions.length}</span>
                    <h3 className="text-xl font-medium mt-2">{currentQuestion.text}</h3>
                </div>
                {/* Liste des choix possibles */}
                <div className="space-y-3">
                    {currentQuestion.choices.map((choice) => (
                        <button
                            key={choice.id}
                            onClick={() => handleAnswer(choice.is_correct)}
                            className="w-full text-left px-4 py-3 border rounded-md hover:bg-gray-100 transition-colors text-black"
                        >
                            {choice.text}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
