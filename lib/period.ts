import type { IsoDate } from '@/lib/format';

/**
 * Périodes de consultation du tableau de bord.
 *
 * Comme partout ailleurs dans le projet, une date est une **date civile** et
 * non un instant : le calcul passe par `Date.UTC`, sinon les bornes glisseraient
 * d'un jour selon le fuseau de la machine. Voir l'en-tête de `lib/format.ts`.
 *
 * Les bornes couvrent la **période entière**, pas « jusqu'à aujourd'hui ». Une
 * facture datée du 30 septembre doit apparaître dans « Ce mois-ci » dès le 5,
 * sinon l'utilisateur la croit perdue.
 */

export type PeriodPreset =
  | 'all'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'this-year'
  | 'custom';

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'all', label: 'Depuis le début' },
  { value: 'this-month', label: 'Ce mois-ci' },
  { value: 'last-month', label: 'Le mois dernier' },
  { value: 'last-3-months', label: '3 derniers mois' },
  { value: 'this-year', label: 'Cette année' },
  { value: 'custom', label: 'Période personnalisée' },
];

function parts(iso: IsoDate): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return { y: 1970, m: 1, d: 1 };
  const [, y, m, d] = match;
  return { y: Number(y), m: Number(m), d: Number(d) };
}

function iso(y: number, m: number, d: number): IsoDate {
  const date = new Date(Date.UTC(y, m - 1, d));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Premier jour du mois de `base`, décalé de `offset` mois. */
function firstOfMonth(base: IsoDate, offset = 0): IsoDate {
  const { y, m } = parts(base);
  return iso(y, m + offset, 1);
}

/** Dernier jour du mois de `base`, décalé de `offset` mois. Le jour 0 du mois
 *  suivant EST le dernier jour du mois visé — pas besoin de connaître sa durée,
 *  ni de traiter les années bissextiles à la main. */
function lastOfMonth(base: IsoDate, offset = 0): IsoDate {
  const { y, m } = parts(base);
  return iso(y, m + offset + 1, 0);
}

/**
 * Bornes d'un préréglage. `null` pour « Depuis le début » — il n'y a pas de
 * borne à appliquer, et fabriquer une date minimale arbitraire ferait mentir
 * l'affichage.
 *
 * `custom` rend `null` : ses bornes sont saisies par l'utilisateur, pas
 * déduites.
 */
export function resolvePeriod(preset: PeriodPreset, today: IsoDate): DateRange | null {
  switch (preset) {
    case 'this-month':
      return { from: firstOfMonth(today), to: lastOfMonth(today) };
    case 'last-month':
      return { from: firstOfMonth(today, -1), to: lastOfMonth(today, -1) };
    case 'last-3-months':
      // Les trois mois calendaires en cours, mois courant compris.
      return { from: firstOfMonth(today, -2), to: lastOfMonth(today) };
    case 'this-year': {
      const { y } = parts(today);
      return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
    }
    default:
      return null;
  }
}

/** Bornes incluses. Une date hors format tombe d'elle-même hors intervalle. */
export function isWithinRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

/** Une plage saisie à l'envers ne filtre rien de sensé : on la signale. */
export function isRangeValid(range: DateRange): boolean {
  return range.from <= range.to;
}
