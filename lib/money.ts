/**
 * Arithmétique monétaire — source de vérité unique de l'application.
 *
 * Le FCFA (XAF / XOF) est une devise SANS SUBDIVISION : il n'existe pas de
 * centimes en circulation. Toutes les valeurs manipulées ici sont donc des
 * ENTIERS de francs.
 *
 * Règles non négociables :
 *   1. Aucun flottant ne touche un montant. Pas de `0.1 + 0.2` dans une facture.
 *   2. Les quantités fractionnaires (2,5 heures) sont portées en millièmes
 *      entiers (`qtyMilli`), jamais en décimal.
 *   3. Un seul et unique arrondi, `roundHalfUp`, dans toute la base de code.
 *
 * Plage sûre : |montant| < 2^53. Largement au-dessus de tout usage réel
 * (9 000 milliards de francs), donc les entiers JS suffisent — pas besoin de
 * BigInt tant que cette borne tient.
 */

/** Devises supportées. Toutes deux sont à zéro décimale. */
export type Currency = 'XAF' | 'XOF';

export class MoneyError extends Error {}

/** Garde-fou : refuse tout ce qui n'est pas un entier exploitable. */
export function assertWholeFrancs(value: number, context = 'montant'): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`${context} : valeur non finie (${value}).`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(
      `${context} : ${value} n'est pas un entier sûr. Les montants en FCFA sont des francs entiers.`,
    );
  }
  return value;
}

/**
 * Arrondi commercial (half-up), symétrique autour de zéro.
 *
 * `Math.round` seul ne convient pas : il arrondit vers +∞, donc
 * `Math.round(-0.5) === -0`. Sur un avoir, cela décalerait le montant d'un
 * franc dans le mauvais sens.
 */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`Arrondi impossible sur une valeur non finie (${value}).`);
  }
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Convertit une quantité décimale saisie par l'utilisateur en millièmes entiers. */
export function toQtyMilli(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    throw new MoneyError(`Quantité invalide (${quantity}).`);
  }
  return roundHalfUp(quantity * 1000);
}

/** Total d'une ligne : quantité (en millièmes) × prix unitaire, arrondi au franc. */
export function lineTotal(qtyMilli: number, unitPrice: number): number {
  assertWholeFrancs(unitPrice, 'prix unitaire');
  return roundHalfUp((qtyMilli * unitPrice) / 1000);
}

/**
 * TVA d'une base taxable. Le taux est exprimé en points de base pour rester
 * dans l'entier : 19,25 % → 1925.
 */
export function vatFromBase(base: number, rateBps: number): number {
  assertWholeFrancs(base, 'base taxable');
  return roundHalfUp((base * rateBps) / 10_000);
}

/** 19.25 → 1925. Le taux vient de la base en `numeric(5,2)`. */
export function rateToBps(ratePercent: number): number {
  return roundHalfUp(ratePercent * 100);
}

/**
 * Répartit un montant global (une remise) sur des parts, au prorata et en francs
 * entiers. Le reste de division est affecté à la plus grosse part.
 *
 * Garantit `somme(résultat) === total` exactement — sans quoi le sous-total
 * remisé ne correspondrait pas à la somme des lignes remisées.
 */
export function distributeProRata(total: number, weights: readonly number[]): number[] {
  assertWholeFrancs(total, 'montant à répartir');
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0 || total === 0) {
    return weights.map(() => 0);
  }

  const shares = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - shares.reduce((sum, s) => sum + s, 0);

  // Le reste part sur les plus grosses lignes, dans l'ordre décroissant.
  const order = weights
    .map((w, index) => ({ w, index }))
    .sort((a, b) => b.w - a.w || a.index - b.index);

  for (let i = 0; remainder > 0 && i < order.length; i += 1) {
    const slot = order[i];
    if (!slot) break;
    shares[slot.index] = (shares[slot.index] ?? 0) + 1;
    remainder -= 1;
  }

  return shares;
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency): Intl.NumberFormat {
  const cached = FORMATTERS.get(currency);
  if (cached) return cached;
  // `fr-FR` rend XAF/XOF en « FCFA », avec l'espace insécable fine comme
  // séparateur de milliers — la convention locale attendue.
  const created = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
  FORMATTERS.set(currency, created);
  return created;
}

/** `250000` → « 250 000 FCFA ». */
export function formatMoney(amount: number, currency: Currency = 'XAF'): string {
  assertWholeFrancs(amount);
  return formatter(currency).format(amount);
}

/** Montant sans le suffixe de devise, pour les colonnes de tableau serrées. */
export function formatAmount(amount: number): string {
  assertWholeFrancs(amount);
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
}

/**
 * Quantité, jusqu'à 3 décimales, sans zéros inutiles : `2.5` → « 2,5 ».
 *
 * Distinct de `formatAmount` à dessein : une quantité peut être fractionnaire
 * (2,5 heures), alors qu'un montant en FCFA ne le peut jamais. Passer une
 * quantité à `formatAmount` déclencherait `assertWholeFrancs`.
 */
export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return '0';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(quantity);
}

/**
 * Forme abrégée pour les cartes de statistiques, où « 12 450 000 FCFA » déborde.
 * `12450000` → « 12,45 M ». Le montant exact reste accessible en `title`.
 */
export function formatCompact(amount: number): string {
  assertWholeFrancs(amount);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const round1 = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);

  if (abs >= 1_000_000_000) return `${sign}${round1(abs / 1_000_000_000)} Md`;
  if (abs >= 1_000_000) return `${sign}${round1(abs / 1_000_000)} M`;
  if (abs >= 10_000) return `${sign}${round1(abs / 1000)} k`;
  return formatAmount(amount);
}
