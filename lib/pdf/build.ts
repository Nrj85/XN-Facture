import { computeTotals } from '@/lib/invoice-calc';
import { STATUS_LABELS } from '@/lib/invoices';
import { QUOTE_STATUS_LABELS } from '@/lib/quotes';
import type { PdfPayload } from '@/lib/pdf/payload';
import type { Client, Company, InvoiceView, QuoteView } from '@/lib/types';

/**
 * Construction de la charge PDF à partir d'une vue.
 *
 * Isolée du composant qui déclenche le téléchargement : la même facture doit
 * produire exactement le même document, qu'on parte de la page de détail, du
 * menu d'actions rapides de la liste ou de la fenêtre de confirmation.
 */

function clientBlock(client: Client | undefined, fallbackName: string, address: string) {
  return {
    name: client?.name ?? fallbackName,
    email: client?.email ?? '',
    address,
  };
}

export function buildInvoicePayload(
  invoice: InvoiceView,
  company: Company,
  client: Client | undefined,
): PdfPayload {
  const totals = computeTotals(invoice.items, invoice.vatRate);

  return {
    docType: 'invoice',
    number: invoice.number,
    statusLabel: STATUS_LABELS[invoice.displayStatus],
    isDraft: invoice.status === 'draft',
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    client: clientBlock(client, invoice.clientName, invoice.address),
    company,
    lines: invoice.items.map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: totals.lineTotals[index] ?? 0,
    })),
    subtotal: totals.subtotal,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    total: totals.total,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    notes: invoice.notes,
  };
}

export function buildQuotePayload(
  quote: QuoteView,
  company: Company,
  client: Client | undefined,
): PdfPayload {
  const totals = computeTotals(quote.items, quote.vatRate);

  return {
    docType: 'quote',
    number: quote.number,
    statusLabel: QUOTE_STATUS_LABELS[quote.displayStatus],
    isDraft: quote.status === 'draft',
    issueDate: quote.issueDate,
    // Pour un devis, la seconde date est la fin de validité de l'offre.
    dueDate: quote.validUntil,
    client: clientBlock(client, quote.clientName, quote.address),
    company,
    lines: quote.items.map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: totals.lineTotals[index] ?? 0,
    })),
    subtotal: totals.subtotal,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    total: totals.total,
    // Un devis n'encaisse rien : ces deux valeurs restent neutres et le bloc
    // « déjà encaissé » du document ne s'affiche pas.
    amountPaid: 0,
    balanceDue: totals.total,
    notes: quote.notes,
  };
}
