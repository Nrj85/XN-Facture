/**
 * Types de la base, dérivés du schéma réel.
 *
 * Le fichier `database.types.ts` est produit par
 * `npx supabase gen types typescript` ; celui-ci n'en expose que ce dont le
 * mappeur a besoin, sous des noms lisibles. L'indirection a un coût d'un
 * fichier, et un bénéfice : renommer une colonne ou changer sa nullabilité en
 * base fait désormais échouer `tsc`, au lieu de produire un `undefined`
 * silencieux au premier accès — sur un montant, c'est exactement le genre
 * d'erreur qu'on ne voit qu'en production.
 *
 * **Sur les `bigint`** : PostgREST sérialise un `bigint` en nombre JSON, donc
 * les montants arrivent ici en `number`. C'est sans risque tant que la borne
 * documentée dans `lib/money.ts` tient (|montant| < 2^53, soit 9 000 milliards
 * de francs) — ce qui couvre tout usage réel.
 */

import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type InvoiceStatusRow = Enums['invoice_status'];
export type QuoteStatusRow = Enums['quote_status'];
export type CurrencyRow = Enums['currency_code'];
export type MemberRoleRow = Enums['member_role'];
export type DocumentKindRow = Enums['document_kind'];

export type CompanyRow = Tables['companies']['Row'];
export type ClientRow = Tables['clients']['Row'];
export type InvoiceRow = Tables['invoices']['Row'];
export type InvoiceItemRow = Tables['invoice_items']['Row'];
export type QuoteRow = Tables['quotes']['Row'];
export type QuoteItemRow = Tables['quote_items']['Row'];
export type CompanyMemberRow = Tables['company_members']['Row'];

/** Facture accompagnée de ses lignes, telle que la rend une requête imbriquée. */
export interface InvoiceWithItemsRow extends InvoiceRow {
  invoice_items: InvoiceItemRow[];
}

export interface QuoteWithItemsRow extends QuoteRow {
  quote_items: QuoteItemRow[];
}
