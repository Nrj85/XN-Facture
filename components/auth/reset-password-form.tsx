'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthCard } from '@/components/auth/auth-card';
import { updatePassword } from '@/lib/actions/auth';

/**
 * Choix du nouveau mot de passe, au retour du lien reçu par email.
 *
 * `hasSession` est déterminé côté serveur par la page : sans session, le lien
 * n'a pas abouti et il n'y a rien à saisir. Afficher quand même le formulaire
 * ferait perdre une saisie pour un refus certain.
 *
 * La confirmation n'est pas une décoration : une faute de frappe dans un champ
 * masqué, sur un mot de passe qu'on vient tout juste d'inventer, enferme
 * l'utilisateur dehors une seconde fois.
 */
export function ResetPasswordForm({ hasSession, email }: { hasSession: boolean; email?: string }) {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const mismatch = confirmation.length > 0 && confirmation !== password;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    if (password !== confirmation) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }

    startTransition(async () => {
      const result = await updatePassword(password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Le mot de passe est changé ET la session est déjà ouverte : envoyer
      // l'utilisateur se reconnecter serait une étape gratuite.
      router.replace('/dashboard');
      router.refresh();
    });
  }

  if (!hasSession) {
    return (
      <AuthCard
        title="Lien expiré"
        subtitle="Ce lien de réinitialisation n’est plus valable."
        footer={
          <Link
            href="/connexion"
            className="font-semibold text-brand hover:text-brand-hover hover:underline"
          >
            Retour à la connexion
          </Link>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-ink-2">
            Un lien de réinitialisation ne sert qu’une fois, expire au bout d’une heure, et doit
            être ouvert sur l’appareil depuis lequel il a été demandé.
          </p>
          <Link href="/mot-de-passe-oublie" className="block">
            <Button className="w-full">Demander un nouveau lien</Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Nouveau mot de passe"
      subtitle={
        email
          ? `Choisissez le mot de passe du compte ${email}.`
          : 'Choisissez votre nouveau mot de passe.'
      }
      error={error}
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="flex items-start gap-3 text-[12.5px] leading-relaxed text-ink-2">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft"
            aria-hidden
          >
            <KeyRound className="h-4 w-4 text-brand-hover" />
          </span>
          Votre identité est vérifiée. Une fois enregistré, ce mot de passe remplacera
          l’ancien et vous serez connecté.
        </p>

        <Field label="Nouveau mot de passe" required hint="8 caractères au minimum.">
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Confirmer le mot de passe"
          required
          error={mismatch ? 'Les deux saisies diffèrent.' : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="new-password"
              required
              invalid={mismatch}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          )}
        </Field>

        <Button
          type="submit"
          disabled={pending || mismatch || password.length < 8}
          className="w-full gap-2"
        >
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {pending ? 'Enregistrement…' : 'Enregistrer et se connecter'}
        </Button>
      </form>
    </AuthCard>
  );
}
