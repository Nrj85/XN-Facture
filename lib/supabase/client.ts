'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicConfig } from '@/lib/supabase/config';

/**
 * Client Supabase du navigateur.
 *
 * Son seul usage prévu est l'authentification (connexion, déconnexion, écoute
 * du rafraîchissement de session). **Les données métier ne passent pas par
 * ici** : lectures en Server Components, écritures en Server Actions. C'est ce
 * qui évite d'expédier la moitié de la base vers un téléphone en 3G.
 */
export function createClient() {
  const { url, anonKey } = publicConfig();
  return createBrowserClient(url, anonKey);
}
