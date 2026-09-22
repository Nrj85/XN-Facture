import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/sign-in-form';
import { googleSignInEnabled } from '@/lib/auth-providers';

export const metadata: Metadata = { title: 'Connexion' };

export default function ConnexionPage() {
  // Le formulaire lit `?suite=` pour revenir à la page demandée après
  // connexion, et `?motif=` pour expliquer une connexion Google qui n'a pas
  // abouti : `useSearchParams` impose une frontière Suspense.
  //
  // La disponibilité de Google est décidée ICI, côté serveur : `XN_AUTH_GOOGLE`
  // n'a rien à faire dans le navigateur, et le formulaire n'a pas à savoir
  // comment elle se nomme.
  return (
    <Suspense fallback={null}>
      <SignInForm googleEnabled={googleSignInEnabled()} />
    </Suspense>
  );
}
