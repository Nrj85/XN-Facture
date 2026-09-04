'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthCard } from '@/components/auth/auth-card';
import { signIn } from '@/lib/actions/auth';

export function SignInForm() {
  const router = useRouter();
  // Destination mémorisée par le middleware : après connexion on revient là où
  // l'utilisateur allait, plutôt que systématiquement au tableau de bord.
  const next = useSearchParams().get('suite');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    startTransition(async () => {
      const result = await signIn(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(next && next.startsWith('/') ? next : '/dashboard');
      router.refresh();
    });
  }

  return (
    <AuthCard
      title="Connexion"
      subtitle="Accédez à vos factures, devis et clients."
      error={error}
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link
            href="/inscription"
            className="font-semibold text-brand hover:text-brand-hover hover:underline"
          >
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Adresse email" required>
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@entreprise.cm"
            />
          )}
        </Field>

        <Field label="Mot de passe" required>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <Button type="submit" disabled={pending} className="w-full gap-2">
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {pending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </AuthCard>
  );
}
