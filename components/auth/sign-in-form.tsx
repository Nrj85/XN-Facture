'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { AuthCard } from '@/components/auth/auth-card';
import { GoogleButton } from '@/components/auth/google-button';
import { signIn } from '@/lib/actions/auth';

/**
 * Motifs renvoyés par le callback quand une connexion externe n'a pas abouti.
 *
 * ⚠️ **`access_denied` n'y figure pas, et ne doit pas y figurer.** Fermer
 * l'écran de Google est une décision de l'utilisateur : le callback le repose
 * ici sans motif, et lui reprocher son choix par un bandeau rouge serait une
 * faute de ton. Il est revenu exactement d'où il partait, ce qui se comprend
 * sans commentaire.
 */
const MOTIFS: Record<string, string> = {
  fournisseur:
    'Google n’a pas confirmé votre identité. Réessayez, ou connectez-vous avec votre email et votre mot de passe.',
  lien: 'La connexion n’a pas abouti. Si vous avez commencé dans un autre navigateur, reprenez depuis celui-ci.',
  incomplet: 'La réponse de Google était incomplète. Réessayez.',
};

export function SignInForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  // Destination mémorisée par le middleware : après connexion on revient là où
  // l'utilisateur allait, plutôt que systématiquement au tableau de bord.
  const next = params.get('suite');
  const motif = params.get('motif');

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
      error={error ?? (motif ? MOTIFS[motif] ?? MOTIFS.fournisseur : undefined)}
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
      {/* Au-dessus du formulaire : c'est le chemin le plus court, et le poser
          dessous laisserait croire qu'il s'agit d'une option de repli. Rien ne
          s'affiche tant que `XN_AUTH_GOOGLE` n'est pas posée — un bouton qui
          renverrait « fournisseur non activé » serait le contrôle mort du
          §6.1. */}
      {googleEnabled && (
        <div className="mb-5 space-y-5">
          <GoogleButton suite={next} onError={setError} />

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11.5px] text-ink-3">ou</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      )}

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

        <div className="space-y-1.5">
          <Field label="Mot de passe" required>
            {(props) => (
              <PasswordInput
                {...props}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>

          {/* Contre le champ concerné plutôt qu'en pied de carte : on le
              cherche au moment précis où le mot de passe ne vient pas. */}
          <p className="text-right">
            <Link
              href="/mot-de-passe-oublie"
              className="text-[12.5px] font-medium text-brand transition-colors duration-150 hover:text-brand-hover hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </p>
        </div>

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
