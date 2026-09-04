import { lineTotal, rateToBps, toQtyMilli, vatFromBase } from '@/lib/money';

/**
 * Moteur de calcul d'une facture — implémentation unique, utilisée à la fois par
 * l'aperçu temps réel et par l'enregistrement. Les deux ne peuvent pas diverger
 * puisqu'ils appellent le même code.
 *
 * Ordre strict :
 *   1. total de ligne  = arrondi(quantité × prix unitaire)   [half-up]
 *   2. sous-total HT   = Σ totaux de ligne
 *   3. TVA             = arrondi(sous-total × taux)          [UN SEUL arrondi]
 *   4. total TTC       = sous-total + TVA
 *
 * L'étape 3 est le point sensible : arrondir la TVA ligne par ligne accumule
 * l'erreur (jusqu'à ±1 FCFA par ligne) et produit un total qui ne correspond pas
 * à celui que le client recalculera. Un seul arrondi par base taxable est la
 * pratique comptable correcte.
 */

export interface CalcItem {
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  /** Total de chaque ligne, dans l'ordre reçu, en francs entiers. */
  lineTotals: number[];
  /** Sous-total hors taxes. */
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  /** Total toutes taxes comprises. */
  total: number;
}

export function computeTotals(
  items: readonly CalcItem[],
  vatRate: number,
): InvoiceTotals {
  const lineTotals = items.map((item) =>
    lineTotal(toQtyMilli(item.quantity), Math.round(item.unitPrice)),
  );
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
  const vatAmount = vatFromBase(subtotal, rateToBps(vatRate));

  return { lineTotals, subtotal, vatRate, vatAmount, total: subtotal + vatAmount };
}

/** Total d'une seule ligne, pour l'affichage au fil de la saisie. */
export function computeLineTotal(quantity: number, unitPrice: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return lineTotal(toQtyMilli(quantity), Math.round(unitPrice));
}
