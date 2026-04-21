'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';

// Vue gérant la connexion des utilisateurs et la double authentification
export default function LoginView() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [twoFactorCode, setTwoFactorCode] = useState('');
    // Étape actuelle : 'login' (Identifiants) ou '2fa' (Code reçu par email)
    const [step, setStep] = useState<'login' | '2fa'>('login');
    const { login } = useAuth();
    const { setView } = useView();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Première étape : Envoi de l'identifiant et du mot de passe
    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        if (!username || !password) {
            setError('Entrez un identifiant et un mot de passe.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await api.post('/auth/login/', { username, password });
            if (response.status === 202) {
                // Si les identifiants sont bons, on passe à l'étape du code 2FA
                setStep('2fa');
                setSuccessMessage('Un email contenant votre code de sécurité a été envoyé.');
            } else {
                // Cas direct sans 2FA (si configuré ainsi sur le serveur)
                if (response.data.key) {
                   await login(response.data.key);
                   setView('dashboard');
                }
            }
        } catch (err: any) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Deuxième étape : Vérification du code reçu par email
    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        if (!twoFactorCode) {
            setError('Entrez le code reçu par email.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await api.post('/auth/verify-2fa/', { username, code: twoFactorCode });
            if (response.data.key) {
                // Si le code est bon, on connecte l'utilisateur
                await login(response.data.key);
                setView('dashboard');
            }
        } catch (err: any) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Gère l'affichage des messages d'erreur selon le type de problème
    const handleError = (err: any) => {
        if (err.message === 'Network Error') {
            setError('Erreur réseau. Le serveur backend est peut-être éteint.');
        } else if (err.response) {
            const status = err.response.status;
            
            if (status === 403) {
                setError(`Accès refusé.`);
            } else if (status === 400) {
                // Mauvaise requête : soit mauvais mdp, soit mauvais code
                if (step === 'login') {
                    setError('Identifiant ou mot de passe incorrect.');
                } else {
                    setError('Code de sécurité incorrect ou expiré.');
                }
            } else {
                setError(`Erreur serveur ${status}.`);
            }
        } else {
            setError('Erreur réseau ou inconnue.');
        }
    }

    return (
        <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-white">
                    {step === 'login' ? 'Connectez-vous' : 'Vérification en deux étapes'}
                </h2>
                {step === '2fa' && (
                    <p className="mt-2 text-center text-sm text-gray-300">
                        Veuillez entrer le code à 6 chiffres envoyé à votre adresse email.
                    </p>
                )}
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                <div className="bg-white px-6 py-8 shadow sm:rounded-lg sm:px-10">
                    
                    {successMessage && (
                        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative" role="alert">
                            <span className="block sm:inline text-sm">{successMessage}</span>
                        </div>
                    )}
                    
                    {step === 'login' ? (
                        <form className="space-y-6" onSubmit={handleLoginSubmit}>
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium leading-6 text-gray-900">
                                    Identifiant
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="username"
                                        name="username"
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                                    Mot de passe
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 bg-white"
                                    />
                                </div>
                            </div>

                            {error && <p className="text-red-600 text-sm">{error}</p>}

                            <div>
                                <Button type="submit" className="w-full text-white" disabled={isLoading}>
                                    {isLoading ? 'Vérification...' : 'Continuer'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handle2FASubmit}>
                            <div>
                                <label htmlFor="code" className="block text-sm font-medium leading-6 text-gray-900">
                                    Code de sécurité
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="code"
                                        name="code"
                                        type="text"
                                        required
                                        maxLength={6}
                                        value={twoFactorCode}
                                        onChange={(e) => setTwoFactorCode(e.target.value)}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 bg-white tracking-widest text-center text-lg"
                                        placeholder="123456"
                                    />
                                </div>
                            </div>

                            {error && <p className="text-red-600 text-sm">{error}</p>}

                            <div className="flex flex-col gap-3">
                                <Button type="submit" className="w-full text-white" disabled={isLoading}>
                                    {isLoading ? 'Connexion...' : 'Se connecter'}
                                </Button>
                                
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => {
                                        setStep('login');
                                        setError('');
                                        setSuccessMessage('');
                                        setTwoFactorCode('');
                                    }}
                                    disabled={isLoading}
                                >
                                    Retour
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
