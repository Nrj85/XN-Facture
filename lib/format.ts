/**
 * Formatage des dates.
 *
 * Les dates métier (émission, échéance, encaissement) sont des DATES CIVILES,
 * pas des instants : une facture émise le 8 janvier doit afficher le 8 janvier
 * à Douala comme à Paris. Elles circulent donc en `YYYY-MM-DD` et sont
 * découpées à la main — `new Date('2026-01-08')` serait interprété en UTC et
 * reculerait d'un jour dans les fuseaux négatifs.
 */

/** Date civile au format ISO court, tel que stocké en base (`date`). */
export type IsoDate = string;

const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
] as const;

function parts(iso: IsoDate): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  return { y: Number(y), m: Number(m), d: Number(d) };
}

/** `2026-08-28` → « 28/08/2026 ». Format demandé : jour/mois/année. */
export function formatDate(iso: IsoDate): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`;
}

/** `2026-08-28` → « 28 août 2026 », pour les en-têtes et le PDF. */
export function formatDateLong(iso: IsoDate): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${p.d} ${MONTHS_SHORT[p.m - 1] ?? ''} ${p.y}`;
}

/**
 * Décale une date civile de `days` jours. Le calcul passe par `Date.UTC` pour
 * rester indépendant du fuseau de la machine : sinon, un décalage d'un jour
 * apparaîtrait selon l'heure locale au moment du calcul.
 */
export function addDays(iso: IsoDate, days: number): IsoDate {
  const p = parts(iso);
  if (!p) return iso;
  const shifted = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Nombre de jours entiers entre deux dates civiles (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb) return 0;
  const ua = Date.UTC(pa.y, pa.m - 1, pa.d);
  const ub = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((ub - ua) / 86_400_000);
}

/**
 * « Échéance dans 6 jours » / « En retard de 12 jours ».
 * `days` = jours restants avant échéance (négatif si dépassée).
 */
export function formatDueLabel(days: number): string {
  if (days === 0) return "Échéance aujourd'hui";
  if (days > 0) return `Dans ${days} jour${days > 1 ? 's' : ''}`;
  const late = Math.abs(days);
  return `Retard de ${late} jour${late > 1 ? 's' : ''}`;
}
