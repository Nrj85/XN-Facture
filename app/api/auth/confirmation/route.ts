import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Point de retour des liens envoyés par email (réinitialisation de mot de
 * passe, confirmation d'adresse).
 *
 * **Pourquoi sous `/api/`.** Le middleware exclut ce préfixe. Ailleurs, il
 * renverrait cette route vers `/connexion` avant même qu'elle s'exécute :
 * l'utilisateur qui arrive ici n'a précisément pas encore de session, c'est
 * tout l'objet de la route que de lui en ouvrir une à partir du jeton.
 *
 * **Deux formes de jeton sont acceptées**, parce que le lien dépend de la
 * configuration du projet et du gabarit d'email :
 *
 * - `?code=` — flux PKCE, celui de `@supabase/ssr` par défaut. Le vérificateur
 *   est un cookie posé lors de la demande, donc **le lien doit être ouvert
 *   dans le navigateur qui a fait la demande**. Ouvrir l'email sur un autre
 *   appareil échoue : c'est une limite du flux, pas un bug, et le message le
 *   dit.
 * - `?token_hash=&type=` — gabarit d'email utilisant `{{ .TokenHash }}`.
 *   Fonctionne depuis n'importe quel appareil.
 *
 * En cas d'échec on repart vers le formulaire de demande avec un motif, jamais
 * vers une page blanche : un lien mort sans explication est un cul-de-sac.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  // `suite` vient de nous, mais transite par Supabase : on n'accepte qu'un
  // chemin interne, sinon le lien deviendrait une redirection ouverte.
  const requested = url.searchParams.get('suite') ?? '/nouveau-mot-de-passe';
  const suite = requested.startsWith('/') && !requested.startsWith('//')
    ? requested
    : '/nouveau-mot-de-passe';

  const echec = (motif: string) =>
    NextResponse.redirect(new URL(`/mot-de-passe-oublie?motif=${motif}`, url.origin));

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return echec('lien');
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return echec('lien');
  } else {
    return echec('incomplet');
  }

  return NextResponse.redirect(new URL(suite, url.origin));
}
