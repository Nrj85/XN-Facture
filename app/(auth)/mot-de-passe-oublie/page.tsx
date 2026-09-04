import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function MotDePasseOubliePage() {
  // Le formulaire lit `?motif=` pour expliquer un lien qui n'a pas abouti :
  // `useSearchParams` impose une frontière Suspense.
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
