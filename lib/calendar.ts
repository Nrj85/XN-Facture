import type { IsoDate } from '@/lib/format';

/**
 * Construction de grilles de calendrier en dates civiles.
 *
 * Tout passe par `Date.UTC` : un calcul en heure locale décalerait les mois
 * d'un jour selon le fuseau, et une facture émise le 1er du mois se retrouverait
 * affichée le 31 du mois précédent.
 */

export const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

/** Semaine commençant le lundi, comme partout en zone francophone. */
export const WEEKDAY_NAMES = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'] as const;

export interface YearMonth {
  year: number;
  /** 1–12. */
  month: number;
}

function toIso(timestamp: number): IsoDate {
  const date = new Date(timestamp);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIso(iso: IsoDate): YearMonth & { day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Décale un couple année/mois de `delta` mois, en gérant le passage d'année. */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Grille de 6 semaines (42 jours) couvrant le mois, complétée par les jours
 * adjacents. Une hauteur fixe évite que le panneau ne saute d'un mois à l'autre.
 */
export function monthGrid({ year, month }: YearMonth): IsoDate[] {
  const firstOfMonth = Date.UTC(year, month - 1, 1);
  // getUTCDay() : 0 = dimanche. On ramène à 0 = lundi.
  const offset = (new Date(firstOfMonth).getUTCDay() + 6) % 7;
  const start = firstOfMonth - offset * 86_400_000;

  return Array.from({ length: 42 }, (_, index) => toIso(start + index * 86_400_000));
}

export function isSameMonth(iso: IsoDate, { year, month }: YearMonth): boolean {
  const parsed = parseIso(iso);
  return parsed.year === year && parsed.month === month;
}

/** Libellé complet pour les lecteurs d'écran : « samedi 8 août 2026 ». */
export function describeDate(iso: IsoDate): string {
  const { year, month, day } = parseIso(iso);
  const weekday = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
  return `${weekday} ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
