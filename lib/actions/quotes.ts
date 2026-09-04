'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyId } from '@/lib/actions/context';
import { firstIssue, quoteDraftSchema } from '@/lib/actions/schemas';
import { describeDbError, fail, ok, type ActionResult } from '@/lib/actions/result';
import { toItemRows, toQuote } from '@/lib/db/mappers';
import type { QuoteWithItemsRow } from '@/lib/db/types';
import { QUOTE_PREFIX } from '@/lib/quotes';
import { addDays } from '@/lib/format';
import { currentYear, today } from '@/lib/today';
import type { Quote, QuoteStatus } from '@/lib/types';

/**
 * Écritures sur les devis.
 *
 * Jumeau de `invoices.ts`, à trois différences près : la seconde date est une
 * validité et non une échéance, la séquence de numérotation est distincte
 * (`DEV`), et un devis n'encaisse rien.
 */

export interface QuoteDraftInput {
  clientId: string;
  issueDate: string;
  validUntil: string;
  address: string;
  notes?: string;
  items: Array<{ id?: string; description: string; quantity: number; unitPrice: number }>;
}

function revalidateQuotes(id?: string) {
  revalidatePath('/devis');
  if (id) revalidatePath(`/devis/${id}`);
}

type LoadedQuote = { ok: true; quote: Quote } | { ok: false; error: string };

async function loadQuote(companyId: string, id: string): Promise<LoadedQuote> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle<QuoteWithItemsRow>();

  if (error) return { ok: false, error: describeDbError(error) };
  if (!data) return { ok: false, error: 'Devis introuvable.' };
  return { ok: true, quote: toQuote(data) };
}

async function assignQuoteNumber(companyId: string): Promise<string | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('next_document_number', {
    p_company: companyId,
    p_kind: 'quote',
    p_prefix: QUOTE_PREFIX,
    p_year: currentYear(),
  });

  if (error) return { error: describeDbError(error) };
  return data as string;
}

export async function createQuoteAction(
  draft: QuoteDraftInput,
  options: { send: boolean },
): Promise<ActionResult<{ id: string; number: string | null }>> {
  const parsed = quoteDraftSchema.safeParse(draft);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();
  const { data: company } = await supabase
    .from('companies')
    .select('vat_rate')
    .eq('id', context.companyId)
    .single();

  let number: string | null = null;
  if (options.send) {
    const assigned = await assignQuoteNumber(context.companyId);
    if (typeof assigned !== 'string') return fail(assigned.error);
    number = assigned;
  }

  const { data: created, error } = await supabase
    .from('quotes')
    .insert({
      company_id: context.companyId,
      number,
      client_id: parsed.data.clientId,
      issue_date: parsed.data.issueDate,
      valid_until: parsed.data.validUntil,
      vat_rate: Number(company?.vat_rate ?? 19.25),
      address: parsed.data.address,
      notes: parsed.data.notes ?? null,
      status: options.send ? 'sent' : 'draft',
    })
    .select('id')
    .single();

  if (error || !created) return fail(describeDbError(error ?? { message: 'Création impossible.' }));

  const quoteId = created.id as string;
  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(toItemRows(parsed.data.items).map((row) => ({ ...row, quote_id: quoteId })));

  if (itemsError) {
    await supabase.from('quotes').delete().eq('id', quoteId);
    return fail(describeDbError(itemsError));
  }

  revalidateQuotes(quoteId);
  return ok({ id: quoteId, number });
}

export async function updateQuoteAction(
  id: string,
  draft: QuoteDraftInput,
): Promise<ActionResult<undefined>> {
  const parsed = quoteDraftSchema.safeParse(draft);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();
  const { error } = await supabase
    .from('quotes')
    .update({
      client_id: parsed.data.clientId,
      issue_date: parsed.data.issueDate,
      valid_until: parsed.data.validUntil,
      address: parsed.data.address,
      notes: parsed.data.notes ?? null,
    })
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  const { error: deleteError } = await supabase.from('quote_items').delete().eq('quote_id', id);
  if (deleteError) return fail(describeDbError(deleteError));

  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(toItemRows(parsed.data.items).map((row) => ({ ...row, quote_id: id })));
  if (itemsError) return fail(describeDbError(itemsError));

  revalidateQuotes(id);
  return ok();
}

