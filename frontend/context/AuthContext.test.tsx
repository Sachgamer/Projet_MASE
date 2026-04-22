import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import api from '@/lib/api';

// On mock l'API pour ne pas faire de vraies requêtes au backend
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  }
}));

// On mock Next Router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const DummyComponent = () => {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      <p data-testid="user">{user ? user.username : 'Aucun'}</p>
      <button onClick={() => login('fake-token')}>Connexion</button>
      <button onClick={() => logout()}>Déconnexion</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Simulation du comportement du cookie dans JsDom
    Object.defineProperty(window.document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  it('charge sans utilisateur au départ (si pas de token)', async () => {
    render(
      <AuthProvider>
        <DummyComponent />
      </AuthProvider>
    );
    
    // Le contexte charge d'abord (useEffect qui lit le localstorage). On l'attend.
    await waitFor(() => expect(screen.queryByText('Chargement...')).not.toBeInTheDocument());
    expect(screen.getByTestId('user')).toHaveTextContent('Aucun');
  });

  it('récupère l\'utilisateur automatique au montage si un token existe', async () => {
    localStorage.setItem('token', 'real-token');
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { username: 'testuser' } });

    render(
      <AuthProvider>
        <DummyComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.queryByText('Chargement...')).not.toBeInTheDocument());
    expect(api.get).toHaveBeenCalledWith('/auth/user/');
    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });

  it('déconnecte l\'utilisateur avec succès (Logout)', async () => {
    // 1. On donne un user initial
    localStorage.setItem('token', 'real-token');
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { username: 'testuser' } });

    render(
      <AuthProvider>
        <DummyComponent />
      </AuthProvider>
    );

    // Attente du chargement initial
    await waitFor(() => expect(screen.queryByText('Chargement...')).not.toBeInTheDocument());
    expect(screen.getByTestId('user')).toHaveTextContent('testuser');

    // 2. On clique sur Déconnexion
    (api.post as jest.Mock).mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole('button', { name: /déconnexion/i }));

    // 3. On vérifie la logique
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/logout/');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('Aucun');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
