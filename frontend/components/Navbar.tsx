'use client';

import { useState, useEffect } from 'react';
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
    Archive,
    Lock,
    Wrench
} from 'lucide-react';

export default function Navbar() {
    const { user, loading, logout } = useAuth();
    const { setView, currentView } = useView();
    const [isMenuOpen, setIsMenuOpen] = useState(false); // Mobile drawer state
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [mounted, setMounted] = useState(false);
    const [allowedViews, setAllowedViews] = useState<string[]>([]);

    useEffect(() => {
        setMounted(true);
        // Load theme preferences
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
        setTheme(initialTheme);
        if (initialTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // PWA install prompt
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    // Fetch allowed views based on permissions
    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const response = await api.get('/api/permissions/my-permissions/');
                setAllowedViews(response.data.allowed_views);
            } catch (err) {
                console.error("Error fetching permissions:", err);
            }
        };
        if (user) {
            fetchPermissions();
        }
    }, [user, currentView]); // Refresh when view changes in case permissions were updated

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const isAllowed = (viewName: string) => {
        if (user?.is_superuser) return true;
        return allowedViews.includes(viewName);
    };

    // Navigation sections & links definition
    const mainLinks = [
        { view: 'hse-dashboard', label: 'Dashboard HSE', icon: BarChart3 },
        { view: 'dashboard', label: 'Causeries', icon: LayoutDashboard },
        { view: 'action-plan', label: 'Plan d\'Actions', icon: ClipboardList },
        { view: 'controle', label: 'Auto-contrôles', icon: CheckSquare },
        { view: 'files', label: 'Mes Fichiers', icon: Files },
    ];

    const reportLinks = [
        { view: 'report-create', label: 'Faire une Remontée', icon: AlertTriangle, color: 'text-red-500' },
        { view: 'report-list', label: 'Historique Remontées', icon: History, color: 'text-blue-400' },
    ];

    const registryLinks = [
        { view: 'chemical-registry', label: 'Risques Chimiques / FDS', icon: FlaskConical },
        { view: 'habilitation-list', label: 'Habilitations & Visites', icon: Award },
        { view: 'periodic-visits', label: 'Visites Périodiques', icon: Shield },
    ];

    const adminLinks = [
        { view: 'user-management', label: 'Gestion Utilisateurs', icon: User, color: 'text-blue-400' },
        { view: 'auto-control-list', label: 'Rapports d\'Auto-contrôle', icon: CheckSquare, color: 'text-orange-400' },
        { view: 'admin-habilitation', label: 'Habilitations Techs', icon: Award, color: 'text-teal-400' },
        { view: 'blocked-mac-list', label: 'MACs Bloquées', icon: Shield, color: 'text-red-400' },
        { view: 'permissions-config', label: 'Configuration des Droits', icon: Lock, color: 'text-purple-400' },
        { view: 'archives', label: 'Archives de l\'Entreprise', icon: Archive, color: 'text-amber-500' },
        { view: 'equipment-config', label: 'Gestion du Parc Matériel', icon: Wrench, color: 'text-emerald-400' },
    ];

    if (loading || !user) {
        return null;
    }

    const renderLink = (link: { view: string; label: string; icon: any; color?: string }, onClick?: () => void) => {
        if (!isAllowed(link.view)) return null;
        const Icon = link.icon;
        const isActive = currentView === link.view;

        return (
            <button
                key={link.view}
                onClick={() => {
                    setView(link.view as any);
                    if (onClick) onClick();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all border-0 cursor-pointer text-left ${
                    isActive 
                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
            >
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : link.color || 'text-gray-400 dark:text-gray-500'}`} />
                <span className="truncate">{link.label}</span>
            </button>
        );
    };

    return (
        <>
            {/* Desktop Left Sidebar */}
            <aside className="hidden md:flex md:flex-col md:w-64 md:h-screen md:sticky md:top-0 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-white/10 shrink-0 text-gray-900 dark:text-white">
                {/* Brand Logo Header */}
                <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-white/5 shrink-0">
                    <button
                        onClick={() => setView('home')}
                        className="flex items-center font-black text-xl tracking-tight hover:opacity-80 transition-opacity border-0 bg-transparent cursor-pointer text-primary"
                    >
                        <img src="/logo.png" alt="GORON SYSTEMES Logo" className="h-7 w-7 mr-2 object-contain" />
                        Web<span className="text-gray-800 dark:text-white">MASE</span>
                    </button>
                </div>

                {/* Sidebar Navigation Links */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Main Menu */}
                    <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-2">Menu principal</span>
                        {mainLinks.map(link => renderLink(link))}
                    </div>

                    {/* Reports Dropdown / Section */}
                    {reportLinks.some(l => isAllowed(l.view)) && (
                        <div className="space-y-1">
                            <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-2">Remontées d'incidents</span>
                            {reportLinks.map(link => renderLink(link))}
                        </div>
                    )}

                    {/* Registries Section */}
                    {registryLinks.some(l => isAllowed(l.view)) && (
                        <div className="space-y-1">
                            <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-2">Registres & Conformité</span>
                            {registryLinks.map(link => renderLink(link))}
                        </div>
                    )}

                    {/* Admin Actions Section */}
                    {(user.is_staff || user.is_superuser || adminLinks.some(l => isAllowed(l.view))) && (
                        <div className="space-y-1">
                            <span className="block text-[10px] font-bold text-primary uppercase tracking-widest px-3 mb-2">Administration</span>
                            {adminLinks.map(link => renderLink(link))}
                            
                            {user.is_superuser && (
                                <>
                                    <a href={`${getBaseURL()}/api/schema/swagger-ui/`} target="_blank" rel="noopener noreferrer" className="block w-full">
                                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border-0 bg-transparent cursor-pointer text-left">
                                            <ExternalLink className="w-4.5 h-4.5 text-green-500 shrink-0" />
                                            <span className="truncate">Swagger API</span>
                                        </button>
                                    </a>
                                    <a href={`${getBaseURL()}/admin`} target="_blank" rel="noopener noreferrer" className="block w-full">
                                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border-0 bg-transparent cursor-pointer text-left">
                                            <Settings className="w-4.5 h-4.5 text-primary shrink-0" />
                                            <span className="truncate">Django Admin</span>
                                        </button>
                                    </a>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Bottom Footer User Info & Theme */}
                <div className="p-4 border-t border-gray-200 dark:border-white/5 space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        {/* Theme switch */}
                        <button
                            onClick={toggleTheme}
                            className="text-gray-400 hover:text-primary transition-colors bg-transparent border-0 cursor-pointer p-2 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5"
                            title={theme === 'light' ? "Mode Sombre" : "Mode Clair"}
                        >
                            {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5 text-yellow-500" />}
                        </button>

                        {/* PWA Install Button */}
                        {deferredPrompt && (
                            <Button
                                onClick={handleInstallClick}
                                className="bg-orange-600/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 hover:bg-orange-600 hover:text-white flex items-center gap-1.5 transition-all text-[11px] h-8 px-2"
                                size="sm"
                            >
                                <Download className="w-3.5 h-3.5" />
                                PWA
                            </Button>
                        )}
                    </div>

                    {/* Logged in User Profile Card */}
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 p-2 rounded-2xl border border-gray-200 dark:border-white/5">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-gray-800 dark:text-white truncate">{user.username}</p>
                            <p className="text-[10px] text-gray-400 truncate capitalize">{user.role || 'Technicien'}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="text-gray-400 hover:text-red-500 transition-colors bg-transparent border-0 cursor-pointer p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                            title="Déconnexion"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Top Header */}
            <header className="md:hidden h-16 w-full bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-4 sticky top-0 z-[100] text-gray-900 dark:text-white shrink-0">
                <button
                    onClick={() => setView('home')}
                    className="flex items-center font-black text-xl tracking-tight text-primary border-0 bg-transparent cursor-pointer"
                >
                    <img src="/logo.png" alt="GORON SYSTEMES Logo" className="h-7 w-7 mr-2 object-contain" />
                    Web<span className="text-gray-800 dark:text-white">MASE</span>
                </button>

                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="bg-transparent border-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 cursor-pointer"
                >
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </header>

            {/* Mobile Drawer Navigation */}
            {isMenuOpen && (
                <div className="md:hidden fixed top-16 left-0 w-full h-[calc(100vh-4rem)] bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-white/10 shadow-2xl overflow-y-auto z-50 flex flex-col p-4 space-y-6 text-gray-900 dark:text-white">
                    <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-2">Menu principal</span>
                        {mainLinks.map(link => renderLink(link, () => setIsMenuOpen(false)))}
                    </div>

                    {reportLinks.some(l => isAllowed(l.view)) && (
                        <div className="space-y-1">
                            <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-2">Remontées d'incidents</span>
                            {reportLinks.map(link => renderLink(link, () => setIsMenuOpen(false)))}
                        </div>
                    )}

                    {registryLinks.some(l => isAllowed(l.view)) && (
                        <div className="space-y-1">
                            <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-2">Registres & Conformité</span>
                            {registryLinks.map(link => renderLink(link, () => setIsMenuOpen(false)))}
                        </div>
                    )}

                    {(user.is_staff || user.is_superuser || adminLinks.some(l => isAllowed(l.view))) && (
                        <div className="space-y-1">
                            <span className="block text-[10px] font-bold text-primary uppercase tracking-widest px-3 mb-2">Administration</span>
                            {adminLinks.map(link => renderLink(link, () => setIsMenuOpen(false)))}
                        </div>
                    )}

                    <div className="pt-6 border-t border-gray-200 dark:border-white/5 space-y-4">
                        <div className="flex items-center justify-between px-3">
                            <span className="text-sm font-semibold">Mode Sombre</span>
                            <button
                                onClick={toggleTheme}
                                className="text-gray-400 hover:text-primary transition-colors bg-transparent border-0 cursor-pointer p-2 rounded-xl"
                            >
                                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
                            </button>
                        </div>

                        {deferredPrompt && (
                            <button
                                onClick={() => { handleInstallClick(); setIsMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-600/5 border border-orange-500/20 text-left"
                            >
                                <Download className="w-5 h-5" />
                                Installer l'application (PWA)
                            </button>
                        )}

                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl border border-gray-200 dark:border-white/5">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <User className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{user.username}</p>
                                <p className="text-xs text-gray-400 truncate capitalize">{user.role || 'Technicien'}</p>
                            </div>
                            <Button
                                onClick={() => { logout(); setIsMenuOpen(false); }}
                                variant="destructive"
                                size="sm"
                                className="flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Déconnexion
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
