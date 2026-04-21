'use client';

import { useState, useEffect } from 'react';
import { getFiles, uploadFile, deleteFile } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { FileUp, File, Trash2, Eye, Loader2, X } from 'lucide-react';

// Interface pour les fichiers personnels de l'utilisateur
interface PersonalFile {
    id: number;
    file: string; // URL du fichier
    name: string;
    uploaded_at: string;
    user_name?: string;
}

// Vue permettant de gérer ses documents personnels (téléchargement, visualisation, suppression)
export default function FilesView() {
    const [files, setFiles] = useState<PersonalFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [previewFile, setPreviewFile] = useState<PersonalFile | null>(null); // Fichier actuellement en prévisualisation
    const { user } = useAuth();

    useEffect(() => {
        loadFiles();
    }, []);

    // Charge la liste des fichiers depuis l'API
    const loadFiles = async () => {
        try {
            const response = await getFiles();
            setFiles(response.data);
            setLoading(false);
        } catch (err: any) {
            console.error('Erreur lors du chargement des fichiers:', err.message);
            setError('Erreur lors du chargement des fichiers.');
            setLoading(false);
        }
    };

    // Gère la sélection d'un fichier sur l'ordinateur
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    // Envoie le fichier sélectionné au serveur
    const handleUpload = async () => {
        if (!selectedFile) return;

        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 Mo (aligné avec la limite Nginx)
        
        if (selectedFile.size > MAX_FILE_SIZE) {
            setError('Fichier trop volumineux. Veuillez réduire la taille du fichier (max. 100 Mo).');
            setSelectedFile(null);
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            await uploadFile(formData);
            setSelectedFile(null);
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            loadFiles(); // Rafraîchit la liste après l'upload
        } catch (err: any) {
            console.error('Erreur lors du téléchargement du fichier:', err.message);
            if (err.response?.status === 413 || !err.response) {
                setError('Fichier trop volumineux. Veuillez réduire la taille du fichier (max. 100 Mo).');
            } else {
                setError('Erreur lors du téléchargement du fichier.');
            }
        }
    };

    // Supprime un fichier après confirmation
    const handleDelete = async (id: number) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce fichier ?")) {
            try {
                await deleteFile(id);
                setFiles(prev => prev.filter(f => f.id !== id));
            } catch (err: any) {
                console.error('Erreur lors de la suppression du fichier:', err.message);
                alert('Erreur lors de la suppression du fichier.');
            }
        }
    };

    return (
        <div className="container mx-auto p-4 pt-12 text-white">
            <h1 className="text-3xl font-bold mb-6">Mes fichiers</h1>

            {error && <div className="bg-red-500 text-white p-2 rounded mb-4">{error}</div>}

            {/* Section d'importation de documents */}
            <div className="mb-8 p-6 bg-gray-800 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Importer un fichier</h2>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            onClick={() => document.getElementById('file-upload')?.click()}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20"
                        >
                            <FileUp className="w-5 h-5" />
                            Parcourir les fichiers
                        </button>
                        
                        {/* Affiche le nom du fichier sélectionné avant l'upload */}
                        {selectedFile && (
                            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                                <File className="w-4 h-4 text-blue-400" />
                                <span className="text-sm text-gray-300 truncate max-w-[200px]">{selectedFile.name}</span>
                                <button onClick={() => setSelectedFile(null)} className="text-gray-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all shadow-lg ${selectedFile
                                ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed shadow-none'
                                }`}
                        >
                            Importer
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <p>Chargement des fichiers...</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {files.length === 0 && <p className="text-gray-400 col-span-full">Aucun fichier importé.</p>}
                    {files.map((file) => {
                        // Seul le propriétaire ou un admin peut supprimer le fichier
                        const isOwner = user && (user.username === file.user_name || user.is_staff || user.is_superuser || !file.user_name);
                        return (
                            <div key={file.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors flex flex-col justify-between">
                                <div>
                                    <h3 className="font-bold text-lg truncate mb-2" title={file.name}>{file.name}</h3>
                                    {file.user_name && <p className="text-xs text-indigo-300 mb-1">Propriétaire: {file.user_name}</p>}
                                    <p className="text-xs text-gray-400 mb-4">Importé le: {new Date(file.uploaded_at).toLocaleDateString()} {new Date(file.uploaded_at).toLocaleTimeString()}</p>
                                </div>
                                <div className="flex gap-2 mt-auto">
                                    <button
                                        onClick={() => setPreviewFile(file)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded transition-colors cursor-pointer border-0"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Voir
                                    </button>
                                    {isOwner && (
                                        <button
                                            onClick={() => handleDelete(file.id)}
                                            className="flex-1 flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Supprimer
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de prévisualisation (Image ou PDF) */}
            {previewFile && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
                    onClick={() => setPreviewFile(null)}
                >
                    <div className="relative max-w-5xl w-full h-[90vh] flex flex-col items-center justify-center">
                        <div className="w-full flex justify-between items-center mb-4 px-2">
                             <h3 className="text-xl font-bold truncate pr-10">{previewFile.name}</h3>
                             <button 
                                onClick={(e) => { e.stopPropagation(); setPreviewFile(null); }}
                                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors border-0 cursor-pointer"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="w-full flex-1 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center animate-in zoom-in duration-300 shadow-2xl border border-white/10">
                            {previewFile.file.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) ? (
                                <img 
                                    src={previewFile.file} 
                                    alt={previewFile.name} 
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : previewFile.file.match(/\.pdf$/i) ? (
                                <iframe 
                                    src={previewFile.file} 
                                    className="w-full h-full border-0" 
                                    title={previewFile.name}
                                />
                            ) : (
                                <div className="text-center p-8 bg-black/50 rounded-2xl border border-white/10 max-w-md w-full mx-4">
                                     <File className="w-16 h-16 text-white mx-auto mb-4 opacity-80" />
                                     <h3 className="text-xl font-semibold text-white mb-2">Aperçu non disponible</h3>
                                     <p className="text-gray-300 mb-6 text-sm">
                                         Ce type de fichier ne peut pas être prévisualisé directement.
                                     </p>
                                     <a
                                         href={previewFile.file}
                                         target="_blank"
                                         rel="noopener noreferrer"
                                         className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition w-full font-medium shadow-lg"
                                     >
                                         Ouvrir dans un nouvel onglet
                                     </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
