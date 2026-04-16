'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// Liste des différentes pages disponibles sur le site
type View = 'home' | 'dashboard' | 'login' | 'slideshow-detail' | 'slideshow-create' | 'files' | 'report-create' | 'report-list' | 'controle' | 'quiz' | 'quiz-manage' | 'auto-control-list';

interface ViewContextType {
    currentView: View; // Page actuellement affichée
    viewParams: any; // Paramètres passés à la page (ex: ID d'un diaporama)
    setView: (view: View, params?: any) => void; // Fonction pour changer de page
}

// Le contexte View permet de changer de page sans recharger tout le site (Single Page Application)
const ViewContext = createContext<ViewContextType | undefined>(undefined);

export function ViewProvider({ children }: { children: React.ReactNode }) {
    const [currentView, setCurrentView] = useState<View>('home');
    const [viewParams, setViewParams] = useState<any>({});

    // Change la page affichée et remonte en haut de l'écran
    const setView = (view: View, params: any = {}) => {
        setCurrentView(view);
        setViewParams(params);
        window.scrollTo(0, 0);
    };

    return (
        <ViewContext.Provider value={{ currentView, viewParams, setView }}>
            {children}
        </ViewContext.Provider>
    );
}

// Hook pour changer de vue depuis n'importe quel composant
export function useView() {
    const context = useContext(ViewContext);
    if (context === undefined) {
        throw new Error('useView must be used within a ViewProvider');
    }
    return context;
}
