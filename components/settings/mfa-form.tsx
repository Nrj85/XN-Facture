'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  confirmTotpEnrollment,
  disableTotp,
  startTotpEnrollment,
  type TotpEnrollment,
} from '@/lib/actions/mfa';
import { useT } from '@/lib/i18n/context';

/**
 * Activation de la vérification en deux étapes.
 *
 * ⚠️ **Carte à part, la troisième de cet écran.** Le nom et la langue sont du
 * confort ; l'adresse et le mot de passe touchent à l'accès ; ceci **ajoute un
 * mur**. Le mêler à la carte Sécurité aurait donné un formulaire à cinq champs
 * où l'on ne distingue plus ce qui remplace un identifiant de ce qui en ajoute.
 *
 * ⚠️ **LE QR CODE EST UNE `<img src="data:image/svg+xml,…">`, PAS UN SVG
 * INJECTÉ.** Un `dangerouslySetInnerHTML` aurait été le réflexe pour un SVG
 * rendu par Supabase. Le dépôt n'en contient aucun, et **la politique de
 * sécurité du contenu de `next.config.mjs` s'appuie explicitement sur ce fait**
 * pour justifier son `'unsafe-inline'` : en introduire un ici affaiblirait le
 * raisonnement de tout le projet pour économiser un `encodeURIComponent`.
 *
 * ⚠️ **LA CLÉ EN CLAIR EST AFFICHÉE À CÔTÉ DU QR, et c'est nécessaire.** Sur
 * téléphone, l'écran qui montre le QR est souvent celui-là même qui porte
 * l'application d'authentification : on ne peut pas se scanner soi-même. Sans la
 * clé, la fonction serait inutilisable pour qui n'a qu'un appareil — c'est-à-dire
 * l'essentiel de nos utilisateurs.
 *
 * ⚠️ **AUCUN ÉTAT N'EST DEVINÉ.** `active` vient du serveur, relu à chaque
 * rendu de la page. Un état local aurait pu afficher « activée » après un
 * échec silencieux.
 */
export function MfaForm({ active }: { active: boolean }) {
  const t = useT();

  const [enrolement, setEnrolement] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [codeRetrait, setCodeRetrait] = useState('');
  const [retraitOuvert, setRetraitOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, start] = useTransition();

  function demarrer() {
    setErreur(null);
    setSucces(null);
    start(async () => {
      const result = await startTotpEnrollment();
      if (!result.ok) {
        setErreur(result.error);
        return;
      }
      setEnrolement(result.data);
    });
  }

  function confirmer(event: React.FormEvent) {
    event.preventDefault();
    if (!enrolement) return;
    setErreur(null);
    start(async () => {
      const result = await confirmTotpEnrollment(enrolement.factorId, code);
      if (!result.ok) {
        setErreur(result.error);
        setCode('');
        return;
      }
      setEnrolement(null);
      setCode('');
      setSucces(t.settings.mfaEnabled);
    });
  }

  function retirer(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    start(async () => {
      const result = await disableTotp(codeRetrait);
      if (!result.ok) {
        setErreur(result.error);
        setCodeRetrait('');
        return;
      }
      setRetraitOuvert(false);
      setCodeRetrait('');
      setSucces(t.settings.mfaDisabled);
    });
  }

  const chiffres = (valeur: string) => valeur.replace(/[^0-9]/g, '').slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.mfaTitle}</CardTitle>
      </CardHeader>

      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-[12.5px] leading-relaxed text-ink-2">{t.settings.mfaHint}</p>

        {/* L'état ne passe pas par la couleur seule (§6.7) : une icône, un
            libellé, et un fond distinct le portent ensemble. */}
        <p
          className={
            active
              ? 'flex items-start gap-2.5 rounded-[10px] border border-status-paid-dot bg-status-paid-bg px-3.5 py-2.5 text-[13px] font-medium text-status-paid'
              : 'flex items-start gap-2.5 rounded-[10px] border border-line bg-sand px-3.5 py-2.5 text-[13px] text-ink-2'
          }
        >
          {active ? (
            <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ShieldOff className="mt-px h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          )}
          {active ? t.settings.mfaOn : t.settings.mfaOff}
        </p>

        {erreur && (
          <p role="alert" className="text-[12.5px] font-medium text-status-overdue">
            {erreur}
          </p>
        )}
        {succes && (
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-status-paid">
            <Check className="h-4 w-4" aria-hidden />
            {succes}
          </p>
        )}

        {/* --- Cas 1 : pas encore active, et l'enrôlement n'est pas commencé --- */}
        {!active && !enrolement && (
          <div className="space-y-2">
            <Button type="button" onClick={demarrer} disabled={enCours}>
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t.settings.mfaStart}
            </Button>
            <p className="text-[11.5px] leading-relaxed text-ink-3">{t.settings.mfaApps}</p>
          </div>
        )}

        {/* --- Cas 2 : enrôlement en cours, il reste à prouver le code --- */}
        {enrolement && (
          <form onSubmit={confirmer} className="space-y-4 border-t border-line pt-4">
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-ink">{t.settings.mfaStep1}</p>
              {/* `bg-surface` en dur derrière le QR : un code sombre sur le fond
                  crème reste lisible, mais les lecteurs de QR sont bien plus
                  sûrs sur du blanc franc. */}
              <div className="inline-block rounded-[10px] border border-line bg-surface p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrolement.qrCode}
                  alt={t.settings.mfaStep1}
                  width={168}
                  height={168}
                  className="h-[168px] w-[168px]"
                />
              </div>
            </div>

            <Field label={t.settings.mfaSecretLabel}>
              {(props) => (
                <Input
                  {...props}
                  readOnly
                  value={enrolement.secret}
                  onFocus={(event) => event.currentTarget.select()}
                  className="tabular text-[12.5px]"
                />
              )}
            </Field>

            <Field label={t.settings.mfaCodeLabel} hint={t.settings.mfaStep2}>
              {(props) => (
                <Input
                  {...props}
                  value={code}
                  onChange={(event) => setCode(chiffres(event.target.value))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={6}
                  placeholder="000000"
                  className="tabular tracking-[0.25em]"
                />
              )}
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={enCours || code.length !== 6}>
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {t.settings.mfaConfirm}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={enCours}
                onClick={() => {
                  setEnrolement(null);
                  setCode('');
                  setErreur(null);
                }}
              >
                {t.settings.mfaCancel}
              </Button>
            </div>
          </form>
        )}

        {/* --- Cas 3 : active, on peut la retirer avec un code --- */}
        {active && !retraitOuvert && (
          <Button type="button" variant="secondary" onClick={() => setRetraitOuvert(true)}>
            {t.settings.mfaDisable}
          </Button>
        )}

        {active && retraitOuvert && (
          <form onSubmit={retirer} className="space-y-3 border-t border-line pt-4">
            <Field label={t.settings.mfaCodeLabel} hint={t.settings.mfaDisableHint}>
              {(props) => (
                <Input
                  {...props}
                  value={codeRetrait}
                  onChange={(event) => setCodeRetrait(chiffres(event.target.value))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={6}
                  placeholder="000000"
                  className="tabular tracking-[0.25em]"
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              {/* Pas de ton `danger` : on retire une protection, on ne détruit
                  aucune donnée, et la fonction se réactive d'un clic. */}
              <Button type="submit" variant="secondary" disabled={enCours || codeRetrait.length !== 6}>
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {t.settings.mfaDisable}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={enCours}
                onClick={() => {
                  setRetraitOuvert(false);
                  setCodeRetrait('');
                  setErreur(null);
                }}
              >
                {t.settings.mfaCancel}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
