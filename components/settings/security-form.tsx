'use client';

import { useState, useTransition } from 'react';
import { Check, KeyRound, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { updateEmailAction, updatePasswordAction } from '@/lib/actions/account';
import { useT } from '@/lib/i18n/context';

/**
 * Adresse de connexion et mot de passe.
 *
 * **Ni l'un ni l'autre n'était modifiable.** L'adresse était figée à
 * l'inscription, et le mot de passe ne se changeait que par le parcours
 * « mot de passe oublié » — c'est-à-dire en se déconnectant et en attendant un
 * email, pour une opération qu'on veut faire depuis son compte.
 *
 * ⚠️ **Carte distincte des préférences personnelles, et volontairement.** Le
 * nom et la langue sont du confort ; ceci touche à l'accès au compte. Les
 * mêler aurait mis un champ de mot de passe à côté d'un sélecteur de langue.
 *
 * ⚠️ **Les deux formulaires ont chacun leur état.** Un message de succès sur le
 * mot de passe ne doit pas s'effacer parce qu'on tape une adresse, et une
 * erreur d'adresse ne doit pas s'afficher sous le mot de passe.
 */
export function SecurityForm({ currentEmail }: { currentEmail: string }) {
  const t = useT();

  const [email, setEmail] = useState('');
  const [emailEnCours, startEmail] = useTransition();
  const [erreurEmail, setErreurEmail] = useState<string | null>(null);
  const [emailEnvoye, setEmailEnvoye] = useState(false);

  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mdpEnCours, startMdp] = useTransition();
  const [erreurMdp, setErreurMdp] = useState<string | null>(null);
  const [mdpChange, setMdpChange] = useState(false);

  function soumettreEmail(event: React.FormEvent) {
    event.preventDefault();
    setErreurEmail(null);
    setEmailEnvoye(false);
    startEmail(async () => {
      const result = await updateEmailAction(email);
      if (!result.ok) {
        setErreurEmail(result.error);
        return;
      }
      setEmailEnvoye(true);
      setEmail('');
    });
  }

  function soumettreMdp(event: React.FormEvent) {
    event.preventDefault();
    setErreurMdp(null);
    setMdpChange(false);

    // Contrôlé ici parce que le serveur ne reçoit jamais la confirmation :
    // lui envoyer un troisième mot de passe n'apporterait rien.
    if (nouveau !== confirmation) {
      setErreurMdp(t.settings.passwordMismatch);
      return;
    }

    startMdp(async () => {
      const result = await updatePasswordAction(actuel, nouveau);
      if (!result.ok) {
        setErreurMdp(result.error);
        return;
      }
      setMdpChange(true);
      // Les trois champs sont vidés : laisser un mot de passe en clair dans un
      // formulaire après coup n'a aucune raison d'être.
      setActuel('');
      setNouveau('');
      setConfirmation('');
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand-hover"
            aria-hidden
          >
            <KeyRound className="h-4 w-4" strokeWidth={1.9} />
          </span>
          <div>
            <CardTitle>{t.settings.securityTitle}</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">{t.settings.securityHint}</p>
          </div>
        </div>
      </CardHeader>

      <div className="space-y-5 p-4 sm:p-5">
        <form onSubmit={soumettreEmail} noValidate className="space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Mail className="h-4 w-4 text-ink-3" aria-hidden />
            {t.settings.emailLabel}
          </div>

          <p className="text-[12.5px] text-ink-2">{t.settings.emailCurrent(currentEmail)}</p>

          <div className="max-w-[420px]">
            <Field
              label={t.settings.emailLabel}
              error={erreurEmail ?? undefined}
              hint={t.settings.emailHint}
            >
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  autoComplete="email"
                  value={email}
                  placeholder="vous@entreprise.cm"
                  invalid={Boolean(erreurEmail)}
                  disabled={emailEnCours}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErreurEmail(null);
                    setEmailEnvoye(false);
                  }}
                />
              )}
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={!email.trim() || emailEnCours}>
              {emailEnCours && (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {emailEnCours ? t.settings.languageSaving : t.settings.emailAction}
            </Button>
            {emailEnvoye && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                <Check className="h-4 w-4 text-status-paid-dot" aria-hidden />
                {t.settings.emailSent}
              </span>
            )}
          </div>
        </form>

        <form onSubmit={soumettreMdp} noValidate className="space-y-3 border-t border-line pt-5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <KeyRound className="h-4 w-4 text-ink-3" aria-hidden />
            {t.settings.passwordLabel}
          </div>

          <div className="grid max-w-[640px] gap-4 sm:grid-cols-2">
            <Field
              label={t.settings.currentPassword}
              required
              hint={t.settings.currentPasswordHint}
              className="sm:col-span-2"
            >
              {(props) => (
                <PasswordInput
                  {...props}
                  revealLabel={t.settings.passwordReveal}
                  hideLabel={t.settings.passwordHide}
                  autoComplete="current-password"
                  value={actuel}
                  disabled={mdpEnCours}
                  onChange={(event) => {
                    setActuel(event.target.value);
                    setErreurMdp(null);
                    setMdpChange(false);
                  }}
                />
              )}
            </Field>

            <Field label={t.settings.newPassword} required hint={t.settings.newPasswordHint}>
              {(props) => (
                <PasswordInput
                  {...props}
                  revealLabel={t.settings.passwordReveal}
                  hideLabel={t.settings.passwordHide}
                  autoComplete="new-password"
                  minLength={8}
                  value={nouveau}
                  disabled={mdpEnCours}
                  onChange={(event) => {
                    setNouveau(event.target.value);
                    setErreurMdp(null);
                    setMdpChange(false);
                  }}
                />
              )}
            </Field>

            <Field label={t.settings.confirmPassword} required>
              {(props) => (
                <PasswordInput
                  {...props}
                  revealLabel={t.settings.passwordReveal}
                  hideLabel={t.settings.passwordHide}
                  autoComplete="new-password"
                  value={confirmation}
                  invalid={confirmation.length > 0 && confirmation !== nouveau}
                  disabled={mdpEnCours}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    setErreurMdp(null);
                    setMdpChange(false);
                  }}
                />
              )}
            </Field>
          </div>

          {erreurMdp && (
            <p role="alert" className="text-[12.5px] font-medium text-status-overdue">
              {erreurMdp}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={!actuel || !nouveau || !confirmation || mdpEnCours}
            >
              {mdpEnCours && (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {mdpEnCours ? t.settings.languageSaving : t.settings.passwordAction}
            </Button>
            {mdpChange && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                <Check className="h-4 w-4 text-status-paid-dot" aria-hidden />
                {t.settings.passwordSaved}
              </span>
            )}
            <span className="sr-only" role="status">
              {mdpChange ? t.settings.passwordSaved : ''}
            </span>
          </div>
        </form>
      </div>
    </Card>
  );
}
