'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthCard } from '@/components/auth/auth-card';
import { ChosenPlan } from '@/components/auth/chosen-plan';
import { GoogleButton } from '@/components/auth/google-button';
import { signUp } from '@/lib/actions/auth';
import { type PlanCode } from '@/lib/plans';

/**
 * ⚠️ **`plan` ne donne aucun droit.** Il dit seulement quelle formule la
 * personne est venue chercher depuis la grille tarifaire. Tout le monde
 * démarre en Découverte ; la formule se gagne par un paiement encaissé, et
 * c'est le webhook qui l'accordera — jamais le navigateur.
 */
export function SignUpForm({
  plan = null,
  googleEnabled = false,
}: {
  plan?: PlanCode | null;
  googleEnabled?: boolean;
}) {
  const router = useRouter();

  // ⚠️ **La formule doit SURVIVRE à l'aller-retour chez Google.** Un compte
  // créé par Google arrive sans entreprise et passe par `/bienvenue` : sans ce
  // paramètre, le choix fait sur la grille tarifaire serait perdu en route, et
  // quelqu'un qui a cliqué « Choisir Pro » se retrouverait en Découverte sans
  // que rien n'en garde trace. C'est le pendant de `requested_plan`, que
  // l'inscription par email dépose dans `user_metadata`.
  const apresGoogle = plan ? `/bienvenue?plan=${plan}` : '/bienvenue';

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    startTransition(async () => {
      const result = await signUp(email, password, fullName, companyName, plan);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Selon la configuration du projet, Supabase exige ou non une
      // confirmation par email. Les deux cas doivent être dits clairement :
      // rediriger vers une page vide serait déroutant.
      if (result.data.needsConfirmation) {
        setConfirmationSent(true);
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    });
  }

  if (confirmationSent) {
    return (
      <AuthCard
        title="Vérifiez vos emails"
        subtitle="Votre compte est créé. Il reste à confirmer votre adresse."
        footer={
          <Link
            href="/connexion"
            className="font-semibold text-brand hover:text-brand-hover hover:underline"
          >
            Retour à la connexion
          </Link>
        }
      >
        <p className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-2">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-status-paid-bg"
            aria-hidden
          >
            <MailCheck className="h-4 w-4 text-status-paid" />
          </span>
          Un message a été envoyé à <strong className="font-semibold text-ink">{email}</strong>.
          Cliquez sur le lien qu’il contient, puis connectez-vous : votre entreprise sera créée
          à ce moment-là.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Créer un compte"
      subtitle="Quelques informations, et vous facturez."
      error={error}
      footer={
        <>
          Vous avez déjà un compte ?{' '}
          <Link
            href="/connexion"
            className="font-semibold text-brand hover:text-brand-hover hover:underline"
          >
            Se connecter
          </Link>
        </>
      }
    >
      <ChosenPlan plan={plan} />

      {/* Même placement que sur /connexion : en tête, parce que c'est le
          chemin le plus court — quatre champs contre un clic. Rien ne
          s'affiche sans `XN_AUTH_GOOGLE` (§6.1). */}
      {googleEnabled && (
        <div className="mb-5 space-y-5">
          <GoogleButton
            suite={apresGoogle}
            label="S’inscrire avec Google"
            onError={setError}
          />

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11.5px] text-ink-3">ou</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Field label="Votre nom" required>
          {(props) => (
            <Input
              {...props}
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jean-Rémy Engou"
            />
          )}
        </Field>

        <Field
          label="Nom de l’entreprise"
          required
          hint="Modifiable ensuite dans les paramètres, avec vos mentions légales."
        >
          {(props) => (
            <Input
              {...props}
              required
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Atelier Nkolo"
            />
          )}
        </Field>

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

        <Field label="Mot de passe" required hint="8 caractères au minimum.">
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <Button type="submit" disabled={pending} className="w-full gap-2">
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {pending ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
    </AuthCard>
  );
}
