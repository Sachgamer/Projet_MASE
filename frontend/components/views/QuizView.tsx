import { useEffect, useState, useRef } from 'react';
import api, { downloadQuizPdf } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useView } from '@/context/ViewContext';

import { useAuth } from '@/context/AuthContext';

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
    const { user } = useAuth();
    const id = viewParams.id; // ID de la formation associée
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // Index de la question en cours
    const [score, setScore] = useState(0); // Nombre de bonnes réponses
    const [showResults, setShowResults] = useState(false); // État affichant le score final
    const [answers, setAnswers] = useState<{ question_id: number; choice_id: number }[]>([]);
    const [downloading, setDownloading] = useState(false);
    
    // Canvas signature state
    const [signatureData, setSignatureData] = useState<string>('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

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

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        setIsDrawing(true);
        const rect = canvas.getBoundingClientRect();
        
        // Handle mobile touch or desktop click
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        // Dark stroke on white canvas
        ctx.strokeStyle = '#1e293b'; 
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        saveSignature();
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData('');
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setSignatureData(canvas.toDataURL('image/png'));
    };

    // Gère la réponse de l'utilisateur et passe à la question suivante
    const handleAnswer = (choice: Choice) => {
        if (quiz) {
            const question = quiz.questions[currentQuestionIndex];
            setAnswers(prev => [...prev, { question_id: question.id, choice_id: choice.id }]);
        }

        if (choice.is_correct) setScore(score + 1);

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

    const handleDownloadPDF = async () => {
        if (!quiz) return;
        setDownloading(true);
        try {
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const username = user?.username || 'unknown';
            const quizTitle = quiz.title.replace(/\s+/g, '-').replace(/[^\w\-_\.]/g, '');
            const filename = `${username}_${dateStr}_${quizTitle}.pdf`;
            await downloadQuizPdf(quiz.id, answers, filename, signatureData);
        } catch (error: any) {
            console.error("Erreur de téléchargement du PDF:", error.message);
            alert("Erreur lors du téléchargement du PDF récapitulatif.");
        } finally {
            setDownloading(false);
        }
    };

    // Affichage des résultats après la fin du quiz
    if (showResults) {
        const isPassed = score >= (quiz.passing_score || 0); // Vérifie si le score est suffisant
        return (
            <div className="max-w-2xl mx-auto px-4 py-8 text-center text-white space-y-6">
                <h2 className="text-3xl font-bold">Résultats du quizz</h2>
                <div className={`p-8 rounded-lg shadow-lg ${isPassed ? 'bg-green-800/40 border-2 border-green-500' : 'bg-red-800/40 border-2 border-red-500'}`}>
                    <p className="text-6xl mb-4">{isPassed ? '🎉' : '❌'}</p>
                    <h3 className="text-2xl font-bold mb-2">{isPassed ? 'Réussi !' : 'Échec'}</h3>
                    <p className="text-xl">{score} / {quiz.questions.length}</p>
                </div>

                {isPassed && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left space-y-3">
                        <h4 className="font-bold text-sm text-gray-300">Veuillez dessiner votre signature ci-dessous pour signer la feuille d'émargement :</h4>
                        <div className="bg-white border border-white/20 rounded-lg overflow-hidden h-36 relative">
                            <canvas 
                                ref={canvasRef}
                                width={500}
                                height={144}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full h-full cursor-crosshair touch-none"
                            />
                            <button 
                                type="button"
                                onClick={clearCanvas}
                                className="absolute bottom-2 right-2 text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded px-2.5 py-1.5 transition-colors border-0"
                            >
                                Effacer
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                    <Button onClick={() => { setShowResults(false); setCurrentQuestionIndex(0); setScore(0); setAnswers([]); setSignatureData(''); }}>Recommencer</Button>
                    <Button 
                        onClick={handleDownloadPDF} 
                        disabled={downloading || (isPassed && !signatureData)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                        {downloading ? 'Téléchargement...' : 'Télécharger la fiche de validation'}
                    </Button>
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
                            onClick={() => handleAnswer(choice)}
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
