import type { Metadata } from 'next';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { parsePlan } from '@/lib/plans';

export const metadata: Metadata = { title: 'Créer un compte' };

/**
 * ⚠️ **La formule est lue côté SERVEUR, pas par `useSearchParams`.**
 * Ce crochet aurait imposé un `<Suspense>`, et le formulaire n'aurait plus
 * existé qu'après hydratation — c'est exactement ce qui vide le HTML statique
 * de `/connexion`, consigné dans CLAUDE.md. La page devient dynamique, ce qui
 * est le bon compromis sur un écran d'authentification : le HTML arrive
 * complet, formule affichée comprise.
 *
 * `parsePlan` valide contre la liste des codes connus : `?plan=` vient du
 * visiteur, donc il vaut n'importe quoi jusqu'à preuve du contraire.
 */
export default function InscriptionPage({
  searchParams,
}: {
  searchParams: { plan?: string | string[] };
}) {
  const brut = Array.isArray(searchParams.plan) ? searchParams.plan[0] : searchParams.plan;
  return <SignUpForm plan={parsePlan(brut)} />;
}
