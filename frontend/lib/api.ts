import axios from 'axios';

// Détermine l'URL de base du serveur selon si on est en local ou sur le réseau
export const getBaseURL = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const port = '8000'; // Port par défaut de l'API Django
        const protocol = window.location.protocol;
        
        // Gère les adresses locales et IPs courantes
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
            return `http://${hostname}:${port}`;
        }
        return `${protocol}//${hostname}:${port}`;
    }
    return '';
};

// Instance de communication (Axios) configurée pour l'API
const api = axios.create({
    baseURL: getBaseURL(),
    headers: {
        'Content-Type': 'application/json',
    },
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
export const uploadFile = (formData: FormData) => api.post('/api/files/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});

export const getReports = () => api.get('/api/reports/');
export const createReport = (data: FormData) => api.post('/api/reports/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
});

export const createChoice = (data: any) => api.post('/api/choices/', data);
export const deleteReport = (id: number) => api.delete(`/api/reports/${id}/`);
export const updateReport = (id: number, data: FormData | any) => {
    const isFormData = data instanceof FormData;
    return api.patch(`/api/reports/${id}/`, data, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
};

export const updateQuiz = (id: number, data: any) => api.patch(`/api/quizzes/${id}/`, data);
export const updateSlideshow = (id: number, data: any) => api.patch(`/api/slideshows/${id}/`, data);
export const deleteSlideshow = (id: number) => api.delete(`/api/slideshows/${id}/`);
export const deleteSlide = (id: number) => api.delete(`/api/slides/${id}/`);
export const deleteQuestion = (id: number) => api.delete(`/api/questions/${id}/`);
export const deleteFile = (id: number) => api.delete(`/api/files/${id}/`);

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

export default api;
