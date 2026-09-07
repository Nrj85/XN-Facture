'use client';

import { Search, X } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import type { IsoDate } from '@/lib/format';
import { PERIOD_KEYS, type DateRange, type PeriodPreset } from '@/lib/period';
import { useT } from '@/lib/i18n/context';

/**
 * Barre de filtres du tableau de bord : période et recherche.
 *
 * **Les deux filtrent l'écran entier**, pas seulement la liste du bas. Filtrer
 * la liste sans filtrer les cartes afficherait deux vérités contradictoires sur
 * la même page — « 3 factures » sous des chiffres qui en agrègent quarante — et
 * l'utilisateur ne saurait plus lequel croire. Le contrôle croisé du projet
 * (somme des tranches d'ancienneté = reste à encaisser) continue de tenir,
 * puisque tout est calculé sur le même sous-ensemble.
 *
 * L'état vit dans le composant, pas dans l'URL. Le porter en `?periode=` aurait
 * imposé `useSearchParams`, donc une frontière `<Suspense>` : le tableau de bord
 * ne serait plus rendu qu'après hydratation, et cette audience est souvent sur
 * un réseau lent. Le coût dépasse le bénéfice d'un lien partageable.
 */
export function DashboardFilters({
  preset,
  onPresetChange,
  range,
  onRangeChange,
  query,
  onQueryChange,
  today,
  rangeInvalid,
}: {
  preset: PeriodPreset;
  onPresetChange: (value: PeriodPreset) => void;
  range: DateRange;
  onRangeChange: (value: DateRange) => void;
  query: string;
  onQueryChange: (value: string) => void;
  today: IsoDate;
  rangeInvalid: boolean;
}) {
  const t = useT();
  // Les préréglages portent une clé ; le libellé est résolu ici, à l'affichage.
  const options = PERIOD_KEYS.map((entry) => ({ value: entry.value, label: t.period[entry.key] }));

  return (
    <section aria-label={t.dashboard.filtersLabel} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-[210px]">
          <label htmlFor="periode" className="sr-only">
            {t.dashboard.period}
          </label>
          <Combobox
            id="periode"
            value={preset}
            onChange={(value) => onPresetChange(value as PeriodPreset)}
            options={options}
          />
        </div>

        <label className="relative block flex-1">
          <span className="sr-only">{t.dashboard.searchAria}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t.dashboard.searchPlaceholder}
            className="pl-9"
          />
        </label>

        {/* Pas de bouton « Effacer » permanent : un contrôle qui ne fait rien
            neuf fois sur dix est du bruit. Il n'apparaît qu'une fois filtré. */}
        {(query || preset !== 'all') && (
          <button
            type="button"
            onClick={() => {
              onQueryChange('');
              onPresetChange('all');
            }}
            // `self-start` : en colonne sur téléphone, un bouton étiré sur toute
            // la largeur couperait le groupe de filtres en deux. Il tient à son
            // contenu, et retrouve l'alignement vertical dès `sm`.
            className="inline-flex h-10 shrink-0 self-start items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition-[background-color,border-color,transform] duration-150 ease-out hover:border-line-strong hover:text-ink active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:self-center"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {t.dashboard.reset}
          </button>
        )}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="sm:w-[210px]">
            <label htmlFor="periode-du" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              {t.dashboard.from}
            </label>
            <DatePicker
              id="periode-du"
              value={range.from}
              onChange={(from) => onRangeChange({ ...range, from })}
              today={today}
            />
          </div>
          <div className="sm:w-[210px]">
            <label htmlFor="periode-au" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              {t.dashboard.to}
            </label>
            <DatePicker
              id="periode-au"
              value={range.to}
              onChange={(to) => onRangeChange({ ...range, to })}
              today={today}
              // Borne basse : une plage qui se termine avant de commencer ne
              // filtrerait rien, et l'écran vide n'expliquerait pas pourquoi.
              min={range.from}
              invalid={rangeInvalid}
              aria-describedby={rangeInvalid ? 'periode-erreur' : undefined}
            />
          </div>
          {rangeInvalid && (
            <p
              id="periode-erreur"
              role="alert"
              className="text-[11.5px] font-medium text-status-overdue sm:mt-7"
            >
              {t.dashboard.rangeInvalid}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
