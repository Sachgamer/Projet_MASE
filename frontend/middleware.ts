import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Le middleware gère la redirection automatique des pages vers l'accueil
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Si l'utilisateur tente d'accéder à une route inexistante (pas de fichier, pas d'API, pas NextInternal)
    // On le redirige vers la page d'accueil (SPA mode)
    if (pathname !== '/' && !pathname.startsWith('/_next') && !pathname.includes('.')) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

// Définit sur quelles routes le middleware doit s'appliquer
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
