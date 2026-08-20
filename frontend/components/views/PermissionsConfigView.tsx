'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Shield, Save, CheckSquare, Square, RefreshCw } from 'lucide-react';

interface ViewPermission {
    id: number;
    view_name: string;
    label: string;
    allow_admin: boolean;
    allow_technician: boolean;
    allow_agency: boolean;
}

export default function PermissionsConfigView() {
    const [permissions, setPermissions] = useState<ViewPermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/permissions/');
            setPermissions(response.data);
        } catch (error) {
            console.error("Erreur lors de la récupération des permissions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckboxChange = (viewName: string, field: 'allow_admin' | 'allow_technician' | 'allow_agency') => {
        setPermissions(prev =>
            prev.map(p => p.view_name === viewName ? { ...p, [field]: !p[field] } : p)
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                permissions: permissions.map(p => ({
                    view_name: p.view_name,
                    allow_admin: p.allow_admin,
                    allow_technician: p.allow_technician,
                    allow_agency: p.allow_agency
                }))
            };
            await api.post('/api/permissions/bulk-update/', payload);
            alert("Permissions mises à jour avec succès ! Elles seront appliquées lors du prochain rechargement ou de la navigation.");
            fetchPermissions();
        } catch (error) {
            console.error("Erreur lors de la sauvegarde des permissions:", error);
            alert("Une erreur est survenue lors de la sauvegarde.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-white">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold flex items-center gap-3">
                        <Shield className="text-primary w-8 h-8" />
                        Configuration des Droits
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">Configurez les droits d'accès aux différentes sections de l'application selon les rôles.</p>
                </div>
                <Button 
                    variant="outline" 
                    className="border-white/10 text-white hover:bg-white/5" 
                    onClick={fetchPermissions}
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/10 text-left">
                                <thead className="bg-white/5 text-gray-300 uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Section / Onglet</th>
                                        <th className="px-6 py-4 text-center">Administrateur</th>
                                        <th className="px-6 py-4 text-center">Technicien</th>
                                        <th className="px-6 py-4 text-center">Agence</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10 text-sm">
                                    {permissions.map((perm) => (
                                        <tr key={perm.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-white">{perm.label}</span>
                                                <code className="block text-[10px] text-gray-500 mt-0.5">{perm.view_name}</code>
                                            </td>
                                            
                                            {/* Admin Column */}
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCheckboxChange(perm.view_name, 'allow_admin')}
                                                    className="inline-flex items-center justify-center p-1 rounded hover:bg-white/5 cursor-pointer text-primary bg-transparent border-0"
                                                >
                                                    {perm.allow_admin ? (
                                                        <CheckSquare className="w-5 h-5 text-primary" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-gray-500" />
                                                    )}
                                                </button>
                                            </td>

                                            {/* Technician Column */}
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCheckboxChange(perm.view_name, 'allow_technician')}
                                                    className="inline-flex items-center justify-center p-1 rounded hover:bg-white/5 cursor-pointer text-primary bg-transparent border-0"
                                                >
                                                    {perm.allow_technician ? (
                                                        <CheckSquare className="w-5 h-5 text-primary" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-gray-500" />
                                                    )}
                                                </button>
                                            </td>

                                            {/* Agency Column */}
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCheckboxChange(perm.view_name, 'allow_agency')}
                                                    className="inline-flex items-center justify-center p-1 rounded hover:bg-white/5 cursor-pointer text-primary bg-transparent border-0"
                                                >
                                                    {perm.allow_agency ? (
                                                        <CheckSquare className="w-5 h-5 text-primary" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-gray-500" />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="bg-primary hover:bg-primary-hover text-white px-6 py-6 font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/25"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
