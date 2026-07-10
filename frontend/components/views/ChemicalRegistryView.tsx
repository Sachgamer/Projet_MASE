'use client';

import { useEffect, useState } from 'react';
import { getChemicalProducts, createChemicalProduct, deleteChemicalProduct } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { 
    FlaskConical, 
    Plus, 
    Trash2, 
    Download, 
    Search, 
    AlertTriangle,
    Info
} from 'lucide-react';

interface ChemicalProduct {
    id: number;
    name: string;
    manufacturer: string;
    sds_file: string;
    pictograms: string; // Ex: "GHS02,GHS07"
    description: string;
    created_at: string;
}

const GHS_DATABASE: Record<string, { label: string; color: string; desc: string }> = {
    'GHS01': { label: 'Explosif', color: 'bg-red-950 text-red-400 border-red-800', desc: 'Substances explosives' },
    'GHS02': { label: 'Inflammable', color: 'bg-orange-950 text-orange-400 border-orange-800', desc: 'Produits inflammables' },
    'GHS03': { label: 'Comburant', color: 'bg-amber-950 text-amber-400 border-amber-800', desc: 'Favorise les incendies' },
    'GHS04': { label: 'Gaz sous pression', color: 'bg-sky-950 text-sky-400 border-sky-800', desc: 'Bouteilles de gaz' },
    'GHS05': { label: 'Corrosif', color: 'bg-red-900 text-red-300 border-red-700', desc: 'Attaque les métaux et la peau' },
    'GHS06': { label: 'Toxique', color: 'bg-red-950 text-red-500 border-red-900', desc: 'Poison ou toxicité aiguë' },
    'GHS07': { label: 'Nocif / Irritant', color: 'bg-yellow-950 text-yellow-400 border-yellow-800', desc: 'Effets irritants ou allergies' },
    'GHS08': { label: 'Danger pour la santé', color: 'bg-purple-950 text-purple-400 border-purple-800', desc: 'Cancérogène ou mutagène' },
    'GHS09': { label: 'Polluant environnement', color: 'bg-emerald-950 text-emerald-400 border-emerald-800', desc: 'Toxique pour la faune aquatique' },
};

