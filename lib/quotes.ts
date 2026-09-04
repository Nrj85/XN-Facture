import { daysBetween, type IsoDate } from '@/lib/format';
import { computeTotals } from '@/lib/invoice-calc';
import type { Client, Quote, QuoteDisplayStatus, QuoteView } from '@/lib/types';

/**
 * Préfixe des numéros de devis.
 *
 * Constante et non paramètre d'entreprise : le préfixe de facture est
 * configurable parce qu'il porte une contrainte comptable, ce qui n'est pas le
 * cas d'un devis. Il deviendra un réglage le jour où un utilisateur le
 * demandera, pas avant.
 */
export const QUOTE_PREFIX = 'DEV';

/** Durée de validité par défaut d'une offre, en jours. */
export const QUOTE_VALIDITY_DAYS = 30;

/**
 * Dérive le statut affiché d'un devis.
 *
 * L'ordre des tests porte la règle métier : un devis converti reste converti,
 * un devis accepté reste accepté même une fois sa date de validité passée —
 * l'accord donné ne se périme pas rétroactivement.
 */
export function deriveQuoteStatus(quote: Quote, today: IsoDate): QuoteDisplayStatus {
  if (quote.invoiceId) return 'converted';
  if (quote.status !== 'sent') return quote.status;
  return daysBetween(today, quote.validUntil) < 0 ? 'expired' : 'sent';
}

/** Assemble la vue complète d'un devis, totaux calculés depuis les lignes. */
export function toQuoteView(quote: Quote, clients: readonly Client[], today: IsoDate): QuoteView {
  const { subtotal, vatAmount, total } = computeTotals(quote.items, quote.vatRate);

  return {
    ...quote,
    clientName: clients.find((c) => c.id === quote.clientId)?.name ?? 'Client supprimé',
    displayStatus: deriveQuoteStatus(quote, today),
    subtotal,
    vatAmount,
    total,
    daysToExpiry: daysBetween(today, quote.validUntil),
  };
}

/** Trie les devis du plus récent au plus ancien. */
export function sortQuotesByRecency(views: readonly QuoteView[]): QuoteView[] {
  return [...views].sort(
    (a, b) => b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * Libellés au masculin — « un devis envoyé », là où une facture est « envoyée ».
 * C'est la raison d'être de cette table séparée de `STATUS_LABELS`.
 */
export const QUOTE_STATUS_LABELS: Record<QuoteDisplayStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
  converted: 'Facturé',
};

export interface QuoteStats {
  /** Devis en attente de réponse (envoyés, non expirés). */
  pendingCount: number;
  pendingAmount: number;
  /** Devis acceptés ou déjà facturés. */
  wonCount: number;
  wonAmount: number;
  /** Devis refusés ou expirés sans réponse. */
  lostCount: number;
  expiredCount: number;
  /**
   * Part des devis tranchés qui ont abouti, en pourcentage entier.
   * `null` tant qu'aucun devis n'a été tranché : afficher « 0 % » là où il n'y
   * a rien à mesurer serait un mensonge.
   */
  winRate: number | null;
}

export function computeQuoteStats(views: readonly QuoteView[]): QuoteStats {
  const won = views.filter((v) => v.displayStatus === 'accepted' || v.displayStatus === 'converted');
  const lost = views.filter((v) => v.displayStatus === 'refused' || v.displayStatus === 'expired');
  const pending = views.filter((v) => v.displayStatus === 'sent');
  const decided = won.length + lost.length;

  return {
    pendingCount: pending.length,
    pendingAmount: pending.reduce((sum, v) => sum + v.total, 0),
    wonCount: won.length,
    wonAmount: won.reduce((sum, v) => sum + v.total, 0),
    lostCount: lost.length,
    expiredCount: views.filter((v) => v.displayStatus === 'expired').length,
    winRate: decided === 0 ? null : Math.round((won.length / decided) * 100),
  };
}

/** Formule d'échéance de validité, symétrique de `formatDueLabel`. */
export function formatValidityLabel(days: number): string {
  if (days < 0) return `Expiré depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`;
  if (days === 0) return 'Dernier jour de validité';
  return `Valable encore ${days} jour${days > 1 ? 's' : ''}`;
}

/**
 * Mention par défaut d'un devis.
 *
 * Elle ne peut pas reprendre celle des factures : annoncer des pénalités de
 * retard sur une offre qui n'a pas encore été acceptée n'aurait aucun sens.
 */
export const QUOTE_NOTES =
  'Devis valable jusqu’à la date indiquée. Pour l’accepter, retournez-le signé avec la mention « Bon pour accord ».';
