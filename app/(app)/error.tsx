'use client';

import { ErrorScreen } from '@/components/layout/error-screen';

/**
 * Frontière d'erreur de l'APPLICATION.
 *
 * Elle couvre `/dashboard`, `/factures`, `/devis`, `/clients`, `/parametres`,
 * `/abonnement` — et les Server Actions que ces écrans déclenchent. La
 * coquille (barre latérale, en-tête) reste en place autour : seule la zone de
 * contenu est remplacée, donc on peut repartir ailleurs sans recharger.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen error={error} reset={reset} contexte="Votre espace" />;
}
