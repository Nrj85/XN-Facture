import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MfaChallengeForm } from '@/components/auth/mfa-challenge-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Vérification en deux étapes' };

/**
 * Deuxième étape de la connexion, pour les comptes qui ont un second facteur.
 *
 * ⚠️ **CETTE PAGE N'APPELLE PAS `requireSession()`, et ne doit jamais le
 * faire.** C'est ici qu'atterrit une session `aal1` : `requireSession()`
 * redirige justement vers cette page dans ce cas, donc l'appeler produirait une
 * boucle de redirection — l'utilisateur verrait `ERR_TOO_MANY_REDIRECTS` et
 * n'aurait plus aucun moyen d'entrer dans son compte. Le contrôle est fait à la
 * main, plus léger, et volontairement :
 *
 * - pas de session du tout → `/connexion` ;
 * - session déjà `aal2`, ou aucun facteur vérifié → **rien à vérifier**, on
 *   renvoie au tableau de bord plutôt que de demander un code inutile.
 *
 * Le second cas n'est pas théorique : c'est ce qui arrive quand on revient sur
 * cette adresse par l'historique du navigateur après s'être déjà vérifié.
 */
export default async function VerificationPage() {
  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/connexion');

  const facteurVerifie = (auth.user.factors ?? []).some((f) => f.status === 'verified');
  if (!facteurVerifie) redirect('/dashboard');

  const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (niveau?.currentLevel === 'aal2') redirect('/dashboard');

  return <MfaChallengeForm email={auth.user.email ?? ''} />;
}