export default function ChemicalRegistryView() {
    const { user } = useAuth();
    const [products, setProducts] = useState<ChemicalProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Create form state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formName, setFormName] = useState('');
    const [formManufacturer, setFormManufacturer] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formFile, setFormFile] = useState<File | null>(null);
    const [selectedPictograms, setSelectedPictograms] = useState<string[]>([]);

    const isAdmin = user && (user.is_staff || user.is_superuser);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await getChemicalProducts();
            setProducts(response.data);
        } catch (error) {
            console.error("Erreur de récupération des produits chimiques:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim() || !formFile) return;

        try {
            const formData = new FormData();
            formData.append('name', formName);
            formData.append('manufacturer', formManufacturer);
            formData.append('description', formDescription);
            formData.append('sds_file', formFile);
            formData.append('pictograms', selectedPictograms.join(','));

            await createChemicalProduct(formData);

            // Reset
            setFormName('');
            setFormManufacturer('');
            setFormDescription('');
            setFormFile(null);
            setSelectedPictograms([]);
            setShowCreateModal(false);

            fetchProducts();
        } catch (error) {
            console.error("Erreur lors de la création du produit:", error);
            alert("Erreur de création du produit.");
        }
    };

    const handleDeleteProduct = async (id: number) => {
        if (window.confirm("Voulez-vous supprimer ce produit chimique et sa FDS associée ?")) {
            try {
                await deleteChemicalProduct(id);
                setProducts(prev => prev.filter(p => p.id !== id));
            } catch (error) {
                console.error("Erreur lors de la suppression:", error);
            }
        }
    };

    const togglePictogramSelection = (code: string) => {
        setSelectedPictograms(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    const getPictogramBadges = (pictsStr: string) => {
        if (!pictsStr) return null;
        const codes = pictsStr.split(',').filter(Boolean);
        return (
            <div className="flex flex-wrap gap-1.5 mt-2">
                {codes.map(code => {
                    const ghs = GHS_DATABASE[code];
                    if (!ghs) return null;
                    return (
                        <span 
                            key={code} 
                            className={`border text-[10px] px-2 py-0.5 rounded font-bold cursor-help ${ghs.color}`}
                            title={ghs.desc}
                        >
                            {ghs.label}
                        </span>
                    );
                })}
            </div>
        );
    };

    const filteredProducts = products.filter(p => {
        const term = searchTerm.toLowerCase();
        return (
            p.name.toLowerCase().includes(term) ||
            p.manufacturer.toLowerCase().includes(term) ||
            p.description.toLowerCase().includes(term)
        );
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                        Registre des Risques Chimiques / FDS
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Consultez l'inventaire des produits chimiques autorisés et téléchargez leurs Fiches de Données de Sécurité (FDS) réglementaires.
                    </p>
                </div>
                {isAdmin && (
                    <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Nouveau Produit
                    </Button>
                )}
            </div>

            {/* Warning alert */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-3 text-sm text-yellow-200">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                <div>
                    <span className="font-bold">Rappel Réglementaire MASE :</span> L'utilisation de tout produit chimique sur chantier est strictement conditionnée à la possession de sa FDS à jour (moins de 5 ans) et à la connaissance des équipements de protection individuelle (EPI) associés.
                </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-4 items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par nom de produit, fabricant, consignes..."
                    className="w-full bg-transparent border-0 text-white placeholder-gray-500 focus:outline-none focus:ring-0 text-sm"
                />
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((prod) => (
                        <div key={prod.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:shadow-lg transition-all backdrop-blur-md flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-extrabold text-white">{prod.name}</h3>
                                        <p className="text-xs text-gray-400 font-semibold">Fabricant : {prod.manufacturer || 'Non spécifié'}</p>
                                    </div>
                                    <FlaskConical className="w-6 h-6 text-orange-400/80" />
                                </div>

                                {/* Hazard pictograms */}
                                <div>
                                    <span className="text-[10px] uppercase text-gray-500 font-semibold block">Dangers</span>
                                    {prod.pictograms ? getPictogramBadges(prod.pictograms) : (
                                        <span className="text-xs text-gray-400 italic">Aucun danger signalé</span>
                                    )}
                                </div>

                                {/* Usage description */}
                                <div className="bg-white/5 rounded-lg p-3 space-y-1">
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                        <Info className="w-3.5 h-3.5 text-primary" />
                                        Instructions d'usage
                                    </div>
                                    <p className="text-xs text-gray-300 line-clamp-3">
                                        {prod.description || "Aucune consigne d'utilisation spécifique enregistrée."}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 border-t border-white/5 pt-4">
                                <a 
                                    href={prod.sds_file} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex-1 text-decoration-none"
                                >
                                    <Button variant="outline" className="w-full text-white border-white/20 hover:bg-white/5 flex items-center justify-center gap-1 text-xs">
                                        <Download className="w-3.5 h-3.5 text-orange-400" />
                                        Fiche FDS (PDF)
                                    </Button>
                                </a>

                                {isAdmin && (
                                    <Button 
                                        variant="destructive" 
                                        className="p-2"
                                        onClick={() => handleDeleteProduct(prod.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredProducts.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-gray-400">Aucun produit chimique répertorié dans le registre.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create Product Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-secondary/95 border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold">Répertorier un Produit Chimique</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer text-xl">×</button>
                        </div>
                        <form onSubmit={handleCreateProduct} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Nom commercial *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="Ex: Acétone Pure"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Fabricant / Fournisseur</label>
                                    <input
                                        type="text"
                                        value={formManufacturer}
                                        onChange={(e) => setFormManufacturer(e.target.value)}
                                        placeholder="Ex: Chimie France SA"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Fiche de données de sécurité (FDS PDF) *</label>
                                <input
                                    type="file"
                                    required
                                    accept=".pdf"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setFormFile(e.target.files[0]);
                                        }
                                    }}
                                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:opacity-90 file:cursor-pointer"
                                />
                            </div>

                            {/* Pictogram checkboxes */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Pictogrammes de danger (SGH)</label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {Object.entries(GHS_DATABASE).map(([code, data]) => (
                                        <label key={code} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={selectedPictograms.includes(code)}
                                                onChange={() => togglePictogramSelection(code)}
                                                className="rounded border-gray-300 text-primary focus:ring-primary h-4.5 w-4.5"
                                            />
                                            <span>{data.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Conseils d'utilisation & Stockage</label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Ex: Porter des gants en nitrile. Conserver dans un endroit sec et ventilé."
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary resize-none"
                                />
                            </div>

                            <div className="pt-4 border-t border-white/10 flex justify-end gap-2">
                                <Button type="button" variant="outline" className="text-white border-white/20" onClick={() => setShowCreateModal(false)}>
                                    Annuler
                                </Button>
                                <Button type="submit">
                                    Enregistrer
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