export async function deleteQuoteAction(id: string): Promise<ActionResult<undefined>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateQuotes();
  return ok();
}

export async function sendQuoteAction(id: string): Promise<ActionResult<{ number: string }>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  const loaded = await loadQuote(context.companyId, id);
  if (!loaded.ok) return fail(loaded.error);

  let number = loaded.quote.number;
  if (number === null) {
    const assigned = await assignQuoteNumber(context.companyId);
    if (typeof assigned !== 'string') return fail(assigned.error);
    number = assigned;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('quotes')
    .update({ status: 'sent', number })
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateQuotes(id);
  return ok({ number });
}

export async function setQuoteStatusAction(
  id: string,
  status: QuoteStatus,
): Promise<ActionResult<undefined>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  const loaded = await loadQuote(context.companyId, id);
  if (!loaded.ok) return fail(loaded.error);

  // Un devis facturé est verrouillé : rouvrir son statut laisserait croire
  // qu'on peut défaire une facture depuis ici.
  if (loaded.quote.invoiceId) {
    return fail('Ce devis a produit une facture : son statut est figé.');
  }

  // Accepter ou refuser suppose que le devis a été transmis : il reçoit donc
  // son numéro s'il n'en avait pas.
  let number = loaded.quote.number;
  if (status !== 'draft' && number === null) {
    const assigned = await assignQuoteNumber(context.companyId);
    if (typeof assigned !== 'string') return fail(assigned.error);
    number = assigned;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('quotes')
    .update({ status, number })
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateQuotes(id);
  return ok();
}

/**
 * Convertit un devis accepté en facture.
 *
 * Trois décisions y sont figées :
 *   * la facture naît AUJOURD'HUI, pas à la date du devis — c'est la
 *     prestation qui se facture, pas l'offre ;
 *   * elle garde le TAUX DE TVA DU DEVIS, pas celui de l'entreprise : le total
 *     doit rester celui que le client a accepté, même si le taux a changé ;
 *   * elle arrive en BROUILLON, pour être relue avant émission.
 */
export async function convertQuoteToInvoiceAction(
  id: string,
): Promise<ActionResult<{ invoiceId: string }>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  const loaded = await loadQuote(context.companyId, id);
  if (!loaded.ok) return fail(loaded.error);
  const quote = loaded.quote;

  if (quote.invoiceId) {
    return fail('Ce devis a déjà produit une facture. Ouvrez-la plutôt que d’en créer une seconde.');
  }
  if (quote.items.length === 0) {
    return fail('Ce devis ne comporte aucune ligne.');
  }

  const supabase = createClient();
  const { data: company } = await supabase
    .from('companies')
    .select('payment_terms_days, default_notes')
    .eq('id', context.companyId)
    .single();

  const issueDate = today();
  const terms = Number(company?.payment_terms_days ?? 30);

  const { data: created, error } = await supabase
    .from('invoices')
    .insert({
      company_id: context.companyId,
      number: null,
      client_id: quote.clientId,
      issue_date: issueDate,
      due_date: addDays(issueDate, terms),
      vat_rate: quote.vatRate,
      address: quote.address,
      notes: (company?.default_notes as string | null) ?? null,
      amount_paid: 0,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error || !created) return fail(describeDbError(error ?? { message: 'Conversion impossible.' }));

  const invoiceId = created.id as string;
  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(toItemRows(quote.items).map((row) => ({ ...row, invoice_id: invoiceId })));

  if (itemsError) {
    await supabase.from('invoices').delete().eq('id', invoiceId);
    return fail(describeDbError(itemsError));
  }

  // Le verrou : `invoice_id` porte un index unique, donc une seconde
  // conversion échouerait même si ce contrôle applicatif était contourné.
  const { error: linkError } = await supabase
    .from('quotes')
    .update({ status: 'accepted', invoice_id: invoiceId })
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (linkError) {
    await supabase.from('invoices').delete().eq('id', invoiceId);
    return fail(describeDbError(linkError));
  }

  revalidateQuotes(id);
  revalidatePath('/factures');
  revalidatePath('/dashboard');
  return ok({ invoiceId });
}
