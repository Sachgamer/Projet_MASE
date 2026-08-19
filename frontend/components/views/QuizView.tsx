'use client';

import { useEffect, useState, useRef } from 'react';
import api, { downloadQuizPdf } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useView } from '@/context/ViewContext';
import { useAuth } from '@/context/AuthContext';
import { 
    CheckCircle2, 
    XCircle, 
    Award, 
    Calendar, 
    BookOpen, 
    Download, 
    ArrowRight,
    ChevronRight,
    HelpCircle,
    RotateCcw
} from 'lucide-react';

interface Choice {
    id: number;
    text: string;
    is_correct: boolean;
}

interface Question {
    id: number;
    text: string;
    order: number;
    choices: Choice[];
}

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
    questions: Question[];
    user_submissions: QuizSubmission[];
    average_score: number | null;
}

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export default function QuizView() {
    const { viewParams, setView } = useView();
    const { user } = useAuth();
    const id = viewParams.id; // ID de la formation associée
    
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasStarted, setHasStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [answers, setAnswers] = useState<{ question_id: number; choice_id: number }[]>([]);
    const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [attempts, setAttempts] = useState<QuizSubmission[]>([]);

    // Canvas signature state
    const [signatureData, setSignatureData] = useState<string>('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        fetchQuiz();
    }, [id]);

    const fetchQuiz = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/api/slideshows/${id}/`);
            if (response.data.quiz) {
                const quizData = response.data.quiz;
                if (quizData.questions) {
                    quizData.questions = shuffleArray(quizData.questions);
                }
                setQuiz(quizData);
                setAttempts(quizData.user_submissions || []);
            }
        } catch (error: any) {
            console.error("Failed to fetch quiz:", error.message);
        } finally {
            setLoading(false);
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
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

    const handleAnswerClick = (choice: Choice) => {
        if (selectedChoice) return;
        setSelectedChoice(choice);
        
        if (choice.is_correct) {
            setScore(prev => prev + 1);
        }
        
        if (quiz) {
            const question = quiz.questions[currentQuestionIndex];
            setAnswers(prev => [...prev, { question_id: question.id, choice_id: choice.id }]);
        }
    };

    const handleNextQuestion = () => {
        setSelectedChoice(null);
        if (currentQuestionIndex + 1 < (quiz?.questions.length || 0)) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            setShowResults(true);
        }
    };

    const handleStartQuiz = () => {
        if (attempts.length >= 2) return;
        setHasStarted(true);
        setCurrentQuestionIndex(0);
        setScore(0);
        setAnswers([]);
        setSelectedChoice(null);
    };

    const handleDownloadPDF = async () => {
        if (!quiz) return;
        setDownloading(true);
        try {
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const username = user?.username || 'unknown';
            const quizTitle = quiz.title.replace(/\s+/g, '-').replace(/[^\w\-_\.]/g, '');
            const filename = `${username}_${dateStr}_${quizTitle}.pdf`;
            await downloadQuizPdf(quiz.id, answers, filename, signatureData);
            // Refresh attempts history after pdf creation
            fetchQuiz();
        } catch (error: any) {
            console.error("Erreur de téléchargement du PDF:", error.message);
            alert("Erreur lors du téléchargement du PDF récapitulatif.");
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-xl mx-auto px-4 py-24 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="max-w-xl mx-auto px-4 py-16 text-center text-white">
                <p className="text-gray-400">Aucun quiz n'est disponible pour cette causerie.</p>
            </div>
        );
    }

    // Intro Screen (Quiz not started yet)
    if (!hasStarted && !showResults) {
        const canStart = attempts.length < 2;
        return (
            <div className="max-w-2xl mx-auto px-4 py-8 text-white space-y-8 animate-in fade-in duration-300">
                {/* Header Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                    <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-primary" />
                        Quiz : {quiz.title}
                    </h1>
                    <p className="text-xs text-gray-400">
                        Répondez aux questions pour valider votre compréhension de la causerie. Score minimum requis pour validation : <span className="text-primary font-bold">{quiz.passing_score} / {quiz.questions.length}</span>.
                    </p>
                    
                    {quiz.average_score !== null && (
                        <div className="inline-block bg-white/5 border border-white/10 text-xs text-gray-300 px-3 py-1.5 rounded-lg font-semibold">
                            📈 Moyenne des participants : <span className="text-white font-bold">{quiz.average_score} / {quiz.questions.length}</span>
                        </div>
                    )}
                </div>

                {/* Previous attempts history */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-primary" />
                        Historique des Tentatives ({attempts.length} / 2)
                    </h3>
                    
                    <div className="space-y-3">
                        {attempts.map((sub, idx) => (
                            <div key={sub.id} className="flex justify-between items-center p-4 bg-white/5 border border-white/10 rounded-xl text-xs">
                                <div>
                                    <h4 className="font-bold text-white">Tentative #{idx + 1}</h4>
                                    <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Le {new Date(sub.submitted_at).toLocaleDateString('fr-FR')} à {new Date(sub.submitted_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-extrabold text-sm text-white">{sub.score} / {sub.total_questions}</span>
                                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${sub.is_passed ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        {sub.is_passed ? 'Réussi' : 'Échoué'}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {attempts.length === 0 && (
                            <p className="text-xs text-gray-500 italic text-center py-4">Aucune tentative réalisée</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                    <Button 
                        onClick={handleStartQuiz} 
                        disabled={!canStart}
                        className="w-full sm:w-auto px-8 py-3.5 font-bold text-sm bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {attempts.length === 0 ? 'Démarrer le quiz' : 'Faire la seconde tentative'}
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => setView('dashboard')} 
                        className="w-full sm:w-auto border-white/20 text-white hover:bg-white/5 py-3.5 rounded-xl text-sm"
                    >
                        Tableau de bord
                    </Button>
                </div>
            </div>
        );
    }

    // Results Screen
    if (showResults) {
        const isPassed = score >= (quiz.passing_score || 0);
        return (
            <div className="max-w-2xl mx-auto px-4 py-8 text-center text-white space-y-6 animate-in fade-in duration-300">
                <h2 className="text-3xl font-extrabold text-white">Résultats du quiz</h2>
                
                <div className={`p-8 rounded-2xl shadow-xl backdrop-blur-md border ${isPassed ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <p className="text-6xl mb-4">{isPassed ? '🎉' : '❌'}</p>
                    <h3 className="text-2xl font-bold mb-2">{isPassed ? 'Quiz Validé !' : 'Quiz Échoué'}</h3>
                    <p className="text-xl font-extrabold text-white">{score} / {quiz.questions.length} bonnes réponses</p>
                </div>

                {isPassed && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left space-y-4 backdrop-blur-md">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Dessinez votre signature ci-dessous pour valider la feuille d'émargement :</h4>
                        <div className="bg-white border border-white/20 rounded-xl overflow-hidden h-36 relative">
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
                                className="absolute bottom-2 right-2 text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded px-2.5 py-1.5 transition-colors border-0 cursor-pointer"
                            >
                                Effacer
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
                    {attempts.length < 1 && !isPassed && (
                        <Button 
                            onClick={handleStartQuiz} 
                            className="w-full sm:w-auto px-6"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Réessayer (Dernier essai)
                        </Button>
                    )}
                    <Button
                        onClick={handleDownloadPDF}
                        disabled={downloading || (isPassed && !signatureData)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold w-full sm:w-auto px-6"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {downloading ? 'Téléchargement...' : 'Télécharger la fiche de validation'}
                    </Button>
                    <Button 
                        variant="outline" 
                        className="text-white border-white/20 w-full sm:w-auto px-6" 
                        onClick={() => setView('dashboard')}
                    >
                        Tableau de bord
                    </Button>
                </div>
            </div>
        );
    }

    const currentQuestion = quiz.questions[currentQuestionIndex];

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 text-white space-y-6 animate-in fade-in duration-300">
            {/* Header progress info */}
            <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Question {currentQuestionIndex + 1} sur {quiz.questions.length}
                </span>
                <span className="text-xs font-bold text-primary">
                    Score : {score}
                </span>
            </div>

            {/* Question card */}
            <div className="bg-white/5 border border-white/10 shadow-2xl rounded-2xl p-6 backdrop-blur-md space-y-6">
                <h3 className="text-xl font-bold text-white">{currentQuestion.text}</h3>
                
                {/* Answers Choice List */}
                <div className="space-y-3">
                    {currentQuestion.choices.map((choice) => {
                        let buttonStyle = 'bg-white/5 border-white/10 text-white hover:bg-white/10';
                        
                        if (selectedChoice) {
                            if (choice.is_correct) {
                                // Right answer in green
                                buttonStyle = 'bg-green-500/20 border-green-500 text-green-400 font-bold';
                            } else if (selectedChoice.id === choice.id) {
                                // Incorrect choice in red
                                buttonStyle = 'bg-red-500/20 border-red-500 text-red-400 font-bold';
                            } else {
                                // Other disabled options
                                buttonStyle = 'bg-white/5 border-white/5 text-gray-500 opacity-60';
                            }
                        }

                        return (
                            <button
                                key={choice.id}
                                disabled={selectedChoice !== null}
                                onClick={() => handleAnswerClick(choice)}
                                className={`w-full text-left px-5 py-4 border rounded-xl transition-all text-sm flex justify-between items-center cursor-pointer ${buttonStyle}`}
                            >
                                <span>{choice.text}</span>
                                {selectedChoice && choice.is_correct && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                                {selectedChoice && selectedChoice.id === choice.id && !choice.is_correct && <XCircle className="w-5 h-5 text-red-400" />}
                            </button>
                        );
                    })}
                </div>

                {/* Show correction feedback panel */}
                {selectedChoice && (
                    <div className="mt-6 p-4 rounded-xl border animate-in slide-in-from-bottom-2 duration-200 bg-white/5 border-white/10 space-y-3">
                        <div className="flex items-center gap-2">
                            {selectedChoice.is_correct ? (
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-400" />
                            )}
                            <span className="font-bold text-sm">
                                {selectedChoice.is_correct ? 'Bonne réponse !' : 'Mauvaise réponse !'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">
                            {selectedChoice.is_correct 
                                ? 'Excellent ! Vous avez trouvé la bonne réponse.' 
                                : `La bonne réponse était : "${currentQuestion.choices.find(c => c.is_correct)?.text}".`
                            }
                        </p>
                        
                        <Button 
                            onClick={handleNextQuestion}
                            className="w-full mt-2 font-bold text-xs"
                        >
                            {currentQuestionIndex + 1 < quiz.questions.length ? 'Question suivante' : 'Terminer et voir les résultats'}
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
