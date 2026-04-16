'use client';

import { Button } from "@/components/ui/button";
import { useView } from "@/context/ViewContext";

// Page d'accueil simple incitant l'utilisateur à se connecter ou à démarrer
export default function HomeView() {
    const { setView } = useView();

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center px-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
                <span className="block xl:inline">Bienvenue dans </span>
                <span className="block text-primary xl:inline">WebMASE</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                Retrouvez tout vos documents en un seul endroit, ainsi que les causeries avec leur quiz et créé les remontées d'accident.
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
                <div className="rounded-md shadow">
                    <Button 
                        className="w-full h-full text-lg px-8 py-3"
                        onClick={() => setView('dashboard')}
                    >
                        Démarrer
                    </Button>
                </div>
            </div>
        </div>
    );
}
