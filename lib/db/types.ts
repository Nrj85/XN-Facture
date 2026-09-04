/**
 * Types de la base, écrits à la main pour l'instant.
 *
 * Ils seront remplacés par la sortie de
 *   `npx supabase gen types typescript --project-id <ref> > lib/db/types.ts`
 * dès que la connexion au projet sera établie. Jusque-là, ce fichier suffit à
 * typer les requêtes et à faire échouer la compilation si le mappeur et le
 * schéma se désaccordent.
 *
 * **Sur les `bigint`** : PostgREST sérialise un `bigint` en nombre JSON, donc
 * les montants arrivent ici en `number`. C'est sans risque tant que la borne
 * documentée dans `lib/money.ts` tient (|montant| < 2^53, soit 9 000 milliards
 * de francs) — ce qui est le cas de tout usage réel.
 */

export type InvoiceStatusRow = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'cancelled';
export type QuoteStatusRow = 'draft' | 'sent' | 'accepted' | 'refused';
export type CurrencyRow = 'XAF' | 'XOF';
export type MemberRoleRow = 'owner' | 'admin' | 'member';
export type DocumentKindRow = 'invoice' | 'quote';

export interface CompanyRow {
  id: string;
  name: string;
  legal_name: string;
  niu: string;
  rccm: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  logo_data_url: string | null;
  currency: CurrencyRow;
  /** `numeric` : PostgREST le rend en nombre. */
  vat_rate: number;
  payment_terms_days: number;
  invoice_prefix: string;
  default_notes: string | null;
  bank_name: string | null;
  bank_account: string | null;
  momo_mtn: string | null;
  momo_orange: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  company_id: string;
  name: string;
  contact_name: string | null;
  email: string;
  phone: string;
  address: string | null;
  city: string;
  created_at: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  /** Millièmes entiers. Voir `toQtyMilli` dans `lib/money.ts`. */
  qty_milli: number;
  unit_price: number;
}

export interface InvoiceRow {
  id: string;
  company_id: string;
  number: string | null;
  client_id: string;
  issue_date: string;
  due_date: string;
  vat_rate: number;
  address: string;
  notes: string | null;
  amount_paid: number;
  status: InvoiceStatusRow;
  created_at: string;
  updated_at: string;
}

/** Facture accompagnée de ses lignes, telle que la rend une requête imbriquée. */
export interface InvoiceWithItemsRow extends InvoiceRow {
  invoice_items: InvoiceItemRow[];
}

export interface QuoteItemRow {
  id: string;
  quote_id: string;
  position: number;
  description: string;
  qty_milli: number;
  unit_price: number;
}

export interface QuoteRow {
  id: string;
  company_id: string;
  number: string | null;
  client_id: string;
  issue_date: string;
  valid_until: string;
  vat_rate: number;
  address: string;
  notes: string | null;
  status: QuoteStatusRow;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteWithItemsRow extends QuoteRow {
  quote_items: QuoteItemRow[];
}

export interface CompanyMemberRow {
  company_id: string;
  user_id: string;
  role: MemberRoleRow;
  created_at: string;
}
