import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/sign-in-form';

export const metadata: Metadata = { title: 'Connexion' };

export default function ConnexionPage() {
  // Le formulaire lit `?suite=` pour revenir à la page demandée après
  // connexion : `useSearchParams` impose une frontière Suspense.
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
