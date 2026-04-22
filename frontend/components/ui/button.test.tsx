import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button component', () => {
  it('renderise le texte enfant correctement', () => {
    render(<Button>Cliquez-moi</Button>);
    expect(screen.getByRole('button', { name: /cliquez-moi/i })).toBeInTheDocument();
  });

  it('applique les classes par défaut (variante default)', () => {
    render(<Button>Défaut</Button>);
    const button = screen.getByRole('button', { name: /défaut/i });
    expect(button).toHaveClass('bg-primary');
  });

  it('applique les classes de variantes spécifiques (destructive)', () => {
    render(<Button variant="destructive">Supprimer</Button>);
    const button = screen.getByRole('button', { name: /supprimer/i });
    expect(button).toHaveClass('bg-destructive');
  });

  it('gère les événements de clic', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Clic</Button>);
    fireEvent.click(screen.getByRole('button', { name: /clic/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('peut être désactivé', () => {
    render(<Button disabled>Désactivé</Button>);
    const button = screen.getByRole('button', { name: /désactivé/i });
    expect(button).toBeDisabled();
  });
});
