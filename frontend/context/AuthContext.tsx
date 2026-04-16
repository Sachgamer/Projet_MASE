'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

// Interface définissant les propriétés du contexte d'authentification
interface AuthContextType {
    user: any; // Infos de l'utilisateur
    loading: boolean; // État de chargement au démarrage
    login: (token: string) => void;
    logout: () => void;
}

// Création du contexte pour partager les infos utilisateur partout dans le site
const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: () => { },
    logout: () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Vérifie si l'utilisateur est déjà connecté au chargement de la page
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Demande au serveur les infos de l'utilisateur actuel grâce au jeton
                    const response = await api.get('/auth/user/');
                    setUser(response.data);
                } catch (error: any) {
                    console.error("Auth check failed:", error.message);
                    // Si le jeton est invalide, on le supprime
                    localStorage.removeItem('token');
                    document.cookie = `token=; path=/; max-age=0;`;
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    // Fonction pour connecter l'utilisateur et enregistrer son jeton
    const login = async (token: string) => {
        localStorage.setItem('token', token);
        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
        try {
            // Récupère les infos utilisateur après la connexion réussie
            const response = await api.get('/auth/user/');
            setUser(response.data);
        } catch (error: any) {
            console.error("Login fetch user failed:", error.message);
        }
    };

    // Fonction pour déconnecter l'utilisateur
    const logout = async () => {
        try {
            // Informe le serveur de la déconnexion
            await api.post('/auth/logout/');
        } catch (error: any) {
            console.error("Logout failed:", error.message);
        }
        // Supprime les données de connexion locales
        localStorage.removeItem('token');
        document.cookie = `token=; path=/; max-age=0;`;
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook personnalisé pour utiliser l'authentification facilement dans les composants
export const useAuth = () => useContext(AuthContext);
