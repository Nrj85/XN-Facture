import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Tout sauf les fichiers statiques, les images optimisées, le favicon — et
   * les routes d'API.
   *
   * **Pourquoi `api/` est exclu.** Le middleware répond aux requêtes sans
   * session par une redirection 307 vers `/connexion`. Une redirection est
   * juste pour une page ; elle est nuisible pour une route d'API, parce que
   * `fetch` la suit sans broncher : le client recevait alors la page de
   * connexion, en HTML, avec `response.ok` à vrai — et enregistrait cette page
   * sous le nom `FAC-2026-0052.pdf`.
   *
   * La protection n'est pas perdue : les deux routes PDF appellent
   * `getSession()` et refusent en **401 JSON**, que le bouton sait afficher.
   * Le contrôle est simplement descendu du middleware vers la route.
   */
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|woff2)$).*)'],
};
