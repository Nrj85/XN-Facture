import { toQtyMilli } from '@/lib/money';
import type {
  ClientRow,
  CompanyRow,
  InvoiceItemRow,
  InvoiceWithItemsRow,
  QuoteItemRow,
  QuoteWithItemsRow,
} from '@/lib/db/types';
import type { Client, Company, Invoice, InvoiceItem, Quote } from '@/lib/types';

/**
 * Traduction entre les lignes de la base et les types du domaine.
 *
 * C'est la seule frontière où `snake_case` devient `camelCase` et où les
 * millièmes redeviennent des quantités. Tout le reste de l'application —
 * `computeTotals`, `toView`, `computeStats`, `computeAging` — continue de
 * travailler sur les types de `lib/types.ts` sans savoir qu'une base existe.
 *
 * Ces fonctions ne calculent aucun total. Les lignes restent la seule source
 * de vérité, exactement comme du temps du store.
 */

/** Millièmes entiers → quantité affichable. `2500` devient `2.5`. */
function fromQtyMilli(qtyMilli: number): number {
  return qtyMilli / 1000;
}

export function toCompany(row: CompanyRow): Company {
  return {
    name: row.name,
    legalName: row.legal_name,
    niu: row.niu,
    rccm: row.rccm,
    address: row.address,
    city: row.city,
    country: row.country,
    phone: row.phone,
    email: row.email,
    // Les colonnes nullables deviennent `undefined` : le domaine n'utilise pas
    // `null`, et laisser passer les deux obligerait chaque appelant à tester
    // les deux.
    logoDataUrl: row.logo_data_url ?? undefined,
    currency: row.currency,
    vatRate: Number(row.vat_rate),
    vatRegistered: row.vat_registered,
    paymentTermsDays: row.payment_terms_days,
    invoicePrefix: row.invoice_prefix,
    defaultNotes: row.default_notes ?? undefined,
    bankName: row.bank_name ?? undefined,
    bankAccount: row.bank_account ?? undefined,
    momoMtn: row.momo_mtn ?? undefined,
    momoOrange: row.momo_orange ?? undefined,
    // ⚠️ Repli sur les valeurs par défaut de la migration 0017 : les types
    // générés peuvent être en retard sur le schéma, et une entreprise lue avant
    // régénération renverrait `undefined` — ce qui ferait disparaître l'en-tête
    // de quelqu'un qui l'a réglé. `?? 'none'` ne masque rien ici : c'est
    // exactement le défaut de la colonne.
    letterheadMode: (row.letterhead_mode as Company['letterheadMode']) ?? 'none',
    letterheadTopMm: row.letterhead_top_mm ?? 45,
    letterheadBottomMm: row.letterhead_bottom_mm ?? 25,
    letterheadKeepLegal: row.letterhead_keep_legal ?? true,
  };
}

/**
 * Champs modifiables d'une entreprise, prêts pour un `update`.
 *
 * ⚠️ **LES QUATRE COLONNES DU PAPIER À EN-TÊTE SONT EXCLUES, délibérément.**
 * Elles ont leur propre action (`lib/actions/letterhead.ts`), et le formulaire
 * d'entreprise n'a aucun champ qui les porte : les inclure ici ferait réécrire
 * à chaque enregistrement des paramètres une valeur que le client n'a jamais
 * envoyée. `companySchema` les retire de toute façon, donc elles arrivaient
 * `undefined` — et seul le fait que `JSON.stringify` abandonne `undefined`
 * empêchait l'écriture. **Une protection par accident n'est pas une
 * protection** : la première sérialisation qui conserverait `undefined`
 * remettrait le mode à « aucun » derrière le dos de l'utilisateur.
 *
 * Effet de bord utile : ce fichier ne nomme plus les colonnes de 0017, donc
 * l'enregistrement des paramètres d'entreprise continue de fonctionner même
 * sur une base où la migration n'est pas encore appliquée.
 */
export function fromCompany(company: Company): Omit<
  CompanyRow,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'letterhead_mode'
  | 'letterhead_top_mm'
  | 'letterhead_bottom_mm'
  | 'letterhead_keep_legal'
> {
  return {
    name: company.name,
    legal_name: company.legalName,
    niu: company.niu,
    rccm: company.rccm,
    address: company.address,
    city: company.city,
    country: company.country,
    phone: company.phone,
    email: company.email,
    logo_data_url: company.logoDataUrl ?? null,
    currency: company.currency,
    vat_rate: company.vatRate,
    vat_registered: company.vatRegistered,
    payment_terms_days: company.paymentTermsDays,
    invoice_prefix: company.invoicePrefix,
    default_notes: company.defaultNotes ?? null,
    bank_name: company.bankName ?? null,
    bank_account: company.bankAccount ?? null,
    momo_mtn: company.momoMtn ?? null,
    momo_orange: company.momoOrange ?? null,
  };
}

export function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    email: row.email,
    phone: row.phone,
    address: row.address ?? undefined,
    city: row.city,
  };
}

export function fromClient(
  client: Omit<Client, 'id'>,
  companyId: string,
): Omit<ClientRow, 'id' | 'created_at'> {
  return {
    company_id: companyId,
    name: client.name,
    contact_name: client.contactName ?? null,
    email: client.email,
    phone: client.phone,
    address: client.address ?? null,
    city: client.city,
  };
}

function toItem(row: InvoiceItemRow | QuoteItemRow): InvoiceItem {
  return {
    id: row.id,
    description: row.description,
    quantity: fromQtyMilli(row.qty_milli),
    unitPrice: row.unit_price,
  };
}

/** Les lignes sont ordonnées par `position` : leur ordre est signifiant. */
function sortedItems(rows: Array<InvoiceItemRow | QuoteItemRow>): InvoiceItem[] {
  return [...rows].sort((a, b) => a.position - b.position).map(toItem);
}

export function toInvoice(row: InvoiceWithItemsRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    items: sortedItems(row.invoice_items ?? []),
    vatRate: Number(row.vat_rate),
    vatExempt: row.vat_exempt,
    address: row.address,
    notes: row.notes ?? undefined,
    amountPaid: row.amount_paid,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function toQuote(row: QuoteWithItemsRow): Quote {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    items: sortedItems(row.quote_items ?? []),
    vatRate: Number(row.vat_rate),
    vatExempt: row.vat_exempt,
    address: row.address,
    notes: row.notes ?? undefined,
    status: row.status,
    invoiceId: row.invoice_id ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Lignes prêtes pour l'insertion, position comprise.
 *
 * `toQtyMilli` arrondit la quantité au millième : c'est le seul endroit où une
 * quantité décimale saisie à l'écran devient un entier, et il n'y en aura
 * jamais d'autre.
 */
export function toItemRows(
  items: ReadonlyArray<{ description: string; quantity: number; unitPrice: number }>,
): Array<{ position: number; description: string; qty_milli: number; unit_price: number }> {
  return items.map((item, position) => ({
    position,
    description: item.description,
    qty_milli: toQtyMilli(item.quantity),
    unit_price: Math.round(item.unitPrice),
  }));
}
