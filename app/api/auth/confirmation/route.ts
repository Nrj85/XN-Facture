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
 * **Elle sert aussi au retour de Google**, qui emploie le même `?code=` PKCE :
 * un second échangeur de code aurait fini par diverger de celui-ci. Seule la
 * destination d'échec change, portée par `?retour=` — renvoyer quelqu'un qui
 * se connecte avec Google vers « mot de passe oublié » n'aurait aucun sens,
 * il n'a jamais eu de mot de passe chez nous.
 *
 * En cas d'échec on repart vers le formulaire de demande avec un motif, jamais
 * vers une page blanche : un lien mort sans explication est un cul-de-sac.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  // `suite` et `retour` viennent de nous, mais transitent par Supabase (et par
  // Google) : on n'accepte qu'un chemin interne, sinon le lien deviendrait une
  // redirection ouverte. `//exemple.com` est une URL absolue déguisée.
  const interne = (valeur: string | null, defaut: string): string =>
    valeur && valeur.startsWith('/') && !valeur.startsWith('//') ? valeur : defaut;

  const suite = interne(url.searchParams.get('suite'), '/nouveau-mot-de-passe');
  // Le chemin seul : un `?` déjà présent casserait le `?motif=` ajouté plus bas.
  const retour = new URL(interne(url.searchParams.get('retour'), '/mot-de-passe-oublie'), url.origin)
    .pathname;

  const echec = (motif: string) =>
    NextResponse.redirect(new URL(`${retour}?motif=${motif}`, url.origin));

  // Retour d'un fournisseur externe qui n'a pas abouti. Il arrive AVANT tout le
  // reste : sans ce cas, un refus de Google tomberait sur « lien incomplet »,
  // qui parle d'un lien d'email que l'utilisateur n'a jamais reçu.
  const refus = url.searchParams.get('error');
  if (refus) {
    // Fermer l'écran de Google, ou refuser l'autorisation, est une décision —
    // pas une panne. On repose l'utilisateur là d'où il vient, sans bandeau
    // rouge qui lui reprocherait son propre choix.
    if (refus === 'access_denied') {
      return NextResponse.redirect(new URL(retour, url.origin));
    }
    return echec('fournisseur');
  }

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
