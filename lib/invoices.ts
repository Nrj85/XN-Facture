import { daysBetween, type IsoDate } from '@/lib/format';
import { computeTotals } from '@/lib/invoice-calc';
import type { Client, DisplayStatus, Invoice, InvoiceView, StoredStatus } from '@/lib/types';

/**
 * Dérive le statut affiché à partir du statut stocké et de la date du jour.
 *
 * « En retard » n'est jamais persisté : une facture envoyée devient en retard
 * toute seule au passage de son échéance, sans qu'aucun travail de fond n'ait
 * à s'exécuter.
 */
export function deriveStatus(status: StoredStatus, dueDate: IsoDate, today: IsoDate): DisplayStatus {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'paid') return 'paid';
  if (status === 'draft') return 'draft';
  // sent | partially_paid
  return daysBetween(today, dueDate) < 0 ? 'overdue' : 'sent';
}

/**
 * Assemble la vue complète d'une facture : nom du client résolu, totaux calculés
 * à partir des lignes, statut affiché et solde. Rien n'est lu depuis un total
 * stocké — les lignes sont la seule source de vérité.
 */
export function toView(
  invoice: Invoice,
  clients: readonly Client[],
  today: IsoDate,
): InvoiceView {
  const { subtotal, vatAmount, total } = computeTotals(invoice.items, invoice.vatRate);

  return {
    ...invoice,
    clientName: clients.find((c) => c.id === invoice.clientId)?.name ?? 'Client supprimé',
    displayStatus: deriveStatus(invoice.status, invoice.dueDate, today),
    subtotal,
    vatAmount,
    total,
    balanceDue: total - invoice.amountPaid,
    daysToDue: daysBetween(today, invoice.dueDate),
  };
}

/** Trie les factures de la plus récente à la plus ancienne. */
export function sortByRecency(views: readonly InvoiceView[]): InvoiceView[] {
  return [...views].sort(
    (a, b) => b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

/**
 * Prédicat de recherche d'une facture — **unique implémentation**, partagée par
 * la liste `/factures` et le tableau de bord.
 *
 * On cherche sur le nom du client et le numéro, et sur rien d'autre : ce sont
 * les deux seules choses qu'on a en tête quand on cherche une facture. Y
 * ajouter les montants ferait remonter du bruit dès qu'on tape un chiffre.
 *
 * Un brouillon n'a pas de numéro ; il reste trouvable par son client.
 *
 * `needle` est attendu **déjà en minuscules et détouré** — la normaliser ici
 * la referait à chaque élément de la liste.
 */
export function matchesQuery(view: InvoiceView, needle: string): boolean {
  if (!needle) return true;
  return (
    view.clientName.toLowerCase().includes(needle) ||
    (view.number?.toLowerCase().includes(needle) ?? false)
  );
}

export interface DashboardStats {
  /** Nombre de factures émises (brouillons et annulations exclus). */
  invoiceCount: number;
  draftCount: number;
  /** Total TTC facturé. */
  invoiced: number;
  /** Total encaissé. */
  paid: number;
  /** Reste à encaisser. */
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
}

/** Une facture compte dans le chiffre d'affaires dès lors qu'elle est émise. */
function isIssued(view: InvoiceView): boolean {
  return view.displayStatus !== 'draft' && view.displayStatus !== 'cancelled';
}

export function computeStats(views: readonly InvoiceView[]): DashboardStats {
  const issued = views.filter(isIssued);

  return {
    invoiceCount: issued.length,
    draftCount: views.filter((v) => v.displayStatus === 'draft').length,
    invoiced: issued.reduce((sum, v) => sum + v.total, 0),
    paid: issued.reduce((sum, v) => sum + v.amountPaid, 0),
    outstanding: issued.reduce((sum, v) => sum + v.balanceDue, 0),
    overdueCount: views.filter((v) => v.displayStatus === 'overdue').length,
    overdueAmount: views
      .filter((v) => v.displayStatus === 'overdue')
      .reduce((sum, v) => sum + v.balanceDue, 0),
  };
}

/** Tranches d'ancienneté de créance, de la plus fraîche à la plus vieille. */
export const AGING_BUCKETS = [
  { key: 'current', label: 'À échoir', hint: 'Pas encore dues' },
  { key: 'd1_30', label: '1 à 30 j', hint: 'Retard récent' },
  { key: 'd31_60', label: '31 à 60 j', hint: 'À relancer' },
  { key: 'd60p', label: 'Plus de 60 j', hint: 'Recouvrement' },
] as const;

export type AgingKey = (typeof AGING_BUCKETS)[number]['key'];

export interface AgingBucket {
  key: AgingKey;
  label: string;
  hint: string;
  amount: number;
  count: number;
}

/**
 * Ventile l'encours client par ancienneté. C'est la question à laquelle un
 * entrepreneur veut une réponse en ouvrant l'application : combien on me doit,
 * et depuis combien de temps.
 */
export function computeAging(views: readonly InvoiceView[]): AgingBucket[] {
  const totals: Record<AgingKey, { amount: number; count: number }> = {
    current: { amount: 0, count: 0 },
    d1_30: { amount: 0, count: 0 },
    d31_60: { amount: 0, count: 0 },
    d60p: { amount: 0, count: 0 },
  };

  for (const view of views) {
    const unpaid = view.displayStatus === 'sent' || view.displayStatus === 'overdue';
    if (!unpaid || view.balanceDue <= 0) continue;

    const daysLate = -view.daysToDue; // > 0 si l'échéance est dépassée
    const key: AgingKey =
      daysLate <= 0 ? 'current' : daysLate <= 30 ? 'd1_30' : daysLate <= 60 ? 'd31_60' : 'd60p';

    totals[key].amount += view.balanceDue;
    totals[key].count += 1;
  }

  return AGING_BUCKETS.map((bucket) => ({
    ...bucket,
    amount: totals[bucket.key].amount,
    count: totals[bucket.key].count,
  }));
}
