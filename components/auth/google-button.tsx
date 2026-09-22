'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/actions/auth';

/**
 * Le « G » officiel de Google.
 *
 * ⚠️ **Les couleurs sont en dur, et c'est la seule exception admise au §6.2.**
 * Ce ne sont pas des couleurs de produit mais une marque déposée : les
 * conditions d'usage de Google interdisent d'en changer la teinte, et les
 * plier à nos jetons chauds donnerait un logo faux. Aucune autre valeur de
 * cette page n'échappe au thème.
 *
 * lucide-react ne fournit plus les logos de marque — d'où ce tracé en ligne
 * plutôt qu'une dépendance ou une image chargée depuis un serveur de Google,
 * qui coûterait une requête réseau sur la page la plus sensible au temps de
 * chargement après la landing.
 */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3a7.2 7.2 0 0 1-4.07 1.16 7.14 7.14 0 0 1-6.71-4.94H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.31a7.19 7.19 0 0 1 0-4.6v-3.1H1.29a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1A7.14 7.14 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Connexion par compte Google.
 *
 * ⚠️ **L'erreur remonte au parent (`onError`) au lieu de s'afficher ici.**
 * `AuthCard` porte déjà un bandeau `role="alert"` en tête de carte ; un second
 * message sous le bouton aurait pu s'afficher en même temps que le premier, et
 * un lecteur d'écran aurait annoncé deux échecs pour une seule tentative.
 *
 * ⚠️ **La navigation passe par `window.location`, pas par `router.push`.** La
 * destination est chez Google : le routeur de Next ne sort pas de
 * l'application, et un `push` vers une URL externe ne mènerait nulle part.
 *
 * L'état « en cours » ne retombe jamais — c'est voulu. À ce moment la page est
 * en train de partir ; réactiver le bouton inviterait à cliquer une seconde
 * fois pendant que la première navigation est en vol.
 */
export function GoogleButton({
  suite,
  label = 'Continuer avec Google',
  onError,
}: {
  /** Destination applicative après connexion, mémorisée par le middleware. */
  suite?: string | null;
  label?: string;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function connecter() {
    startTransition(async () => {
      const result = await signInWithGoogle(suite ?? null);
      if (!result.ok) {
        onError(result.error);
        return;
      }
      window.location.assign(result.data.url);
    });
  }

  return (
    <Button
      variant="secondary"
      onClick={connecter}
      disabled={pending}
      className="w-full gap-2.5"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <LogoGoogle />
      )}
      {pending ? 'Ouverture de Google…' : label}
    </Button>
  );
}
