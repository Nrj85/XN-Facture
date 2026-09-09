'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { updateDisplayNameAction } from '@/lib/actions/account';
import { setLocaleAction } from '@/lib/actions/locale';
import { useT } from '@/lib/i18n/context';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/i18n/locale';

/**
 * Préférences de la PERSONNE : son nom, sa langue.
 *
 * **Séparé du formulaire d'entreprise, et volontairement.** Les autres réglages
 * de cette page appartiennent à la société et sont partagés par toute l'équipe ;
 * ceux-ci n'appartiennent qu'à la personne au clavier. Les mélanger aurait laissé
 * croire qu'on renomme ses collègues ou qu'on change leur langue.
 *
 * ⚠️ **Les deux champs ne s'enregistrent pas de la même façon, et c'est voulu.**
 * La langue s'applique au choix : un réglage à une seule valeur, réversible d'un
 * clic, dont le résultat est immédiatement visible — la meilleure confirmation
 * possible. Un nom, lui, se tape lettre par lettre : l'enregistrer à chaque
 * frappe écrirait une fois par caractère et afficherait « Jea » dans la barre
 * latérale. Il lui faut donc un bouton.
 */
export function PersonalForm({ current, fullName }: { current: Locale; fullName: string }) {
  const t = useT();
  const router = useRouter();

  const [langueEnCours, startLangue] = useTransition();
  const [erreurLangue, setErreurLangue] = useState<string | null>(null);

  const [nom, setNom] = useState(fullName);
  const [nomEnCours, startNom] = useTransition();
  const [erreurNom, setErreurNom] = useState<string | null>(null);
  const [nomEnregistre, setNomEnregistre] = useState(false);

  const options = LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }));

  // `fullName` est le nom réellement enregistré, pas `displayName` : ce dernier
  // retombe sur l'email, et le bouton se serait cru « à jour » alors que le
  // compte n'a aucun nom.
  const modifie = nom.trim() !== fullName.trim();

  function choisir(valeur: string) {
    if (valeur === current) return;
    setErreurLangue(null);
    startLangue(async () => {
      const result = await setLocaleAction(valeur);
      if (!result.ok) {
        setErreurLangue(result.error);
        return;
      }
      // La coquille entière est rendue côté serveur à partir du cookie :
      // il faut redemander la page pour que la nouvelle langue s'applique.
      router.refresh();
    });
  }

  function enregistrerNom(event: React.FormEvent) {
    event.preventDefault();
    const propre = nom.trim();
    if (!propre) {
      setErreurNom(t.settings.nameRequired);
      return;
    }
    setErreurNom(null);
    setNomEnregistre(false);
    startNom(async () => {
      const result = await updateDisplayNameAction(propre);
      if (!result.ok) {
        setErreurNom(result.error);
        return;
      }
      setNom(propre);
      setNomEnregistre(true);
      // Le nom vit dans la barre latérale et dans le « Bonjour … » du tableau
      // de bord, tous deux rendus côté serveur : sans ce rafraîchissement, le
      // champ afficherait le nouveau nom et le reste de l'écran l'ancien.
      router.refresh();
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
            <Languages className="h-4 w-4" strokeWidth={1.9} />
          </span>
          <div>
            <CardTitle>{t.settings.languageTitle}</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">{t.settings.languageHint}</p>
          </div>
        </div>
      </CardHeader>

      <div className="space-y-5 p-4 sm:p-5">
        <form onSubmit={enregistrerNom} noValidate className="space-y-3">
          <div className="max-w-[420px]">
            <Field
              label={t.settings.yourName}
              required
              error={erreurNom ?? undefined}
              hint={t.settings.yourNameHint}
            >
              {(props) => (
                <Input
                  {...props}
                  value={nom}
                  autoComplete="name"
                  maxLength={80}
                  placeholder={t.settings.yourNamePlaceholder}
                  invalid={Boolean(erreurNom)}
                  disabled={nomEnCours}
                  onChange={(event) => {
                    setNom(event.target.value);
                    setErreurNom(null);
                    setNomEnregistre(false);
                  }}
                />
              )}
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={!modifie || nomEnCours}>
              {nomEnCours && (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {nomEnCours ? t.settings.languageSaving : t.common.save}
            </Button>
            {/* Sans confirmation, on ne sait pas distinguer « enregistré » de
                « le bouton n'a rien fait » — le champ, lui, n'a pas changé. */}
            {nomEnregistre && !modifie && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                <Check className="h-4 w-4 text-status-paid-dot" aria-hidden />
                {t.settings.nameSaved}
              </span>
            )}
            <span className="sr-only" role="status">
              {nomEnCours ? t.settings.languageSaving : nomEnregistre ? t.settings.nameSaved : ''}
            </span>
          </div>
        </form>

        <div className="border-t border-line pt-5">
          <div className="max-w-[280px]">
            <label htmlFor="langue" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              {t.settings.language}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Combobox
                  id="langue"
                  value={current}
                  onChange={choisir}
                  options={options}
                  disabled={langueEnCours}
                />
              </div>
              {langueEnCours ? (
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <Check className="h-4 w-4 shrink-0 text-status-paid-dot" aria-hidden />
              )}
              <span className="sr-only" role="status">
                {langueEnCours ? t.settings.languageSaving : t.settings.languageSaved}
              </span>
            </div>
          </div>

          {erreurLangue && (
            <p role="alert" className="mt-3 text-[12.5px] font-medium text-status-overdue">
              {erreurLangue}
            </p>
          )}

          {/* Dire pourquoi les documents ne suivent pas évite la question
              « pourquoi ma facture est-elle encore en français ? ». */}
          <p className="mt-3 max-w-[62ch] text-[12px] leading-relaxed text-ink-3">
            {t.settings.languageWhyFrench}
          </p>
        </div>
      </div>
    </Card>
  );
}
