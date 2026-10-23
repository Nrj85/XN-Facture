'use client';

import { ErrorScreen } from '@/components/layout/error-screen';

/**
 * Frontière d'erreur de l'ESPACE D'ADMINISTRATION.
 *
 * ⚠️ **SÉPARÉE DE CELLE DE `(app)`, et il le faut** : `/admin` vit dans son
 * propre groupe de routes, avec sa propre coquille — celle de l'application
 * appelle `requireSession()`, qui renvoie vers `/bienvenue` tout compte sans
 * entreprise, or un administrateur de plateforme n'en a pas forcément (§2).
 * Une frontière posée dans `(app)` ne couvrirait donc jamais `/admin`.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen error={error} reset={reset} contexte="Espace administrateur" />;
}
