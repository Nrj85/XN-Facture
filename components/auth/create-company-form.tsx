'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthCard } from '@/components/auth/auth-card';
import { createCompany } from '@/lib/actions/auth';

/**
 * Écran de rattrapage : un compte confirmé par email arrive ici sans
 * entreprise, puisqu'il n'y avait pas encore de session au moment de
 * l'inscription. Sans cette page, l'utilisateur serait connecté et incapable
 * de lire ou d'écrire quoi que ce soit — un cul-de-sac silencieux.
 */
export function CreateCompanyForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    startTransition(async () => {
      const result = await createCompany(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    });
  }

  return (
    <AuthCard
      title="Votre entreprise"
      subtitle="Dernière étape : nommez la structure qui émettra les factures."
      error={error}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Nom de l’entreprise"
          required
          hint="Raison sociale, NIU et RCCM se renseignent ensuite dans les paramètres."
        >
          {(props) => (
            <Input
              {...props}
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Atelier Nkolo"
            />
          )}
        </Field>

        <Button type="submit" disabled={pending} className="w-full gap-2">
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {pending ? 'Création…' : 'Continuer'}
        </Button>
      </form>
    </AuthCard>
  );
}
