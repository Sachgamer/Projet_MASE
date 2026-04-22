import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewProvider, useView } from './ViewContext';

// Composant factice pour consommer le contexte (c'est la méthode standard)
const DummyComponent = () => {
  const { currentView, viewParams, setView } = useView();

  return (
    <div>
      <p data-testid="view">{currentView}</p>
      <p data-testid="params">{JSON.stringify(viewParams)}</p>
      <button onClick={() => setView('dashboard', { id: 1 })}>Aller au Dashboard</button>
    </div>
  );
};

describe('ViewContext', () => {
  // JsDom n'implémente pas window.scrollTo, donc on le mocke pour éviter les erreurs
  beforeAll(() => {
    window.scrollTo = jest.fn();
  });

  it('fournit la page "home" par défaut', () => {
    render(
      <ViewProvider>
        <DummyComponent />
      </ViewProvider>
    );
    expect(screen.getByTestId('view')).toHaveTextContent('home');
    expect(screen.getByTestId('params')).toHaveTextContent('{}');
  });

  it('permet de changer de page et de passer des paramètres', () => {
    render(
      <ViewProvider>
        <DummyComponent />
      </ViewProvider>
    );
    
    fireEvent.click(screen.getByRole('button', { name: /aller au dashboard/i }));
    
    expect(screen.getByTestId('view')).toHaveTextContent('dashboard');
    expect(screen.getByTestId('params')).toHaveTextContent('{"id":1}');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0); // Vérifie le scroll
  });

  it('lève une erreur si useView est appelé hors du provider', () => {
    // On masque temporairement les erreurs dans la console provoquées intentionnellement
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<DummyComponent />)).toThrow('useView must be used within a ViewProvider');
    consoleError.mockRestore();
  });
});
