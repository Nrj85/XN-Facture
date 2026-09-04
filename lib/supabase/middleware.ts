import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isConfigured, publicConfig } from '@/lib/supabase/config';

/**
 * Routes accessibles sans session. Tout le reste exige d'être connecté.
 *
 * `/nouveau-mot-de-passe` y figure alors qu'il suppose une session : sans
 * cela, un lien expiré renverrait vers `/connexion` sans un mot d'explication.
 * La page fait elle-même le contrôle et dit ce qui s'est passé.
 */
const PUBLIC_PATHS = [
  '/connexion',
  '/inscription',
  '/bienvenue',
  '/mot-de-passe-oublie',
  '/nouveau-mot-de-passe',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Rafraîchit la session à chaque requête et protège les routes applicatives.
 *
 * Le point délicat de `@supabase/ssr` : les cookies rafraîchis doivent être
 * posés **sur la réponse effectivement renvoyée**. D'où la réponse recréée
 * après `setAll`, et non une réponse construite une fois pour toutes — sinon
 * la session expire silencieusement au bout d'une heure.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Sans configuration, on laisse passer : c'est `lib/supabase/config.ts` qui
  // produira un message utile, plutôt qu'une redirection en boucle vers une
  // page de connexion elle-même incapable de fonctionner.
  if (!isConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const { url, anonKey } = publicConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser` et non `getSession` : il valide le jeton auprès du serveur
  // d'authentification. `getSession` se contente de lire un cookie, donc son
  // contenu est falsifiable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = '/connexion';
    // On mémorise la destination pour y revenir après connexion : renvoyer
    // systématiquement au tableau de bord ferait perdre le lien suivi.
    target.searchParams.set('suite', pathname);
    return NextResponse.redirect(target);
  }

  if (user && (pathname === '/connexion' || pathname === '/inscription')) {
    const target = request.nextUrl.clone();
    target.pathname = '/dashboard';
    target.search = '';
    return NextResponse.redirect(target);
  }

  return response;
}
