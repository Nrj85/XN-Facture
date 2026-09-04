import type { IsoDate } from '@/lib/format';

/**
 * Date du jour, en date civile.
 *
 * Remplace la constante `TODAY` figée de la phase 2.
 *
 * Le fuseau n'est pas un détail : `new Date().toISOString().slice(0, 10)` rend
 * la date **UTC**. À Douala (UTC+1), entre minuit et une heure du matin, elle
 * désigne encore la veille — une facture émise à 00 h 30 s'afficherait datée du
 * jour précédent, et une échéance basculerait « en retard » avec un jour
 * d'avance. `Intl` avec un fuseau explicite règle le problème, et le format
 * `fr-CA` produit directement `AAAA-MM-JJ`.
 */
export const BUSINESS_TIMEZONE = 'Africa/Douala';

const formatter = new Intl.DateTimeFormat('fr-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function today(): IsoDate {
  return formatter.format(new Date());
}

/** Année civile courante — utilisée par la numérotation des documents. */
export function currentYear(): number {
  return Number(today().slice(0, 4));
}
