'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthCard } from '@/components/auth/auth-card';
import { requestPasswordReset } from '@/lib/actions/auth';

/** Motifs renvoyés par le callback quand un lien n'a pas abouti. */
const MOTIFS: Record<string, string> = {
  lien: 'Ce lien a expiré, a déjà servi, ou a été ouvert sur un autre appareil que celui de la demande. Demandez-en un nouveau ci-dessous.',
  incomplet: 'Ce lien est incomplet. Recopiez-le en entier, ou demandez-en un nouveau.',
};

export function ForgotPasswordForm() {
  const motif = useSearchParams().get('motif');

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <AuthCard
        title="Vérifiez vos emails"
        subtitle="Le lien de réinitialisation est en route."
        footer={
          <Link
            href="/connexion"
            className="font-semibold text-brand hover:text-brand-hover hover:underline"
          >
            Retour à la connexion
          </Link>
        }
      >
        <div className="space-y-3">
          <p className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-2">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-status-paid-bg"
              aria-hidden
            >
              <MailCheck className="h-4 w-4 text-status-paid" />
            </span>
            {/* Formulation volontairement conditionnelle : confirmer qu'un
                compte existe permettrait de savoir qui est client. */}
            Si un compte est associé à{' '}
            <strong className="font-semibold text-ink">{email.trim()}</strong>, un message vient
            d’y être envoyé. Ouvrez-le sur cet appareil et suivez le lien.
          </p>
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Rien reçu au bout de quelques minutes ? Regardez dans les indésirables, puis
            réessayez — le lien n’est valable qu’une heure.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Indiquez votre adresse : nous vous enverrons un lien pour en choisir un nouveau."
      error={error ?? (motif ? MOTIFS[motif] ?? MOTIFS.lien : undefined)}
      footer={
        <>
          Vous vous en souvenez ?{' '}
          <Link
            href="/connexion"
            className="font-semibold text-brand hover:text-brand-hover hover:underline"
          >
            Se connecter
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
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@entreprise.cm"
            />
          )}
        </Field>

        <Button type="submit" disabled={pending} className="w-full gap-2">
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {pending ? 'Envoi…' : 'Envoyer le lien'}
        </Button>
      </form>
    </AuthCard>
  );
}
