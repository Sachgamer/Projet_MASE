import { cn } from './utils';

describe('utils cn function', () => {
  it('fusionne correctement les classes CSS basiques', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('gère les classes conditionnelles', () => {
    expect(cn('p-4', true && 'm-4', false && 'hidden')).toBe('p-4 m-4');
  });

  it('fusionne intelligemment en écrasant les conflits tailwind', () => {
    // twMerge doit résoudre le conflit de padding
    expect(cn('p-4 p-8')).toBe('p-8');
    // Le second background doit écraser le premier
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });
});
