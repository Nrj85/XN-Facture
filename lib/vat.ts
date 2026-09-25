import type { InvoiceTotals } from '@/lib/invoice-calc';

/**
 * Ce que le bloc de totaux doit DIRE — une seule fois, pour cinq rendus.
 *
 * Le bloc est peint à cinq endroits : le récapitulatif de saisie
 * (`totals-summary`), l'aperçu du document (`invoice-preview`), les deux pages
 * de détail (facture et devis) et le PDF (`invoice-document`). Chacun a son
 * balisage — du DOM pour quatre, `@react-pdf` pour le cinquième — mais tous
 * doivent annoncer **exactement la même chose**.
 *
 * ⚠️ **Cette fonction ne décide donc pas de l'apparence, mais du CONTENU.**
 * C'est la seule façon d'ajouter le cas « non assujetti » sans écrire cinq
 * fois la même condition, et sans qu'elles divergent au premier ajustement de
 * texte — c'est la mésaventure déjà vécue avec les transitions de statut.
 *
 * ⚠️ **UN NON-ASSUJETTI N'A PAS DE SOUS-TOTAL.** Sans taxe, « sous-total HT »
 * et « total TTC » portent le même montant : les afficher tous les deux
 * ferait lire deux fois la même somme sous deux noms qui suggèrent une
 * différence. Une seule ligne, « Total », et la mention en dessous.
 *
 * ⚠️ **« TTC » DISPARAÎT AUSSI.** Un total « toutes taxes comprises » sur un
 * document qui n'en porte aucune est une contradiction que le client lira.
 */
export interface TotalsBlock {
  /** Lignes précédant le total. Vide quand la TVA ne s'applique pas. */
  rows: { label: string; amount: number }[];
  /** Libellé du total final : « Total TTC », ou « Total » sans taxe. */
  totalLabel: string;
  totalAmount: number;
  /**
   * Mention à imprimer sous le total, ou `null`.
   *
   * ⚠️ **Aucune référence à un article de loi**, et ce n'est pas un oubli : le
   * projet n'invente pas de mention légale, même règle que pour le NIU et le
   * RCCM. L'entreprise qui doit citer son régime précis dispose du champ
   * « mention par défaut » de ses paramètres, imprimé sur chaque document.
   */
  mention: string | null;
}

export const MENTION_SANS_TVA = 'TVA non applicable';

/**
 * Libellé du total, seul.
 *
 * Certains écrans n'affichent QUE le total — la confirmation de création, le
 * dialogue d'encaissement — sans bloc de totaux. Ils ont pourtant le même
 * besoin : « toutes taxes comprises » sur un document sans taxe est une
 * contradiction. `totalsBlock` s'appuie dessus, il n'y a donc qu'une source.
 */
export function totalLabel(vatExempt: boolean): string {
  return vatExempt ? 'Total' : 'Total TTC';
}

/**
 * Régime de TVA d'un document qu'on s'apprête à créer.
 *
 * ⚠️ **Le taux stocké de l'entreprise N'EST PAS remis à zéro quand elle se
 * déclare non assujettie**, et c'est délibéré : quelqu'un qui décoche par
 * erreur, ou qui s'assujettit plus tard, retrouve son 19,25 % sans le
 * retaper. Le taux dort, il ne disparaît pas.
 *
 * ⚠️ **Conséquence directe : on ne lit JAMAIS `company.vatRate` seul.** Ce
 * serait afficher 19,25 % dans l'aperçu pendant que le serveur enregistre 0 —
 * l'aperçu prétend montrer « le document tel que le client le recevra ».
 * Cette fonction est le seul endroit qui tranche, et elle sert des deux côtés :
 * les formulaires pour l'aperçu, les Server Actions pour l'écriture.
 */
export function newDocumentVat(company: { vatRate: number; vatRegistered: boolean }): {
  rate: number;
  exempt: boolean;
} {
  return company.vatRegistered
    ? { rate: company.vatRate, exempt: false }
    : { rate: 0, exempt: true };
}

export function totalsBlock(totals: InvoiceTotals, vatExempt: boolean): TotalsBlock {
  if (vatExempt) {
    return {
      rows: [],
      totalLabel: totalLabel(true),
      totalAmount: totals.total,
      mention: MENTION_SANS_TVA,
    };
  }

  return {
    rows: [
      { label: 'Sous-total HT', amount: totals.subtotal },
      // Le taux s'écrit à la française : 19,25 et non 19.25.
      { label: `TVA ${totals.vatRate.toString().replace('.', ',')} %`, amount: totals.vatAmount },
    ],
    totalLabel: totalLabel(false),
    totalAmount: totals.total,
    mention: null,
  };
}
