'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthCard } from '@/components/auth/auth-card';
import { ChosenPlan } from '@/components/auth/chosen-plan';
import { createCompany } from '@/lib/actions/auth';
import { type PlanCode } from '@/lib/plans';

/**
 * Écran de rattrapage : un compte confirmé par email arrive ici sans
 * entreprise, puisqu'il n'y avait pas encore de session au moment de
 * l'inscription. Sans cette page, l'utilisateur serait connecté et incapable
 * de lire ou d'écrire quoi que ce soit — un cul-de-sac silencieux.
 */
export function CreateCompanyForm({
  isAdmin = false,
  plan = null,
}: {
  isAdmin?: boolean;
  /** Formule venue de la grille tarifaire, rattrapée par la page. */
  plan?: PlanCode | null;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    startTransition(async () => {
      const result = await createCompany(name, plan);
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
      <ChosenPlan plan={plan} />

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

      {/*
        Un administrateur de plateforme n'a pas forcément d'entreprise : après
        connexion il atterrit ICI, et sans ce lien il n'avait aucun moyen
        d'atteindre son propre espace depuis l'interface — il fallait connaître
        l'URL. Le lien n'apparaît que pour qui y a droit ; pour les autres,
        ce serait un contrôle mort.
      */}
      {isAdmin && (
        <Link
          href="/admin"
          className="mt-5 flex items-start gap-2.5 rounded-[10px] border border-line bg-brand-soft px-4 py-3 text-[12.5px] leading-relaxed text-ink-2 transition-colors duration-150 hover:border-line-strong"
        >
          <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-brand-hover" aria-hidden />
          <span>
            <strong className="font-semibold text-ink">Vous êtes administrateur de plateforme.</strong>{' '}
            Vous pouvez consulter toutes les entreprises sans créer la vôtre —{' '}
            <span className="font-semibold text-brand-hover underline">ouvrir l’espace administrateur</span>.
          </span>
        </Link>
      )}
    </AuthCard>
  );
}
