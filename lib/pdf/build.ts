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

/**
 * Logo de l'émetteur, réduit à ce qui est sûr d'imprimer.
 *
 * ⚠️ **SECOND FILET CONTRE LE SSRF DU 26 sept. 2026, et il a sa raison
 * d'être.** Le premier est `logoDataUrlSchema` (`lib/actions/schemas.ts`), qui
 * empêche d'ÉCRIRE autre chose qu'une image en ligne. Celui-ci empêche
 * d'IMPRIMER autre chose, et c'est différent : `companies.logo_data_url` est une
 * colonne que `companies_update` laisse un membre modifier, et rien ne garantit
 * qu'une ligne déjà en base, ou écrite un jour par un autre chemin — un `PATCH`
 * REST direct, un script de reprise, une restauration — soit passée par le
 * schéma.
 *
 * `@react-pdf` va chercher une URL distante depuis le serveur. C'est ici, au
 * seul endroit qui compose une charge PDF, que l'on refuse de lui en donner une.
 *
 * Un logo écarté ne fait pas échouer le document : il disparaît, et l'en-tête
 * retombe sur les deux initiales déjà prévues. Refuser la facture entière
 * priverait quelqu'un de sa pièce comptable pour un ornement.
 */
const LOGO_ACCEPTE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function withSafeLogo(company: Company): Company {
  if (!company.logoDataUrl) return company;
  if (LOGO_ACCEPTE.test(company.logoDataUrl)) return company;
  return { ...company, logoDataUrl: undefined };
}

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
  /**
   * Image du papier à en-tête, lue par la route appelante.
   *
   * ⚠️ **Elle n'est PAS prise sur `company`, et ne doit jamais y être.**
   * `Company` traverse `getSession()` et `CompanyProvider` à chaque page :
   * une image de page entière y serait transportée partout pour ne servir
   * qu'ici. Elle vit dans `company_letterheads` et n'est lue que par les deux
   * routes PDF.
   */
  letterhead?: string | null,
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
    company: withSafeLogo(company),
    letterheadDataUrl: letterhead ?? undefined,
    lines: invoice.items.map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: totals.lineTotals[index] ?? 0,
    })),
    subtotal: totals.subtotal,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    vatExempt: invoice.vatExempt,
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
  /**
   * Image du papier à en-tête, lue par la route appelante.
   *
   * ⚠️ **Elle n'est PAS prise sur `company`, et ne doit jamais y être.**
   * `Company` traverse `getSession()` et `CompanyProvider` à chaque page :
   * une image de page entière y serait transportée partout pour ne servir
   * qu'ici. Elle vit dans `company_letterheads` et n'est lue que par les deux
   * routes PDF.
   */
  letterhead?: string | null,
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
    company: withSafeLogo(company),
    letterheadDataUrl: letterhead ?? undefined,
    lines: quote.items.map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: totals.lineTotals[index] ?? 0,
    })),
    subtotal: totals.subtotal,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    vatExempt: quote.vatExempt,
    total: totals.total,
    // Un devis n'encaisse rien : ces deux valeurs restent neutres et le bloc
    // « déjà encaissé » du document ne s'affiche pas.
    amountPaid: 0,
    balanceDue: totals.total,
    notes: quote.notes,
  };
}
