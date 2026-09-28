'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthCard } from '@/components/auth/auth-card';
import { signOut } from '@/lib/actions/auth';
import { verifyTotpChallenge } from '@/lib/actions/mfa';

/**
 * Second facteur : le code à six chiffres, après le mot de passe.
 *
 * ⚠️ **LE CHAMP EST EN `inputMode="numeric"` AVEC `autoComplete="one-time-code"`,
 * et les deux comptent.** Le premier fait surgir le pavé numérique sur
 * téléphone, où six chiffres se tapent au clavier alphabétique sinon. Le second
 * laisse iOS et Android proposer le code directement — sur l'appareil qui
 * l'affiche, la saisie devient un seul geste. Le téléphone est l'appareil
 * principal de ce produit : cette différence n'est pas un détail de confort.
 *
 * ⚠️ **LA SOUMISSION EST AUTOMATIQUE AU SIXIÈME CHIFFRE.** Un code TOTP a une
 * longueur connue : demander un clic de plus n'apporte rien et fait expirer des
 * codes pendant que la personne cherche le bouton. Le bouton reste là pour le
 * clavier et les lecteurs d'écran.
 *
 * ⚠️ **LE CHAMP SE VIDE À CHAQUE REFUS.** Sans cela, il faudrait effacer six
 * chiffres à la main avant de retenter, et le code suivant s'ajouterait à la
 * suite du précédent — refusé pour une raison que rien n'explique.
 *
 * ⚠️ **« Se déconnecter » EST LA SEULE AUTRE SORTIE, et elle doit exister.**
 * Sans elle, quelqu'un qui n'a pas son téléphone reste sur cet écran, connecté à
 * moitié, sans rien pouvoir faire — pas même se connecter avec un autre compte.
 */
export function MfaChallengeForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const champ = useRef<HTMLInputElement>(null);
  // Garde contre une double soumission : la bascule automatique et un clic
  // peuvent partir presque ensemble, et deux vérifications du même code font
  // refuser la seconde.
  const envoye = useRef(false);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  function valider(valeur: string) {
    if (envoye.current) return;
    envoye.current = true;
    setError(undefined);

    startTransition(async () => {
      const result = await verifyTotpChallenge(valeur);
      envoye.current = false;

      if (!result.ok) {
        setError(result.error);
        setCode('');
        champ.current?.focus();
        return;
      }
      // `refresh()` fait relire la session au serveur, désormais en `aal2` :
      // sans lui, la redirection reviendrait ici, la garde n'ayant pas vu le
      // nouveau niveau.
      router.refresh();
      router.replace('/dashboard');
    });
  }

  function changer(valeur: string) {
    const chiffres = valeur.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(chiffres);
    if (chiffres.length === 6) valider(chiffres);
  }

  return (
    <AuthCard
      title="Vérification en deux étapes"
      subtitle={`Saisissez le code affiché par votre application d’authentification pour ${email}.`}
      error={error}
      footer={
        <form action={signOut}>
          <button
            type="submit"
            className="font-semibold text-brand transition-colors duration-150 hover:text-brand-hover hover:underline"
          >
            Se déconnecter
          </button>
        </form>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          valider(code);
        }}
        className="space-y-4"
      >
        <p className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-2">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-status-paid-bg"
            aria-hidden
          >
            <ShieldCheck className="h-4 w-4 text-status-paid" />
          </span>
          Votre mot de passe seul ne suffit pas à ouvrir ce compte. Ce code change toutes les
          trente secondes.
        </p>

        <Field label="Code à six chiffres">
          {(props) => (
            <Input
              {...props}
              ref={champ}
              name="code"
              value={code}
              onChange={(event) => changer(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={6}
              placeholder="000000"
              disabled={pending}
              className="tabular text-center text-[20px] tracking-[0.3em]"
            />
          )}
        </Field>

        <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {pending ? 'Vérification…' : 'Valider'}
        </Button>

        <p className="text-[12.5px] leading-relaxed text-ink-3">
          Téléphone perdu ou application effacée ? Écrivez-nous : seul un administrateur peut
          retirer la double authentification d’un compte.
        </p>
      </form>
    </AuthCard>
  );
}
