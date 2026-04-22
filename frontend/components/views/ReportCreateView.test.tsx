import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportCreateView from '@/components/views/ReportCreateView';
import { createReport } from '@/lib/api';
import { useView } from '@/context/ViewContext';

// Mocks des dépendances
jest.mock('@/lib/api', () => ({
  createReport: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'testuser' } }),
}));

jest.mock('@/context/ViewContext', () => ({
  useView: jest.fn(),
}));

describe('ReportCreateView - Formulaire de remontée', () => {
  const mockSetView = jest.fn();

  beforeEach(() => {
    (useView as jest.Mock).mockReturnValue({ setView: mockSetView });
    jest.clearAllMocks();
  });

  it('renderise correctement le formulaire vide', () => {
    render(<ReportCreateView />);
    expect(screen.getByText(/Remontée d'accident/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Envoyer la remontée/i })).toBeInTheDocument();
  });

  it('affiche une erreur si la date est manquante à la soumission', async () => {
    render(<ReportCreateView />);
    
    // On remplit le lieu et la description mais on oublie la date
    fireEvent.change(screen.getByPlaceholderText(/Lieu de l'incident/i), { target: { value: 'Atelier' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Description/i }), { target: { value: 'Fuite' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Envoyer la remontée/i }));

    expect(await screen.findByText(/Veuillez renseigner la date de l'incident/i)).toBeInTheDocument();
    expect(createReport).not.toHaveBeenCalled(); // L'API ne doit pas être appelée
  });

  it('simule le remplissage intégral et valide l\'envoi multipart (FormData)', async () => {
    (createReport as jest.Mock).mockResolvedValueOnce({}); // L'API simule un succès

    render(<ReportCreateView />);

    // 1. On sélectionne la gravité "Élevée"
    const severitySelect = screen.getByLabelText(/Gravité/i);
    fireEvent.change(severitySelect, { target: { value: 'high' } });

    // 2. On remplit le texte
    const locationInput = screen.getByPlaceholderText(/Lieu de l'incident/i);
    fireEvent.change(locationInput, { target: { value: 'Usine Nord, Bâtiment B' } });

    const descInput = screen.getByRole('textbox', { name: /Description/i });
    fireEvent.change(descInput, { target: { value: "Chariot élévateur renversé." } });

    // 3. On remplit la date
    // Attention: l'input type datetime-local attend un format "YYYY-MM-DDTHH:mm"
    const dateInput = screen.getByLabelText(/Date & Heure/i);
    fireEvent.change(dateInput, { target: { value: '2023-11-20T14:30' } });

    // 4. On simule l'ajout d'une image
    const fileInput = document.getElementById('media-upload') as HTMLInputElement;
    const testImage = new File(['hello'], 'accident.jpg', { type: 'image/jpeg' });
    
    // jsdom utilise fireEvent.change pour les fichiers
    fireEvent.change(fileInput, { target: { files: [testImage] } });

    // Vérifie que le nom du fichier est bien apparu sur l'écran
    expect(screen.getByText('accident.jpg')).toBeInTheDocument();

    // 5. On soumet le formulaire
    fireEvent.click(screen.getByRole('button', { name: /Envoyer la remontée/i }));

    // 6. On vérifie que la requête partie au serveur contient les bonnes infos
    await waitFor(() => {
      expect(createReport).toHaveBeenCalledTimes(1);
    });

    // On inspecte l'objet FormData envoyé
    const formDataSent = (createReport as jest.Mock).mock.calls[0][0];
    
    expect(formDataSent.get('severity')).toBe('high');
    expect(formDataSent.get('location')).toBe('Usine Nord, Bâtiment B');
    expect(formDataSent.get('description')).toBe('Chariot élévateur renversé.');
    expect(formDataSent.get('image').name).toBe('accident.jpg');
    
    // Le composant convertit la date locale en format ISO pour l'API
    const dateSent = new Date('2023-11-20T14:30');
    expect(formDataSent.get('incident_date')).toBe(dateSent.toISOString());

    // 7. On vérifie la redirection vers la liste des rapports
    expect(mockSetView).toHaveBeenCalledWith('report-list');
  });

  it('bloque les fichiers de plus de 200 Mo', async () => {
    render(<ReportCreateView />);
    
    const fileInput = document.getElementById('media-upload') as HTMLInputElement;
    // On crée un faux fichier en surchargeant sa propriété 'size' pour simuler un fichier géant
    const hugeFile = new File([''], 'huge.mp4', { type: 'video/mp4' });
    Object.defineProperty(hugeFile, 'size', { value: 250 * 1024 * 1024 }); // 250Mo

    fireEvent.change(fileInput, { target: { files: [hugeFile] } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer la remontée/i }));

    expect(await screen.findByText(/Fichier trop volumineux/i)).toBeInTheDocument();
    expect(createReport).not.toHaveBeenCalled();
  });
});
