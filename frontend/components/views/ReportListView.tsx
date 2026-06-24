'use client';

import { useState, useEffect } from 'react';
import { getReports, deleteReport, updateReport, getBaseURL, downloadAccidentPdf } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, 
    Filter, 
    Calendar, 
    MapPin, 
    User, 
    Download, 
    Trash2, 
    CheckCircle, 
    Clock, 
    Undo, 
    Eye, 
    ChevronLeft, 
    ChevronRight, 
    BarChart2, 
    AlertTriangle, 
    ArrowUpDown, 
    ChevronDown, 
    ChevronUp,
    FileText
} from 'lucide-react';

// Interfaces représentant les photos et les remontées
interface AccidentReportPhoto {
    id: number;
    image: string;
    uploaded_at: string;
}

interface AccidentReport {
    id: number;
    severity: string;
    incident_type: string;
    location: string;
    description: string;
    incident_date: string;
    image: string | null;
    video: string | null;
    published: boolean; // Si vrai, le rapport est considéré comme "Validé" par l'admin
    created_at: string;
    reporter_name: string;
    photos?: AccidentReportPhoto[];
}

export default function ReportListView() {
    const { user, loading: authLoading } = useAuth();
    const { setView } = useView();
    const [reports, setReports] = useState<AccidentReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // États pour le lightbox d'aperçu d'image
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
    const [currentImageSet, setCurrentImageSet] = useState<string[]>([]);
    
    // États pour les filtres, la recherche et le tri
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSeverity, setSelectedSeverity] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('date-desc');
    const [activeTab, setActiveTab] = useState('to-validate'); // 'to-validate', 'validated', 'all'
    
    // Cartes déployées (Set d'IDs de rapports)
    const [expandedReports, setExpandedReports] = useState<Set<number>>(new Set());

    // États pour la pagination
    const [currentPage, setCurrentPage] = useState(1);
    const reportsPerPage = 10;

    useEffect(() => {
        loadReports();
    }, []);

    // Récupère tous les rapports de remontées
    const loadReports = async () => {
        try {
            const response = await getReports();
            setReports(response.data);
            setLoading(false);
        } catch (err: any) {
            console.error('Erreur de chargement des rapports:', err.message);
            setError('Erreur de chargement des rapports');
            setLoading(false);
        }
    };

    // Supprime un rapport après confirmation
    const handleDelete = async (id: number) => {
        if (!window.confirm('Voulez-vous vraiment supprimer ce rapport ?')) return;
        try {
            await deleteReport(id);
            setReports(prev => prev.filter(r => r.id !== id));
        } catch (err: any) {
            if (err.response?.status === 404) {
                setReports(prev => prev.filter(r => r.id !== id));
                return;
            }
            alert('Erreur lors de la suppression.');
        }
    };

    // Valide un rapport (le fait passer en publié)
    const handleValidate = async (id: number) => {
        try {
            await updateReport(id, { published: true });
            setReports(reports.map(r => r.id === id ? { ...r, published: true } : r));
        } catch (err: any) {
            alert('Erreur de validation');
        }
    };

    // Dé-valide un rapport (le remet en attente de validation)
    const handleUnvalidate = async (id: number) => {
        try {
            await updateReport(id, { published: false });
            setReports(reports.map(r => r.id === id ? { ...r, published: false } : r));
        } catch (err: any) {
            alert('Erreur lors de la dé-validation');
        }
    };

    // Alterne le pliage/dépliage d'une carte de rapport
    const toggleExpand = (id: number) => {
        setExpandedReports(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Récupère toutes les URLs d'images associées à un rapport de manière unique
    const getReportImages = (report: AccidentReport): string[] => {
        const urls: string[] = [];
        if (report.image) {
            const primaryUrl = report.image.startsWith('http') ? report.image : `${getBaseURL()}${report.image}`;
            urls.push(primaryUrl);
        }
        if (report.photos && report.photos.length > 0) {
            report.photos.forEach(photo => {
                const photoUrl = photo.image.startsWith('http') ? photo.image : `${getBaseURL()}${photo.image}`;
                if (!urls.includes(photoUrl)) {
                    urls.push(photoUrl);
                }
            });
        }
        return urls;
    };

    // Ouvre le diaporama d'aperçu d'images
    const openLightbox = (imageIndex: number, images: string[]) => {
        setCurrentImageSet(images);
        setSelectedImageIndex(imageIndex);
        setSelectedImage(images[imageIndex]);
    };

    const handlePrevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedImageIndex > 0) {
            const newIndex = selectedImageIndex - 1;
            setSelectedImageIndex(newIndex);
            setSelectedImage(currentImageSet[newIndex]);
        }
    };

    const handleNextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedImageIndex < currentImageSet.length - 1) {
            const newIndex = selectedImageIndex + 1;
            setSelectedImageIndex(newIndex);
            setSelectedImage(currentImageSet[newIndex]);
        }
    };

    // Utilitaire pour définir les styles et labels selon la gravité
    const getSeverityDetails = (severity: string) => {
        switch (severity) {
            case 'low': return { color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30', label: 'Faible', border: 'border-l-green-500' };
            case 'medium': return { color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30', label: 'Moyen', border: 'border-l-yellow-500' };
            case 'high': return { color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30', label: 'Élevé', border: 'border-l-orange-500' };
            case 'critical': return { color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30', label: 'Critique', border: 'border-l-red-600 shadow-[inset_4px_0_0_0_rgba(239,68,68,0.3)]' };
            default: return { color: 'bg-muted/30 text-muted-foreground border-border', label: severity, border: 'border-l-border' };
        }
    };

    // Utilitaire pour obtenir le label et le style selon la catégorie d'incident
    const getCategoryDetails = (category: string) => {
        switch (category) {
            case 'dangerous_situation': return { color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20', label: 'Situation dangereuse' };
            case 'near_miss': return { color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', label: 'Presque accident' };
            case 'accident': return { color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', label: 'Accident' };
            case 'fatal_accident': return { color: 'bg-red-900/10 dark:bg-red-900/20 text-red-700 dark:text-red-500 border-red-900/30 bg-red-500/5 dark:bg-red-950/20', label: 'Accident mortel' };
            default: return { color: 'bg-muted/20 text-muted-foreground border-border', label: category };
        }
    };

    // Calcul de l'importance pour le tri
    const getSeverityWeight = (severity: string) => {
        switch (severity) {
            case 'critical': return 4;
            case 'high': return 3;
            case 'medium': return 2;
            case 'low': return 1;
            default: return 0;
        }
    };

    // Calcul global des statistiques pour l'en-tête (indépendant des filtres actifs)
    const stats = {
        total: reports.length,
        toValidate: reports.filter(r => !r.published).length,
        validated: reports.filter(r => r.published).length,
        critical: reports.filter(r => r.severity === 'critical' && !r.published).length
    };

    // Onglets de navigation
    const tabs = [
        { id: 'to-validate', label: 'À valider', count: stats.toValidate },
        { id: 'validated', label: 'Validés & Archivés', count: stats.validated },
        { id: 'all', label: 'Toutes les remontées', count: stats.total }
    ];

    // --- FILTRAGE, RECHERCHE ET TRI DES RAPPORTS ---
    const filteredReports = reports
        // 1. Onglet actif
        .filter(r => {
            if (activeTab === 'to-validate') return !r.published;
            if (activeTab === 'validated') return r.published;
            return true;
        })
        // 2. Recherche textuelle
        .filter(r => {
            const query = searchQuery.toLowerCase().trim();
            if (!query) return true;
            return (
                r.location.toLowerCase().includes(query) ||
                r.description.toLowerCase().includes(query) ||
                r.reporter_name.toLowerCase().includes(query)
            );
        })
        // 3. Gravité
        .filter(r => {
            if (selectedSeverity === 'all') return true;
            return r.severity === selectedSeverity;
        })
        // 3b. Catégorie d'incident
        .filter(r => {
            if (selectedCategory === 'all') return true;
            return r.incident_type === selectedCategory;
        })
        // 4. Tri
        .sort((a, b) => {
            if (sortBy === 'date-desc') {
                return new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime();
            }
            if (sortBy === 'date-asc') {
                return new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime();
            }
            if (sortBy === 'severity-desc') {
                const diff = getSeverityWeight(b.severity) - getSeverityWeight(a.severity);
                return diff !== 0 ? diff : new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime();
            }
            if (sortBy === 'severity-asc') {
                const diff = getSeverityWeight(a.severity) - getSeverityWeight(b.severity);
                return diff !== 0 ? diff : new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime();
            }
            return 0;
        });

    // --- PAGINATION ---
    const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
    const indexOfLastReport = currentPage * reportsPerPage;
    const indexOfFirstReport = indexOfLastReport - reportsPerPage;
    const currentReports = filteredReports.slice(indexOfFirstReport, indexOfLastReport);

    if (loading || authLoading) return <div className="p-8 text-foreground">Chargement des données...</div>;

    return (
        <div className="container mx-auto p-4 pt-12 text-foreground">
            
            {/* Titre Principal */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        Remontées d'accidents
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Gérez, validez et suivez l'historique des incidents de sécurité QHSE.</p>
                </div>
            </div>

            {error && <div className="bg-destructive/10 border border-destructive/25 text-destructive p-4 rounded-xl mb-6 flex items-center gap-2">{error}</div>}

            {/* Section 1 : Dashboard / Indicateurs Clés */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Total */}
                <div className="p-4 bg-secondary/50 backdrop-blur-md rounded-xl border border-border shadow-lg flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <BarChart2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Total Signalements</p>
                        <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    </div>
                </div>
                {/* À Valider */}
                <div className={`p-4 bg-secondary/50 backdrop-blur-md rounded-xl border border-border shadow-lg flex items-center gap-4 transition-all duration-300 ${stats.toValidate > 0 ? 'ring-1 ring-orange-500/30' : ''}`}>
                    <div className={`p-3 rounded-lg ${stats.toValidate > 0 ? 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 animate-pulse border border-orange-500/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">En attente de validation</p>
                        <p className="text-2xl font-bold text-foreground">{stats.toValidate}</p>
                    </div>
                </div>
                {/* Critiques */}
                <div className={`p-4 bg-secondary/50 backdrop-blur-md rounded-xl border border-border shadow-lg flex items-center gap-4 transition-all duration-300 ${stats.critical > 0 ? 'ring-1 ring-red-500/30' : ''}`}>
                    <div className={`p-3 rounded-lg ${stats.critical > 0 ? 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 border-none' : 'bg-muted text-muted-foreground border border-border'}`}>
                        <AlertTriangle className={`w-6 h-6 ${stats.critical > 0 ? 'animate-bounce' : ''}`} />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Critiques non lues</p>
                        <p className="text-2xl font-bold text-foreground">{stats.critical}</p>
                    </div>
                </div>
                {/* Validés */}
                <div className="p-4 bg-secondary/50 backdrop-blur-md rounded-xl border border-border shadow-lg flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Rapports validés</p>
                        <p className="text-2xl font-bold text-foreground">{stats.validated}</p>
                    </div>
                </div>
            </div>

            {/* Section 2 : Barre de contrôle (Recherche, Filtres, Tri) */}
            <div className="p-4 bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/50 shadow-md flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center mb-6">
                {/* Recherche */}
                <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground pointer-events-none">
                        <Search className="w-4 h-4" />
                    </span>
                    <input
                        type="text"
                        placeholder="Rechercher par lieu, description, auteur..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                </div>
                
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Catégorie */}
                    <div className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-1.5 text-foreground">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent border-none text-sm text-foreground focus:outline-none cursor-pointer"
                        >
                            <option value="all" className="bg-background text-foreground">Toutes les catégories</option>
                            <option value="dangerous_situation" className="bg-background text-foreground">Situation dangereuse</option>
                            <option value="near_miss" className="bg-background text-foreground">Presque accident</option>
                            <option value="accident" className="bg-background text-foreground">Accident</option>
                            <option value="fatal_accident" className="bg-background text-foreground">Accident mortel</option>
                        </select>
                    </div>

                    {/* Tri */}
                    <div className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-1.5 text-foreground">
                        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                        <select
                            value={sortBy}
                            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent border-none text-sm text-foreground focus:outline-none cursor-pointer"
                        >
                            <option value="date-desc" className="bg-background text-foreground">Plus récent d'abord</option>
                            <option value="date-asc" className="bg-background text-foreground">Plus ancien d'abord</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Section 3 : Onglets de Navigation et bouton d'action */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 border-b border-border pb-4">
                <div className="flex gap-2 bg-secondary/50 p-1 rounded-xl border border-border w-fit self-center sm:self-auto">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                                    isActive 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                }`}
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    {tab.label}
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
                
                <Button 
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-lg text-white font-medium gap-2 px-5 py-2.5 rounded-xl transition-all border-0 cursor-pointer"
                    onClick={() => setView('report-create')}
                >
                    <AlertTriangle className="w-4 h-4" />
                    Faire une Remontée
                </Button>
            </div>

            {/* Section 4 : Liste des Rapports (Courants / Pagines) */}
            {currentReports.length > 0 ? (
                <div className="space-y-6">
                    <AnimatePresence mode="popLayout">
                        <div className="grid grid-cols-1 gap-6">
                            {currentReports.map((report) => {
                                const isExpanded = expandedReports.has(report.id);
                                const severityInfo = getSeverityDetails(report.severity);
                                const images = getReportImages(report);
                                
                                return (
                                    <motion.div
                                        key={report.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className={`p-5 md:p-6 bg-secondary/50 backdrop-blur-md rounded-2xl shadow-md border border-border hover:border-border/80 transition-all border-l-4 ${severityInfo.border} flex flex-col gap-4`}
                                    >
                                        {/* En-tête de la carte */}
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getCategoryDetails(report.incident_type).color}`}>
                                                    {getCategoryDetails(report.incident_type).label}
                                                </span>
                                                {!report.published ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                                        En attente
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                        Validé
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <span className="text-xs text-muted-foreground flex items-center gap-1 min-w-max">
                                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                                {new Date(report.incident_date).toLocaleString('fr-FR', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                })}
                                            </span>
                                        </div>

                                        {/* Informations principales (Lieu et Déclarant) */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                            <h3 className="text-lg font-bold text-foreground flex items-center gap-1.5 break-words max-w-full">
                                                <MapPin className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                                                {report.location}
                                            </h3>
                                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-500/10 px-2 py-1 rounded-md flex items-center gap-1 border border-blue-500/20">
                                                <User className="w-3 h-3 text-blue-500" />
                                                Signaleur : {report.reporter_name}
                                            </span>
                                        </div>

                                        {/* Description (pliable) */}
                                        <div>
                                            <p className={`text-foreground/80 text-sm leading-relaxed break-words whitespace-pre-wrap ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                                {report.description}
                                            </p>
                                            
                                            {report.description.length > 150 && (
                                                <button
                                                    onClick={() => toggleExpand(report.id)}
                                                    className="mt-1 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer flex items-center gap-0.5 focus:outline-none bg-transparent border-0"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            Masquer les détails <ChevronUp className="w-3.5 h-3.5" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            Voir toute la description <ChevronDown className="w-3.5 h-3.5" />
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        {/* Médias (Visibles si déployés, ou aperçu compact si repliés) */}
                                        {images.length > 0 || report.video ? (
                                            <div>
                                                {isExpanded ? (
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Médias joints ({images.length + (report.video ? 1 : 0)})</h4>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                            {images.map((imgUrl, idx) => (
                                                                <div key={idx} className="relative group rounded-lg overflow-hidden border border-border bg-input aspect-video flex items-center justify-center">
                                                                    <img 
                                                                        src={imgUrl} 
                                                                        className="object-cover w-full h-full cursor-pointer group-hover:scale-105 transition-transform duration-300"
                                                                        onClick={() => openLightbox(idx, images)}
                                                                        alt={`Photo ${idx + 1}`}
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                                                                        <span className="bg-gray-900/80 px-2 py-1 rounded text-[10px] text-white flex items-center gap-1 font-medium">
                                                                            <Eye className="w-3 h-3" />
                                                                            Agrandir
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {report.video && (
                                                                <div className="relative rounded-lg overflow-hidden border border-border bg-input aspect-video flex items-center justify-center col-span-2">
                                                                    <video 
                                                                        src={report.video.startsWith('http') ? report.video : `${getBaseURL()}${report.video}`} 
                                                                        controls 
                                                                        className="w-full h-full object-cover" 
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        {images.slice(0, 3).map((imgUrl, idx) => (
                                                            <div key={idx} className="relative w-12 h-12 rounded border border-border bg-input overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => toggleExpand(report.id)}>
                                                                <img src={imgUrl} className="object-cover w-full h-full opacity-80 hover:opacity-100 transition-opacity" alt="Aperçu miniature" />
                                                            </div>
                                                        ))}
                                                        {images.length > 3 && (
                                                            <div className="w-12 h-12 rounded bg-input border border-border flex items-center justify-center text-xs font-bold text-muted-foreground cursor-pointer animate-pulse" onClick={() => toggleExpand(report.id)}>
                                                                +{images.length - 3}
                                                            </div>
                                                        )}
                                                        {report.video && (
                                                            <div className="px-2 py-1.5 rounded bg-input border border-border text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer hover:bg-secondary/40 transition-colors" onClick={() => toggleExpand(report.id)}>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                                Vidéo incluse
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}

                                        {/* Actions de la carte */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4">
                                            <div className="flex flex-wrap gap-2">
                                                {/* Actions administrateur */}
                                                {(user?.is_staff || user?.is_superuser) && (
                                                    <>
                                                        <Button 
                                                            variant="destructive" 
                                                            size="sm" 
                                                            className="gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border-0"
                                                            onClick={() => handleDelete(report.id)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Supprimer
                                                        </Button>
                                                        
                                                        {!report.published ? (
                                                            <Button 
                                                                className="bg-green-600 hover:bg-green-500 text-white gap-1.5 px-3 py-1.5 rounded-lg text-xs border-0 cursor-pointer" 
                                                                size="sm" 
                                                                onClick={() => handleValidate(report.id)}
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                                Valider
                                                            </Button>
                                                        ) : (
                                                            <Button 
                                                                className="bg-yellow-600 hover:bg-yellow-500 text-white gap-1.5 px-3 py-1.5 rounded-lg text-xs border-0 cursor-pointer" 
                                                                size="sm" 
                                                                onClick={() => handleUnvalidate(report.id)}
                                                            >
                                                                <Undo className="w-3.5 h-3.5" />
                                                                Dé-valider
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                                
                                                <Button 
                                                    className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 px-3 py-1.5 rounded-lg text-xs border-0 cursor-pointer" 
                                                    size="sm" 
                                                    onClick={() => downloadAccidentPdf(report.id)}
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    Télécharger PDF
                                                </Button>
                                            </div>

                                            {report.description.length > 150 && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => toggleExpand(report.id)}
                                                    className="border-border bg-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground px-3 py-1 rounded-lg text-xs cursor-pointer"
                                                >
                                                    {isExpanded ? 'Masquer' : 'Voir plus'}
                                                </Button>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </AnimatePresence>

                    {/* Section 5 : Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center bg-secondary/50 border border-border/60 p-4 rounded-xl shadow-md mt-8">
                            <p className="text-sm text-muted-foreground">
                                Affichage <span className="font-semibold text-foreground">{indexOfFirstReport + 1}</span> à{' '}
                                <span className="font-semibold text-foreground">
                                    {Math.min(indexOfLastReport, filteredReports.length)}
                                </span>{' '}
                                sur <span className="font-semibold text-foreground">{filteredReports.length}</span> remontées
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg bg-input border border-border text-foreground hover:bg-secondary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                                    title="Page précédente"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="px-4 py-2 text-sm font-semibold bg-input border border-border text-foreground rounded-lg">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg bg-input border border-border text-foreground hover:bg-secondary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                                    title="Page suivante"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* État Vide (Empty State) */
                <div className="flex flex-col items-center justify-center p-12 bg-secondary/50 border border-border/80 rounded-2xl text-center shadow-lg">
                    <div className="p-4 rounded-full bg-secondary/50 border border-border text-muted-foreground mb-4">
                        <FileText className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Aucune remontée trouvée</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        {searchQuery || selectedCategory !== 'all'
                            ? "Aucun rapport ne correspond à vos filtres de recherche." 
                            : activeTab === 'to-validate' 
                                ? "Toutes les remontées d'accidents ont été validées." 
                                : "Aucune remontée déclarée pour le moment."}
                    </p>
                    {(searchQuery || selectedCategory !== 'all') && (
                        <button
                            onClick={() => { setSearchQuery(''); setSelectedSeverity('all'); setSelectedCategory('all'); }}
                            className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-lg bg-blue-500/10 cursor-pointer"
                        >
                            Réinitialiser les filtres
                        </button>
                    )}
                </div>
            )}

            {/* Modal d'aperçu d'image en plein écran (Lightbox multi-photos) */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        {/* Bouton Précédent */}
                        {currentImageSet.length > 1 && selectedImageIndex > 0 && (
                            <button
                                onClick={handlePrevImage}
                                className="absolute left-4 z-10 bg-white/10 hover:bg-white/20 hover:scale-105 text-white p-3 rounded-full transition-all border-0 cursor-pointer shadow-lg animate-in"
                                title="Photo précédente"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        )}

                        <img 
                            src={selectedImage} 
                            alt={`Visualisation ${selectedImageIndex + 1}`} 
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                        />

                        {/* Bouton Suivant */}
                        {currentImageSet.length > 1 && selectedImageIndex < currentImageSet.length - 1 && (
                            <button
                                onClick={handleNextImage}
                                className="absolute right-4 z-10 bg-white/10 hover:bg-white/20 hover:scale-105 text-white p-3 rounded-full transition-all border-0 cursor-pointer shadow-lg animate-in"
                                title="Photo suivante"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        )}

                        {/* Légende / Compteur */}
                        {currentImageSet.length > 1 && (
                            <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-xs font-semibold text-white border border-gray-800">
                                {selectedImageIndex + 1} / {currentImageSet.length}
                            </div>
                        )}

                        {/* Bouton Fermer */}
                        <button 
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 hover:scale-105 text-white p-2 rounded-full transition-all border-0 cursor-pointer flex items-center justify-center w-10 h-10"
                            title="Fermer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
