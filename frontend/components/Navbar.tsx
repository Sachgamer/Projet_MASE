'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import api, { getBaseURL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
    Download, 
    LayoutDashboard, 
    Files, 
    AlertTriangle, 
    History, 
    CheckSquare, 
    Settings, 
    ExternalLink, 
    LogOut, 
    ChevronDown,
    Menu,
    X,
    User,
    Shield,
    Sun,
    Moon,
    BarChart3,
    ClipboardList,
    Award,
    FlaskConical,
    Database,
    Wifi,
    WifiOff
} from 'lucide-react';


// Composant Barre de Navigation : Présent sur toutes les pages après connexion
export default function Navbar() {
    const { user, logout } = useAuth();
    const { setView } = useView();
    const [isMenuOpen, setIsMenuOpen] = useState(false); // État du menu mobile
    const [isReportsOpen, setIsReportsOpen] = useState(false); // État du menu déroulant "Remontées"
    const [isRegistriesOpen, setIsRegistriesOpen] = useState(false); // État du menu déroulant "Registres"
    const [isAdminOpen, setIsAdminOpen] = useState(false); // État du menu déroulant "Admin"
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null); // Utilisé pour l'installation PWA
    const [theme, setTheme] = useState<'light' | 'dark'>('light'); // État du thème Jour/Nuit
    const [mounted, setMounted] = useState(false); // Permet d'éviter les erreurs d'hydratation (Next.js)
    const [isOnline, setIsOnline] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const reportsRef = useRef<HTMLDivElement>(null);
    const registriesRef = useRef<HTMLDivElement>(null);
    const adminRef = useRef<HTMLDivElement>(null);

    // Synchronisation automatique des données stockées hors-ligne
    const syncOfflineData = async () => {
        if (!navigator.onLine || isSyncing) return;
        setIsSyncing(true);

        try {
            // 1. Sync Inspections
            const pendingInspections = JSON.parse(localStorage.getItem('pending_inspections') || '[]');
            if (pendingInspections.length > 0) {
                const remaining = [];
                for (const item of pendingInspections) {
                    try {
                        const formData = new FormData();
                        formData.append('item', item.item.toString());
                        formData.append('is_valid', item.is_valid.toString());
                        formData.append('defects', JSON.stringify(item.defects));
                        formData.append('vehicle_checks', JSON.stringify(item.vehicle_checks));
                        formData.append('comments', item.comments);
                        
                        if (item.photos && item.photos.length > 0) {
                            for (const photo of item.photos) {
                                const blob = await fetch(photo.base64).then(r => r.blob());
                                const file = new File([blob], photo.name, { type: photo.type });
                                formData.append('photos', file);
                            }
                        }
                        await api.post('/api/controls/inspections/', formData);
                    } catch (err) {
                        console.error("Erreur sync inspection:", err);
                        remaining.push(item);
                    }
                }
                localStorage.setItem('pending_inspections', JSON.stringify(remaining));
            }

            // 2. Sync Reports
            const pendingReports = JSON.parse(localStorage.getItem('pending_reports') || '[]');
            if (pendingReports.length > 0) {
                const remaining = [];
                for (const item of pendingReports) {
                    try {
                        const formData = new FormData();
                        formData.append('severity', item.severity);
                        formData.append('incident_type', item.incident_type);
                        formData.append('location', item.location);
                        if (item.worksite) {
                            formData.append('worksite', item.worksite.toString());
                        }
                        formData.append('description', item.description);
                        formData.append('incident_date', item.incident_date);
                        
                        if (item.media && item.media.length > 0) {
                            for (const mediaItem of item.media) {
                                const blob = await fetch(mediaItem.base64).then(r => r.blob());
                                const file = new File([blob], mediaItem.name, { type: mediaItem.type });
                                if (mediaItem.mediaType === 'image') {
                                    formData.append('photos', file);
                                } else {
                                    formData.append('video', file);
                                }
                            }
                        }
                        await api.post('/api/reports/', formData);
                    } catch (err) {
                        console.error("Erreur sync report:", err);
                        remaining.push(item);
                    }
                }
                localStorage.setItem('pending_reports', JSON.stringify(remaining));
            }
        } catch (e) {
            console.error("Erreur générale durant la synchronisation:", e);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (isOnline) {
            syncOfflineData();
        }
    }, [isOnline]);

    useEffect(() => {
        setMounted(true);
        let initialTheme: 'light' | 'dark' = 'light';
        
        try {
            // Au chargement, récupérer le thème sauvegardé ou utiliser les préférences système
            const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
            if (savedTheme === 'light' || savedTheme === 'dark') {
                initialTheme = savedTheme;
            } else {
                const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                initialTheme = systemPrefersDark ? 'dark' : 'light';
            }
        } catch (e) {
            console.error("Impossible de récupérer les préférences de thème:", e);
        }
        
        setTheme(initialTheme);
        try {
            if (initialTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } catch (e) {
            console.error("Impossible d'appliquer la classe sombre sur documentElement:", e);
        }

        // Gère l'état du réseau hors-ligne
        if (typeof window !== 'undefined') {
            setIsOnline(navigator.onLine);
            const handleOnline = () => {
                setIsOnline(true);
            };
            const handleOffline = () => {
                setIsOnline(false);
            };
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            const checkPending = () => {
                const pendingInspections = JSON.parse(localStorage.getItem('pending_inspections') || '[]');
                const pendingReports = JSON.parse(localStorage.getItem('pending_reports') || '[]');
                setPendingCount(pendingInspections.length + pendingReports.length);
            };
            checkPending();
            const interval = setInterval(checkPending, 3000);

            // Gère l'événement d'installation de l'application (PWA)
            const handleBeforeInstallPrompt = (e: any) => {
                e.preventDefault();
                setDeferredPrompt(e);
            };
            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            
            // Ferme les menus déroulants si on clique n'importe où ailleurs sur la page
            const handleClickOutside = (event: MouseEvent) => {
                if (reportsRef.current && !reportsRef.current.contains(event.target as Node)) {
                    setIsReportsOpen(false);
                }
                if (registriesRef.current && !registriesRef.current.contains(event.target as Node)) {
                    setIsRegistriesOpen(false);
                }
                if (adminRef.current && !adminRef.current.contains(event.target as Node)) {
                    setIsAdminOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            
            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
                document.removeEventListener('mousedown', handleClickOutside);
                clearInterval(interval);
            };
        }
    }, []);


    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        try {
            localStorage.setItem('theme', newTheme);
        } catch (e) {
            console.error("Impossible de sauvegarder le thème:", e);
        }
        try {
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } catch (e) {
            console.error("Impossible d'ajouter/supprimer la classe sombre:", e);
        }
    };

    // Lance la procédure d'installation PWA si disponible
    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    // Définition des liens principaux du menu
    const mainLinks = [
        { view: 'hse-dashboard', label: 'Dashboard HSE', icon: BarChart3 },
        { view: 'dashboard', label: 'Causeries', icon: LayoutDashboard },
        { view: 'action-plan', label: 'Plan d\'Actions', icon: ClipboardList },
        { view: 'controle', label: 'Auto-contrôles', icon: CheckSquare },
        { view: 'files', label: 'Mes Fichiers', icon: Files },
    ] as const;

    // Liens spécifiques aux remontées d'accidents
    const reportLinks = [
        { view: 'report-create', label: 'Faire une Remontée', icon: AlertTriangle },
        { view: 'report-list', label: 'Historique des Remontées', icon: History },
    ] as const;

    // Liens spécifiques aux registres sécurité
    const registryLinks = [
        { view: 'chemical-registry', label: 'Risques Chimiques / FDS', icon: FlaskConical },
        { view: 'habilitation-list', label: 'Habilitations & Visites', icon: Award },
    ] as const;

    return (
        <nav className="bg-secondary/60 border-b border-border/40 backdrop-blur-md sticky top-0 z-[100]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        {/* Logo / Titre -> Retour à l'accueil */}
                        <button
                            onClick={() => setView('home')}
                            className="flex-shrink-0 flex items-center font-black text-2xl text-primary tracking-tighter hover:opacity-80 transition-opacity border-0 bg-transparent cursor-pointer mr-4"
                        >
                            Web<span className="text-white">MASE</span>
                        </button>
                        
                        {/* Liens Desktop (Affichés sur grands écrans) */}
                        <div className="hidden lg:flex items-center space-x-1 border-l border-border/30 pl-4 gap-1.5">
                            {mainLinks.map((link) => (
                                <button
                                    key={link.view}
                                    onClick={() => setView(link.view)}
                                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all bg-transparent border-0 cursor-pointer whitespace-nowrap"
                                >
                                    <link.icon className="w-4 h-4 opacity-70" />
                                    {link.label}
                                </button>
                            ))}
                            
                            {/* Menu déroulant Remontées */}
                            <div className="relative h-full flex items-center" ref={reportsRef}>
                                <button 
                                    onClick={() => {
                                        setIsReportsOpen(!isReportsOpen);
                                        setIsRegistriesOpen(false);
                                        setIsAdminOpen(false);
                                    }}
                                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all bg-transparent border-0 cursor-pointer whitespace-nowrap ${isReportsOpen ? 'text-white bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <AlertTriangle className="w-4 h-4 opacity-70 text-orange-500" />
                                    Remontées
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isReportsOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isReportsOpen && (
                                    <div className="absolute top-14 left-0 w-56 p-2 bg-secondary/95 border border-border/50 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-200">
                                        {reportLinks.map((link) => (
                                            <button
                                                key={link.view}
                                                onClick={() => {
                                                    setView(link.view);
                                                    setIsReportsOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left text-gray-300 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-0 cursor-pointer"
                                            >
                                                <link.icon className={`w-4 h-4 ${link.view === 'report-create' ? 'text-red-500' : 'text-blue-400'}`} />
                                                {link.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Menu déroulant Registres */}
                            <div className="relative h-full flex items-center" ref={registriesRef}>
                                <button 
                                    onClick={() => {
                                        setIsRegistriesOpen(!isRegistriesOpen);
                                        setIsReportsOpen(false);
                                        setIsAdminOpen(false);
                                    }}
                                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all bg-transparent border-0 cursor-pointer whitespace-nowrap ${isRegistriesOpen ? 'text-white bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <Database className="w-4 h-4 opacity-70 text-blue-500" />
                                    Registres
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isRegistriesOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isRegistriesOpen && (
                                    <div className="absolute top-14 left-0 w-56 p-2 bg-secondary/95 border border-border/50 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-200">
                                        {registryLinks.map((link) => (
                                            <button
                                                key={link.view}
                                                onClick={() => {
                                                    setView(link.view);
                                                    setIsRegistriesOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left text-gray-300 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-0 cursor-pointer"
                                            >
                                                <link.icon className="w-4 h-4 text-primary" />
                                                {link.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section Droite : Auth, Install PWA, Administration */}
                    <div className="hidden md:flex md:items-center space-x-3">
                        {/* Indicateur de statut réseau (Online/Offline) */}
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
                            {isOnline ? (
                                <span className="flex items-center gap-1 text-green-500 bg-green-500/10 px-2.5 py-0.5 rounded-full border border-green-500/20">
                                    <Wifi className="w-3.5 h-3.5" />
                                    En ligne
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20 animate-pulse">
                                    <WifiOff className="w-3.5 h-3.5" />
                                    Hors-ligne {pendingCount > 0 && `(${pendingCount} sync)`}
                                </span>
                            )}
                        </div>

                        {/* Commutateur de thème Jour/Nuit */}
                        <button
                            onClick={toggleTheme}
                            className="text-gray-300 hover:text-primary transition-colors bg-transparent border-0 cursor-pointer p-2 rounded-full flex items-center justify-center mr-2"
                            title={!mounted ? "Passer en mode sombre" : (theme === 'light' ? "Passer en mode sombre" : "Passer en mode clair")}
                        >
                            {!mounted ? (
                                <Moon className="w-5 h-5 text-gray-400 hover:text-primary" />
                            ) : theme === 'light' ? (
                                <Moon className="w-5 h-5 text-gray-400 hover:text-primary" />
                            ) : (
                                <Sun className="w-5 h-5 text-yellow-500 hover:text-yellow-400" />
                            )}
                        </button>

                        {/* Bouton d'installation sur mobile/ordinateur (PWA) */}
                        {deferredPrompt && (
                            <Button
                                onClick={handleInstallClick}
                                className="bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600 hover:text-white flex items-center gap-2 transition-all"
                                size="sm"
                            >
                                <Download className="w-4 h-4" />
                                PWA
                            </Button>
                        )}
                        
                        {user ? (
                            <div className="flex items-center gap-3">
                                {/* Zone d'administration : Accessible uniquement au staff/administrateur */}
                                {(user.is_staff || user.is_superuser) && (
                                    <div className="relative h-full flex items-center" ref={adminRef}>
                                        <button 
                                            onClick={() => {
                                                setIsAdminOpen(!isAdminOpen);
                                                setIsReportsOpen(false);
                                                setIsRegistriesOpen(false);
                                            }}
                                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[13px] font-bold transition-all bg-transparent border-0 cursor-pointer whitespace-nowrap ${isAdminOpen ? 'text-primary bg-primary/10' : 'text-primary hover:bg-primary/5'}`}
                                        >
                                            <Settings className="w-4 h-4" />
                                            Admin
                                            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isAdminOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isAdminOpen && (
                                            <div className="absolute top-14 right-0 w-64 p-2 bg-secondary/95 border border-border/50 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-200">
                                                <button 
                                                    onClick={() => {
                                                        setView('auto-control-list');
                                                        setIsAdminOpen(false);
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left text-gray-300 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-0 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <CheckSquare className="w-4 h-4 text-orange-400" />
                                                        Rapports d'Auto-contrôle
                                                    </div>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setView('blocked-mac-list');
                                                        setIsAdminOpen(false);
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left text-gray-300 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-0 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Shield className="w-4 h-4 text-red-400" />
                                                        MACs Bloquées
                                                    </div>
                                                </button>
                                                <a href={`${getBaseURL()}/api/schema/swagger-ui/`} target="_blank" rel="noopener noreferrer" className="block text-decoration-none">
                                                    <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left text-gray-300 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-0 cursor-pointer">
                                                        <div className="flex items-center gap-3">
                                                            <ExternalLink className="w-4 h-4 text-green-500" />
                                                            Swagger API Documentation
                                                        </div>
                                                    </button>
                                                </a>
                                                <a href={`${getBaseURL()}/admin`} target="_blank" rel="noopener noreferrer" className="block text-decoration-none">
                                                    <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left text-gray-300 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-0 cursor-pointer">
                                                        <div className="flex items-center gap-3">
                                                            <Settings className="w-4 h-4 text-primary" />
                                                            Accès Django Admin
                                                        </div>
                                                    </button>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <div className="h-8 w-[1px] bg-border/40 mx-2" />
                                
                                {/* Informations utilisateur loggé */}
                                <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-border/30">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                        <User className="w-3 h-3 text-primary" />
                                    </div>
                                    <span className="text-sm font-medium text-white">{user.username}</span>
                                    <button
                                        onClick={logout}
                                        className="text-gray-400 hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer p-1"
                                        title="Déconnexion"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="border-primary/50 text-primary hover:bg-primary hover:text-white"
                                onClick={() => setView('login')}
                            >
                                Connexion
                            </Button>
                        )}
                    </div>

                    {/* Bouton Menu Mobile (Apparaît sur petits écrans) */}
                    <div className="flex items-center lg:hidden">
                        <button
                            onClick={toggleMenu}
                            className="bg-transparent border-0 text-gray-300 hover:text-white p-2 cursor-pointer"
                        >
                            {isMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Menu de navigation plein écran pour Mobile */}
            {isMenuOpen && (
                <div className="lg:hidden absolute top-16 left-0 w-full h-[calc(100vh-4rem)] bg-secondary/98 backdrop-blur-2xl border-b border-border shadow-2xl overflow-y-auto overscroll-contain flex flex-col">
                    <div className="px-4 py-6 space-y-6 flex-1 pb-12">
                        {/* Commutateur de thème Jour/Nuit (Mobile) */}
                        <div className="flex items-center justify-between px-4 py-4 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-lg font-medium text-gray-300 font-bold">
                                Mode {!mounted ? 'Clair' : (theme === 'light' ? 'Clair' : 'Sombre')}
                            </span>
                            <button
                                onClick={toggleTheme}
                                className="text-gray-300 hover:text-primary transition-colors bg-transparent border-0 cursor-pointer p-2 rounded-full flex items-center justify-center"
                                title={!mounted ? "Passer en mode sombre" : (theme === 'light' ? "Passer en mode sombre" : "Passer en mode clair")}
                            >
                                {!mounted ? (
                                    <Moon className="w-6 h-6 text-gray-400" />
                                ) : theme === 'light' ? (
                                    <Moon className="w-6 h-6 text-gray-400" />
                                ) : (
                                    <Sun className="w-6 h-6 text-yellow-500" />
                                )}
                            </button>
                        </div>

                        {/* Indicateur de statut réseau (Mobile) */}
                        <div className="flex items-center justify-between px-4 py-4 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-lg font-medium text-gray-300 font-bold">État du Réseau</span>
                            {isOnline ? (
                                <span className="flex items-center gap-1 text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 text-sm font-semibold">
                                    <Wifi className="w-4 h-4" />
                                    En ligne
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 text-sm font-semibold animate-pulse">
                                    <WifiOff className="w-4 h-4" />
                                    Hors-ligne {pendingCount > 0 && `(${pendingCount})`}
                                </span>
                            )}
                        </div>

                        {/* Option d'installation sur Mobile */}
                        {deferredPrompt && (
                            <button
                                onClick={() => { handleInstallClick(); setIsMenuOpen(false); }}
                                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-bold text-orange-400 bg-orange-600/10 border border-orange-500/20"
                            >
                                <Download className="w-6 h-6" />
                                Installer l'application
                            </button>
                        )}

                        {/* Liens principaux Mobile */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2">Menu Principal</h3>
                            {mainLinks.map((link) => (
                                <button
                                    key={link.view}
                                    onClick={() => { setView(link.view); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl bg-transparent border-0 text-left"
                                >
                                    <link.icon className="w-5 h-5 opacity-60" />
                                    {link.label}
                                </button>
                            ))}
                        </div>

                        {/* Liens Remontées Mobile */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2">Remontées</h3>
                            {reportLinks.map((link) => (
                                <button
                                    key={link.view}
                                    onClick={() => { setView(link.view); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl bg-transparent border-0 text-left"
                                >
                                    <link.icon className={`w-5 h-5 ${link.view === 'report-create' ? 'text-red-500' : 'text-blue-400'}`} />
                                    {link.label}
                                </button>
                            ))}
                        </div>

                        {/* Liens Registres Mobile */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2">Registres</h3>
                            {registryLinks.map((link) => (
                                <button
                                    key={link.view}
                                    onClick={() => { setView(link.view); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl bg-transparent border-0 text-left"
                                >
                                    <link.icon className="w-5 h-5 text-primary opacity-70" />
                                    {link.label}
                                </button>
                            ))}
                        </div>

                        {/* Section Administration Mobile */}
                        {user && (user.is_staff || user.is_superuser) && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2">Administration</h3>
                                <button 
                                    onClick={() => {
                                        setView('auto-control-list');
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl bg-transparent border-0 text-left"
                                >
                                    <CheckSquare className="w-5 h-5 text-orange-400" />
                                    Rapports d'Auto-contrôle
                                </button>
                                <button 
                                    onClick={() => {
                                        setView('blocked-mac-list');
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl bg-transparent border-0 text-left"
                                >
                                    <Shield className="w-5 h-5 text-red-400" />
                                    MACs Bloquées
                                </button>
                                <a href={`${getBaseURL()}/api/schema/swagger-ui/`} target="_blank" rel="noopener noreferrer" className="block w-full">
                                    <button className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl bg-transparent border-0 text-left">
                                        <ExternalLink className="w-5 h-5 text-green-500" />
                                        Documentation API
                                    </button>
                                </a>
                                <a href={`${getBaseURL()}/admin`} target="_blank" rel="noopener noreferrer" className="block w-full">
                                    <button className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl bg-transparent border-0 text-left">
                                        <Settings className="w-5 h-5 text-primary" />
                                        Accès Django Admin
                                    </button>
                                </a>
                            </div>
                        )}

                        {/* État de connexion Mobile */}
                        <div className="pt-6 border-t border-border/50">
                            {user ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 px-2">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                            <User className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{user.username}</p>
                                            <p className="text-xs text-gray-500">{user.email || 'Utilisateur'}</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => { logout(); setIsMenuOpen(false); }}
                                        variant="destructive"
                                        className="w-full flex items-center justify-center gap-2 h-14 text-lg font-bold"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        Déconnexion
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="default"
                                    className="w-full h-14 text-lg font-bold"
                                    onClick={() => { setView('login'); setIsMenuOpen(false); }}
                                >
                                    Connexion
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}

