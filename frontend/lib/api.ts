import axios from 'axios';

// Détermine l'URL de base du serveur selon si on est en local ou sur le réseau
export const getBaseURL = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const port = window.location.port;

        // En développement local ou réseau (si le port de l'application est 3000), on contacte Django directement sur le port 8000
        if (hostname === 'localhost' || hostname === '127.0.0.1' || port === '3000') {
            return `http://${hostname}:8000`;
        }

        // En production (IP réseau ou domaine) via Nginx :
        // Les appels /api/ sont proxifiés par Nginx vers Django.
        // On utilise la MÊME origine que la page (sans port fixe) pour éviter
        // le blocage "Mixed Content" quand le site tourne en HTTPS.
        return `${protocol}//${hostname}`;
    }
    return '';
};

// Instance de communication (Axios) configurée pour l'API
const api = axios.create({
    baseURL: getBaseURL(),
});

// Intercepteur : ajoute automatiquement le jeton de sécurité à chaque requête
api.interceptors.request.use(
    (config) => {
        config.baseURL = getBaseURL();
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Token ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Intercepteur : gère les erreurs de connexion (ex: jeton expiré)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Déconnexion automatique si la session est expirée
            localStorage.removeItem('token');
            document.cookie = 'token=; path=/; max-age=0;';
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Fonctions pour simplifier l'envoi de données au serveur (API)
export const getFiles = () => api.get('/api/files/');
export const uploadFile = (formData: FormData) => api.post('/api/files/', formData);

export const getReports = () => api.get('/api/reports/');
export const createReport = (data: FormData) => api.post('/api/reports/', data);

export const getWorkSites = () => api.get('/api/worksites/');
export const createWorkSite = (data: any) => api.post('/api/worksites/', data);

export const createChoice = (data: any) => api.post('/api/choices/', data);
export const deleteReport = (id: number) => api.delete(`/api/reports/${id}/`);
export const updateReport = (id: number, data: FormData | any) => {
    return api.patch(`/api/reports/${id}/`, data);
};

export const updateQuiz = (id: number, data: any) => api.patch(`/api/quizzes/${id}/`, data);
export const updateSlideshow = (id: number, data: any) => api.patch(`/api/slideshows/${id}/`, data);
export const deleteSlideshow = (id: number) => api.delete(`/api/slideshows/${id}/`);
export const deleteSlide = (id: number) => api.delete(`/api/slides/${id}/`);
export const deleteQuestion = (id: number) => api.delete(`/api/questions/${id}/`);
export const deleteFile = (id: number) => api.delete(`/api/files/${id}/`);

// Actions (Plan d'actions)
export const getActions = () => api.get('/api/actions/');
export const createAction = (data: any) => api.post('/api/actions/', data);
export const updateAction = (id: number, data: any) => api.patch(`/api/actions/${id}/`, data);
export const deleteAction = (id: number) => api.delete(`/api/actions/${id}/`);

// Chemical Products (Risques Chimiques)
export const getChemicalProducts = () => api.get('/api/chemical-products/');
export const createChemicalProduct = (formData: FormData) => api.post('/api/chemical-products/', formData);
export const deleteChemicalProduct = (id: number) => api.delete(`/api/chemical-products/${id}/`);

// Habilitations (Certifications & Visites)
export const getHabilitations = (all?: boolean) => api.get(all ? '/api/habilitations/?all=true' : '/api/habilitations/');
export const createHabilitation = (formData: FormData) => api.post('/api/habilitations/', formData);
export const deleteHabilitation = (id: number) => api.delete(`/api/habilitations/${id}/`);

// HSE Statistics
export const getHseStats = () => api.get('/api/hse-stats/');


// Télécharge le PDF du rapport d'auto-contrôle
export const downloadInspectionPdf = async (id: number, filename?: string) => {
    const response = await api.get(`/api/controls/inspections/${id}/generate_pdf/`, {
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Rapport_AutoControle_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

// Télécharge le PDF d'attestation/fiche de validation du quiz
export const downloadQuizPdf = async (id: number, answers: any[], filename?: string, signature?: string) => {
    const response = await api.post(`/api/quizzes/${id}/generate_pdf/`, { answers, signature }, {
        responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Fiche_Quiz_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

// Télécharge le PDF de la remontée d'accident/incident
export const downloadAccidentPdf = async (id: number, filename?: string) => {
    const response = await api.get(`/api/reports/${id}/generate_pdf/`, {
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Rapport_Accident_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

// User Dashboard
export const getUserDashboard = () => api.get('/api/user-dashboard/');

// Agencies
export const getAgencies = () => api.get('/api/agencies/');
export const createAgency = (data: any) => api.post('/api/agencies/', data);

// Users Management (Admin)
export const getUsers = () => api.get('/api/users/');
export const createUser = (data: any) => api.post('/api/users/', data);
export const updateUser = (id: number, data: any) => api.patch(`/api/users/${id}/`, data);
export const deleteUser = (id: number) => api.delete(`/api/users/${id}/`);

// Periodic Visits Registry
export const getPeriodicVisits = () => api.get('/api/periodic-visits/');
export const createPeriodicVisit = (formData: FormData) => api.post('/api/periodic-visits/', formData);
export const deletePeriodicVisit = (id: number) => api.delete(`/api/periodic-visits/${id}/`);

// Prolong dates
export const prolongAction = (id: number) => api.post(`/api/actions/${id}/prolong/`);
export const prolongHabilitation = (id: number) => api.post(`/api/habilitations/${id}/prolong/`);
export const prolongEquipmentItem = (id: number) => api.post(`/api/controls/equipment/${id}/prolong/`);
export const prolongPeriodicVisit = (id: number) => api.post(`/api/periodic-visits/${id}/prolong/`);

export default api;
