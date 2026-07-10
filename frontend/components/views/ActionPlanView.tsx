'use client';

import { useEffect, useState } from 'react';
import api, { getActions, createAction, updateAction, deleteAction } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { 
    Plus, 
    Trash2, 
    Check, 
    Clock, 
    AlertCircle, 
    User, 
    Calendar, 
    Filter,
    ListTodo,
    KanbanSquare,
    AlertTriangle
} from 'lucide-react';

interface Action {
    id: number;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'done' | 'canceled';
    priority: 'low' | 'medium' | 'high';
    due_date: string | null;
    assigned_to: number | null;
    assigned_to_name: string | null;
    assigned_to_fullname: string | null;
    reporter: number;
    reporter_name: string;
    created_at: string;
}

interface UserOption {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
}

export default function ActionPlanView() {
    const { user } = useAuth();
    const [actions, setActions] = useState<Action[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [layoutMode, setLayoutMode] = useState<'kanban' | 'list'>('kanban');
    
    // Filters
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    
    // Create form state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [formDueDate, setFormDueDate] = useState('');
    const [formAssignedTo, setFormAssignedTo] = useState<string>('');

    useEffect(() => {
        fetchActions();
        fetchUsers();
    }, []);

    const fetchActions = async () => {
        try {
            const response = await getActions();
            setActions(response.data);
        } catch (error) {
            console.error("Erreur de récupération des actions:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users/');
            setUsers(response.data);
        } catch (error) {
            console.error("Erreur de récupération des utilisateurs:", error);
        }
    };

    const handleCreateAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim()) return;

        try {
            const payload = {
                title: formTitle,
                description: formDesc,
                priority: formPriority,
                due_date: formDueDate || null,
                assigned_to: formAssignedTo ? parseInt(formAssignedTo) : null,
                status: 'todo'
            };
            await createAction(payload);
            
            // Reset
            setFormTitle('');
            setFormDesc('');
            setFormPriority('medium');
            setFormDueDate('');
            setFormAssignedTo('');
            setShowCreateModal(false);
            
            fetchActions();
        } catch (error) {
            console.error("Erreur lors de la création de l'action:", error);
            alert("Erreur lors de la création");
        }
    };

    const handleUpdateStatus = async (id: number, newStatus: Action['status']) => {
        try {
            await updateAction(id, { status: newStatus });
            setActions(prev => prev.map(act => act.id === id ? { ...act, status: newStatus } : act));
        } catch (error) {
            console.error("Erreur de mise à jour du statut:", error);
        }
    };

    const handleDeleteAction = async (id: number) => {
        if (window.confirm("Voulez-vous vraiment supprimer cette action ?")) {
            try {
                await deleteAction(id);
                setActions(prev => prev.filter(act => act.id !== id));
            } catch (error) {
                console.error("Erreur de suppression de l'action:", error);
            }
        }
    };

    // Filter logic
    const filteredActions = actions.filter(act => {
        const matchesStatus = filterStatus === 'all' || act.status === filterStatus;
        const matchesPriority = filterPriority === 'all' || act.priority === filterPriority;
        return matchesStatus && matchesPriority;
    });

    const getPriorityBadge = (prio: string) => {
        switch (prio) {
            case 'high':
                return <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">Haute</span>;
            case 'medium':
                return <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">Moyenne</span>;
            default:
                return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">Basse</span>;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'done':
                return <Check className="w-4 h-4 text-green-500" />;
            case 'in_progress':
                return <Clock className="w-4 h-4 text-orange-500 animate-spin-slow" />;
            case 'canceled':
                return <AlertCircle className="w-4 h-4 text-gray-400" />;
            default:
                return <ListTodo className="w-4 h-4 text-red-400" />;
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                        Plan d'Actions Correctives
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Consignez et pilotez les actions de réduction des risques de l'entreprise.
                    </p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Nouvelle Action
                </Button>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap justify-between items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold">Filtres :</span>
                    </div>
                    {/* Status filter */}
                    <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-secondary/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                    >
                        <option value="all">Tous les Statuts</option>
                        <option value="todo">À faire</option>
                        <option value="in_progress">En cours</option>
                        <option value="done">Clôturé</option>
                        <option value="canceled">Annulé</option>
                    </select>

                    {/* Priority filter */}
                    <select 
                        value={filterPriority} 
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="bg-secondary/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                    >
                        <option value="all">Toutes les Priorités</option>
                        <option value="low">Priorité Basse</option>
                        <option value="medium">Priorité Moyenne</option>
                        <option value="high">Priorité Haute</option>
                    </select>
                </div>

                {/* Layout Mode Switcher */}
                <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
                    <button
                        onClick={() => setLayoutMode('kanban')}
                        className={`p-1.5 rounded-md transition-colors bg-transparent border-0 cursor-pointer ${layoutMode === 'kanban' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Vue Tableau Kanban"
                    >
                        <KanbanSquare className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setLayoutMode('list')}
                        className={`p-1.5 rounded-md transition-colors bg-transparent border-0 cursor-pointer ${layoutMode === 'list' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Vue Liste"
                    >
                        <ListTodo className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : layoutMode === 'list' ? (
                /* List View */
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10 text-left">
                            <thead className="bg-white/5 text-gray-300 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Action / Description</th>
                                    <th className="px-6 py-4">Statut</th>
                                    <th className="px-6 py-4">Priorité</th>
                                    <th className="px-6 py-4">Échéance</th>
                                    <th className="px-6 py-4">Responsable</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredActions.map((act) => {
                                    const isOwner = user && (user.id === act.reporter || user.is_staff || user.is_superuser);
                                    return (
                                        <tr key={act.id} className="hover:bg-white/5 transition-colors text-sm">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-white">{act.title}</div>
                                                <div className="text-xs text-gray-400 mt-1 line-clamp-1">{act.description}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(act.status)}
                                                    <span className="capitalize">{
                                                        act.status === 'todo' ? 'À faire' : 
                                                        act.status === 'in_progress' ? 'En cours' : 
                                                        act.status === 'done' ? 'Clôturé' : 'Annulé'
                                                    }</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{getPriorityBadge(act.priority)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {act.due_date ? new Date(act.due_date).toLocaleDateString('fr-FR') : 'Non planifiée'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <User className="w-3.5 h-3.5 text-primary" />
                                                    <span>{act.assigned_to_fullname || act.assigned_to_name || 'Non assigné'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    {act.status !== 'done' && (
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="text-green-400 border-green-500/20 bg-green-500/10 hover:bg-green-500 hover:text-white"
                                                            onClick={() => handleUpdateStatus(act.id, 'done')}
                                                        >
                                                            Clôturer
                                                        </Button>
                                                    )}
                                                    {act.status === 'todo' && (
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="text-orange-400 border-orange-500/20 bg-orange-500/10 hover:bg-orange-500 hover:text-white"
                                                            onClick={() => handleUpdateStatus(act.id, 'in_progress')}
                                                        >
                                                            Démarrer
                                                        </Button>
                                                    )}
                                                    {isOwner && (
                                                        <button 
                                                            onClick={() => handleDeleteAction(act.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white/5 rounded-lg bg-transparent border-0 cursor-pointer"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredActions.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-gray-400">
                                            Aucune action trouvée correspondant à vos critères de recherche.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Kanban View */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Column Todo */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col min-h-[500px]">
                        <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                            <h3 className="font-bold flex items-center gap-2 text-red-400">
                                <ListTodo className="w-5 h-5" />
                                À faire
                            </h3>
                            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-bold">
                                {filteredActions.filter(a => a.status === 'todo').length}
                            </span>
                        </div>
                        <div className="space-y-3 overflow-y-auto flex-1 max-h-[600px] pr-1">
                            {filteredActions.filter(a => a.status === 'todo').map(act => (
                                <KanbanCard 
                                    key={act.id} 
                                    action={act} 
                                    onUpdate={handleUpdateStatus} 
                                    onDelete={handleDeleteAction} 
                                    user={user}
                                    getPriorityBadge={getPriorityBadge}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Column In Progress */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col min-h-[500px]">
                        <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                            <h3 className="font-bold flex items-center gap-2 text-orange-400">
                                <Clock className="w-5 h-5" />
                                En cours
                            </h3>
                            <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full font-bold">
                                {filteredActions.filter(a => a.status === 'in_progress').length}
                            </span>
                        </div>
                        <div className="space-y-3 overflow-y-auto flex-1 max-h-[600px] pr-1">
                            {filteredActions.filter(a => a.status === 'in_progress').map(act => (
                                <KanbanCard 
                                    key={act.id} 
                                    action={act} 
                                    onUpdate={handleUpdateStatus} 
                                    onDelete={handleDeleteAction} 
                                    user={user}
                                    getPriorityBadge={getPriorityBadge}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Column Done */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col min-h-[500px]">
                        <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                            <h3 className="font-bold flex items-center gap-2 text-green-400">
                                <Check className="w-5 h-5" />
                                Clôturé
                            </h3>
                            <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full font-bold">
                                {filteredActions.filter(a => a.status === 'done').length}
                            </span>
                        </div>
                        <div className="space-y-3 overflow-y-auto flex-1 max-h-[600px] pr-1">
                            {filteredActions.filter(a => a.status === 'done').map(act => (
                                <KanbanCard 
                                    key={act.id} 
                                    action={act} 
                                    onUpdate={handleUpdateStatus} 
                                    onDelete={handleDeleteAction} 
                                    user={user}
                                    getPriorityBadge={getPriorityBadge}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Action Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-secondary/95 border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold">Ajouter une Action Corrective</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer text-xl">×</button>
                        </div>
                        <form onSubmit={handleCreateAction} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Intitulé de l'action *</label>
                                <input
                                    type="text"
                                    required
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="Ex: Remplacer le câble d'alimentation usé"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Description détaillée</label>
                                <textarea
                                    value={formDesc}
                                    onChange={(e) => setFormDesc(e.target.value)}
                                    placeholder="Décrivez précisément l'action à réaliser..."
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Priorité</label>
                                    <select
                                        value={formPriority}
                                        onChange={(e) => setFormPriority(e.target.value as any)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="low">Basse</option>
                                        <option value="medium">Moyenne</option>
                                        <option value="high">Haute</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Échéance</label>
                                    <input
                                        type="date"
                                        value={formDueDate}
                                        onChange={(e) => setFormDueDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Responsable de l'action</label>
                                <select
                                    value={formAssignedTo}
                                    onChange={(e) => setFormAssignedTo(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                >
                                    <option value="">Sélectionner un collaborateur...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {`${u.first_name} ${u.last_name}`.trim() || u.username}
                                        </option>
                                    ))}
                                </select>
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

/* Kanban Card Inner Component */
function KanbanCard({ 
    action, 
    onUpdate, 
    onDelete, 
    user,
    getPriorityBadge
}: { 
    action: Action; 
    onUpdate: (id: number, s: Action['status']) => void; 
    onDelete: (id: number) => void;
    user: any;
    getPriorityBadge: (prio: string) => React.ReactNode;
}) {
    const isOwner = user && (user.id === action.reporter || user.is_staff || user.is_superuser);
    
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow group relative">
            {/* Delete button on hover */}
            {isOwner && (
                <button
                    onClick={() => onDelete(action.id)}
                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-500 bg-transparent border-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Supprimer"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}

            <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    {getPriorityBadge(action.priority)}
                </div>
                <h4 className="font-bold text-white text-sm line-clamp-1">{action.title}</h4>
                <p className="text-xs text-gray-400 line-clamp-2 mt-1">{action.description}</p>
            </div>

            {/* Meta details */}
            <div className="text-[11px] text-gray-400 space-y-1 bg-white/5 rounded-lg p-2">
                <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-primary" />
                    <span className="truncate">Responsable : {action.assigned_to_fullname || action.assigned_to_name || 'Non assigné'}</span>
                </div>
                {action.due_date && (
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>Échéance : {new Date(action.due_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                )}
            </div>

            {/* Quick transition buttons */}
            <div className="flex gap-1 border-t border-white/5 pt-3">
                {action.status === 'todo' && (
                    <Button 
                        size="sm" 
                        className="w-full text-[10px] h-7 bg-orange-600/20 text-orange-400 border border-orange-500/20 hover:bg-orange-600 hover:text-white"
                        onClick={() => onUpdate(action.id, 'in_progress')}
                    >
                        Démarrer
                    </Button>
                )}
                {action.status === 'in_progress' && (
                    <>
                        <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 text-[10px] h-7 text-gray-400 border-white/10 bg-transparent"
                            onClick={() => onUpdate(action.id, 'todo')}
                        >
                            Mettre en attente
                        </Button>
                        <Button 
                            size="sm" 
                            className="flex-1 text-[10px] h-7 bg-green-600/20 text-green-400 border border-green-500/20 hover:bg-green-600 hover:text-white"
                            onClick={() => onUpdate(action.id, 'done')}
                        >
                            Clôturer
                        </Button>
                    </>
                )}
                {action.status === 'done' && (
                    <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full text-[10px] h-7 text-gray-400 border-white/10 bg-transparent hover:bg-white/5"
                        onClick={() => onUpdate(action.id, 'in_progress')}
                    >
                        Réouvrir l'action
                    </Button>
                )}
            </div>
        </div>
    );
}
