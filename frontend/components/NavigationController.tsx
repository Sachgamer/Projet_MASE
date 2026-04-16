'use client';

import { useView } from '@/context/ViewContext';
import HomeView from '@/components/views/HomeView';
import DashboardView from '@/components/views/DashboardView';
import LoginView from '@/components/views/LoginView';
import FilesView from '@/components/views/FilesView';
import ControleView from '@/components/views/ControleView';
import SlideshowDetailView from '@/components/views/SlideshowDetailView';
import SlideshowCreateView from '@/components/views/SlideshowCreateView';
import QuizView from '@/components/views/QuizView';
import QuizManageView from '@/components/views/QuizManageView';
import ReportCreateView from '@/components/views/ReportCreateView';
import ReportListView from '@/components/views/ReportListView';
import AutoControlListView from '@/components/views/AutoControlListView';
import { useAuth } from '@/context/AuthContext';

/**
 * NavigationController : Gère l'affichage dynamique des composants (pages) 
 * sans rechargement du navigateur (système SPA personnalisé).
 */
export default function NavigationController() {
    const { currentView } = useView();
    const { user, loading } = useAuth();

    // Affiche un écran de chargement pendant que l'état d'authentification est récupéré
    if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-white text-2xl font-bold animate-pulse">Chargement...</div>;

    // Si l'utilisateur n'est pas connecté, on le force sur la page de connexion
    // (Sauf s'il essaie déjà de se connecter)
    if (!user && currentView !== 'login') {
        return <LoginView />;
    }

    // Sélection de la vue à afficher selon l'état global currentView
    switch (currentView) {
        case 'home':
            return <HomeView />;
        case 'dashboard':
            return <DashboardView />;
        case 'login':
            return <LoginView />;
        case 'files':
            return <FilesView />;
        case 'controle':
            return <ControleView />;
        case 'slideshow-detail':
            return <SlideshowDetailView />;
        case 'slideshow-create':
            return <SlideshowCreateView />;
        case 'quiz':
            return <QuizView />;
        case 'quiz-manage':
            return <QuizManageView />;
        case 'report-create':
            return <ReportCreateView />;
        case 'report-list':
            return <ReportListView />;
        case 'auto-control-list':
            return <AutoControlListView />;
        default:
            return <HomeView />;
    }
}
