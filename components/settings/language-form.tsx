'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Languages, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { setLocaleAction } from '@/lib/actions/locale';
import { useT } from '@/lib/i18n/context';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/i18n/locale';

/**
 * Choix de la langue de l'interface.
 *
 * **Séparé du formulaire d'entreprise, et volontairement.** Les autres réglages
 * de cette page appartiennent à la société et sont partagés par toute l'équipe ;
 * celui-ci n'appartient qu'à la personne au clavier. Les mélanger aurait laissé
 * croire qu'on change la langue de ses collègues.
 *
 * Pas de bouton « Enregistrer » : le choix s'applique au moment où on le fait.
 * Un réglage à une seule valeur, réversible d'un clic, n'a pas besoin d'être
 * confirmé — et le résultat est immédiatement visible, ce qui est la meilleure
 * confirmation possible.
 */
export function LanguageForm({ current }: { current: Locale }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const options = LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }));

  function choisir(valeur: string) {
    if (valeur === current) return;
    setErreur(null);
    startTransition(async () => {
      const result = await setLocaleAction(valeur);
      if (!result.ok) {
        setErreur(result.error);
        return;
      }
      // La coquille entière est rendue côté serveur à partir du cookie :
      // il faut redemander la page pour que la nouvelle langue s'applique.
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

      <div className="space-y-3 p-4 sm:p-5">
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
                disabled={pending}
              />
            </div>
            {pending ? (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none"
                aria-hidden
              />
            ) : (
              <Check className="h-4 w-4 shrink-0 text-status-paid-dot" aria-hidden />
            )}
            <span className="sr-only" role="status">
              {pending ? t.settings.languageSaving : t.settings.languageSaved}
            </span>
          </div>
        </div>

        {erreur && (
          <p role="alert" className="text-[12.5px] font-medium text-status-overdue">
            {erreur}
          </p>
        )}

        {/* Dire pourquoi les documents ne suivent pas évite la question
            « pourquoi ma facture est-elle encore en français ? ». */}
        <p className="max-w-[62ch] text-[12px] leading-relaxed text-ink-3">
          {t.settings.languageWhyFrench}
        </p>
      </div>
    </Card>
  );
}
