'use client';

import { ErrorScreen } from '@/components/layout/error-screen';

/**
 * Frontière d'erreur des écrans d'AUTHENTIFICATION.
 *
 * ⚠️ **C'EST LA PLUS IMPORTANTE DES QUATRE.** `signOut()` se termine par
 * `redirect('/connexion')` : une panne qui survient là laissait l'utilisateur
 * dehors, sur une page anglaise, **sans session et sans moyen de revenir**.
 * Le groupe couvre aussi `/inscription`, `/bienvenue`, `/mot-de-passe-oublie`,
 * `/nouveau-mot-de-passe`, `/desabonnement` et `/verification` — tous des
 * écrans où l'on est, par construction, déjà en difficulté.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen error={error} reset={reset} contexte="Connexion" />;
}
