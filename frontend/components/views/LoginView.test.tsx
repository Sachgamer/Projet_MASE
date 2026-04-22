import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginView from '@/components/views/LoginView';
import { useAuth } from '@/context/AuthContext';
import { useView } from '@/context/ViewContext';
import api from '@/lib/api';

// 1. On "mock" (simule) les contextes
jest.mock('@/context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/context/ViewContext', () => ({
    useView: jest.fn(),
}));

// 2. On "mock" l'API (Axios)
jest.mock('@/lib/api', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
    }
}));

describe('LoginView Component', () => {
    const mockLogin = jest.fn();
    const mockSetView = jest.fn();

    beforeEach(() => {
        // Avant chaque test, on configure le comportement de base de nos mocks
        (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
        (useView as jest.Mock).mockReturnValue({ setView: mockSetView });
        jest.clearAllMocks();
    });

    it("renderise le formulaire de connexion classique par défaut", () => {
        render(<LoginView />);
        // Vérifie que les éléments sont bien à l'écran
        expect(screen.getByText('Connectez-vous')).toBeInTheDocument();
        expect(screen.getByLabelText('Identifiant')).toBeInTheDocument();
        expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    });

    it("affiche une erreur si on soumet le formulaire vide", () => {
        render(<LoginView />);
        const submitButton = screen.getByRole('button', { name: /Continuer/i }); // Le bouton "Continuer"
        fireEvent.click(submitButton);

        // Le test passera si cette phrase est affichée à l'écran
        expect(screen.getByText('Entrez un identifiant et un mot de passe.')).toBeInTheDocument();
    });

    it("passe à l'étape 2FA si les identifiants sont corrects (Code 202)", async () => {
        // On simule une réponse de l'API avec un statut 202
        (api.post as jest.Mock).mockResolvedValueOnce({ status: 202 });

        render(<LoginView />);

        // On remplit les champs
        fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 'user1' } });
        fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'password123' } });

        // On clique sur le bouton
        fireEvent.click(screen.getByRole('button', { name: /Continuer/i }));

        // On attend que l'état asynchrone se mette à jour
        await waitFor(() => {
            // Le composant devrait maintenant afficher le titre du 2FA
            expect(screen.getByText('Vérification en deux étapes')).toBeInTheDocument();
        });

        // On vérifie que le message de succès est bien présent
        expect(screen.getByText('Un email contenant votre code de sécurité a été envoyé.')).toBeInTheDocument();
    });
});
