import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Tout sauf les fichiers statiques, les images optimisées et le favicon.
   *
   * La route de génération PDF est délibérément INCLUSE : un document ne doit
   * pas pouvoir être produit sans session.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|woff2)$).*)'],
};
