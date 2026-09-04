'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyId } from '@/lib/actions/context';
import { firstIssue, invoiceDraftSchema } from '@/lib/actions/schemas';
import { describeDbError, fail, ok, type ActionResult } from '@/lib/actions/result';
import { toInvoice, toItemRows } from '@/lib/db/mappers';
import type { InvoiceWithItemsRow } from '@/lib/db/types';
import { computeTotals } from '@/lib/invoice-calc';
import { currentYear } from '@/lib/today';
import type { Invoice, StoredStatus } from '@/lib/types';

/**
 * Écritures sur les factures.
 *
 * Deux règles voyagent du store vers ici sans changer de sens :
 *
 *   * Le numéro est attribué À L'ÉMISSION, jamais à la création — et par la
 *     fonction SQL `next_document_number`, qui est atomique. Le balayage en
 *     mémoire de la phase 2 donnerait deux fois le même numéro à deux envois
 *     simultanés.
 *   * Aucun total n'est stocké. Quand le statut dépend d'un montant (soldée,
 *     partiellement payée), le total est recalculé par `computeTotals` à
 *     partir des lignes relues en base.
 */

export interface InvoiceDraftInput {
  clientId: string;
  issueDate: string;
  dueDate: string;
  address: string;
  notes?: string;
  items: Array<{ id?: string; description: string; quantity: number; unitPrice: number }>;
}

function revalidateInvoices(id?: string) {
  revalidatePath('/factures');
  revalidatePath('/dashboard');
  if (id) revalidatePath(`/factures/${id}`);
}

/**
 * Relit une facture avec ses lignes — nécessaire dès qu'un total entre en jeu.
 *
 * Le type de retour est explicite : laissé à l'inférence, TypeScript fond les
 * branches en un objet à propriétés optionnelles et le garde ne discrimine
 * plus rien.
 */
type LoadedInvoice = { ok: true; invoice: Invoice } | { ok: false; error: string };

async function loadInvoice(companyId: string, id: string): Promise<LoadedInvoice> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle<InvoiceWithItemsRow>();

  if (error) return { ok: false, error: describeDbError(error) };
  if (!data) return { ok: false, error: 'Facture introuvable.' };
  return { ok: true, invoice: toInvoice(data) };
}

async function assignNumber(companyId: string, prefix: string): Promise<string | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('next_document_number', {
    p_company: companyId,
    p_kind: 'invoice',
    p_prefix: prefix,
    p_year: currentYear(),
  });

  if (error) return { error: describeDbError(error) };
  return data as string;
}

/** Préfixe de numérotation de l'entreprise, source de vérité côté base. */
async function invoicePrefix(companyId: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from('companies')
    .select('invoice_prefix')
    .eq('id', companyId)
    .single();
  return (data?.invoice_prefix as string | undefined) ?? 'FAC';
}

export async function createInvoiceAction(
  draft: InvoiceDraftInput,
  options: { send: boolean },
): Promise<ActionResult<{ id: string; number: string | null }>> {
  const parsed = invoiceDraftSchema.safeParse(draft);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();

  // Le taux de TVA est FIGÉ sur la facture à sa création : modifier le taux
  // dans les paramètres ne doit pas réécrire un document déjà établi.
  const { data: company } = await supabase
    .from('companies')
    .select('vat_rate, invoice_prefix')
    .eq('id', context.companyId)
    .single();

  const vatRate = Number(company?.vat_rate ?? 19.25);

  let number: string | null = null;
  if (options.send) {
    const assigned = await assignNumber(
      context.companyId,
      (company?.invoice_prefix as string | undefined) ?? 'FAC',
    );
    if (typeof assigned !== 'string') return fail(assigned.error);
    number = assigned;
  }

  const { data: created, error } = await supabase
    .from('invoices')
    .insert({
      company_id: context.companyId,
      number,
      client_id: parsed.data.clientId,
      issue_date: parsed.data.issueDate,
      due_date: parsed.data.dueDate,
      vat_rate: vatRate,
      address: parsed.data.address,
      notes: parsed.data.notes ?? null,
      amount_paid: 0,
      status: options.send ? 'sent' : 'draft',
    })
    .select('id')
    .single();

  if (error || !created) return fail(describeDbError(error ?? { message: 'Création impossible.' }));

  const invoiceId = created.id as string;
  const { error: itemsError } = await supabase.from('invoice_items').insert(
    toItemRows(parsed.data.items).map((row) => ({ ...row, invoice_id: invoiceId })),
  );

  if (itemsError) {
    // Une facture sans lignes est un document faux. Plutôt que de la laisser,
    // on annule la création : PostgREST n'offre pas de transaction sur
    // plusieurs requêtes, ce nettoyage en tient lieu.
    await supabase.from('invoices').delete().eq('id', invoiceId);
    return fail(describeDbError(itemsError));
  }

  revalidateInvoices(invoiceId);
  return ok({ id: invoiceId, number });
}

export async function updateInvoiceAction(
  id: string,
  draft: InvoiceDraftInput,
): Promise<ActionResult<undefined>> {
  const parsed = invoiceDraftSchema.safeParse(draft);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();
  const { error } = await supabase
    .from('invoices')
    .update({
      client_id: parsed.data.clientId,
      issue_date: parsed.data.issueDate,
      due_date: parsed.data.dueDate,
      address: parsed.data.address,
      notes: parsed.data.notes ?? null,
    })
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  // Les lignes sont remplacées en bloc : gérer un différentiel ligne à ligne
  // pour trois lignes coûterait plus cher en complexité qu'en performance.
  const { error: deleteError } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', id);
  if (deleteError) return fail(describeDbError(deleteError));

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(toItemRows(parsed.data.items).map((row) => ({ ...row, invoice_id: id })));
  if (itemsError) return fail(describeDbError(itemsError));

  revalidateInvoices(id);
  return ok();
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult<undefined>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateInvoices();
  return ok();
}

export async function sendInvoiceAction(id: string): Promise<ActionResult<{ number: string }>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  const loaded = await loadInvoice(context.companyId, id);
  if (!loaded.ok) return fail(loaded.error);

  // Le numéro n'est attribué qu'une fois : un renvoi ne doit pas en consommer
  // un second et trouer la séquence.
  const number =
    loaded.invoice.number ??
    (await (async () => {
      const assigned = await assignNumber(context.companyId, await invoicePrefix(context.companyId));
      return assigned;
    })());

  if (typeof number !== 'string') return fail(number.error);

  const supabase = createClient();
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent', number })
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateInvoices(id);
  return ok({ number });
}

export async function setInvoiceStatusAction(
  id: string,
  status: StoredStatus,
): Promise<ActionResult<undefined>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  const loaded = await loadInvoice(context.companyId, id);
  if (!loaded.ok) return fail(loaded.error);
  const invoice = loaded.invoice;

  // Le montant encaissé suit le statut : soldée = tout payé, sinon remis à
  // zéro. Sans cette règle, le tableau de bord afficherait un encours qui ne
  // correspond à aucun statut. Seul `partially_paid` conserve son encaissement,
  // puisque c'est précisément ce qu'il représente.
  const amountPaid =
    status === 'paid'
      ? computeTotals(invoice.items, invoice.vatRate).total
      : status === 'partially_paid'
        ? invoice.amountPaid
        : 0;

  let number = invoice.number;
  if (status !== 'draft' && number === null) {
    const assigned = await assignNumber(context.companyId, await invoicePrefix(context.companyId));
    if (typeof assigned !== 'string') return fail(assigned.error);
    number = assigned;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('invoices')
    .update({ status, amount_paid: amountPaid, number })
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateInvoices(id);
  return ok();
}

/**
 * Enregistre un encaissement et en DÉDUIT le statut.
 *
 * Le montant est la donnée, le statut n'en est que la conséquence : c'est ce
 * qui rend impossible une facture « partiellement payée » à zéro franc.
 */
export async function recordPaymentAction(
  id: string,
  amount: number,
): Promise<ActionResult<undefined>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  if (!Number.isFinite(amount) || amount <= 0) {
    return fail('Saisissez un montant supérieur à zéro.');
  }

  const loaded = await loadInvoice(context.companyId, id);
  if (!loaded.ok) return fail(loaded.error);
  const invoice = loaded.invoice;

  const { total } = computeTotals(invoice.items, invoice.vatRate);
  if (Math.round(amount) > total) {
    return fail('Le montant dépasse le total de la facture.');
  }

  // Borné au total : un solde négatif n'a de représentation ni dans les
  // statistiques ni dans les tranches d'ancienneté.
  const paid = Math.max(0, Math.min(Math.round(amount), total));

  let number = invoice.number;
  if (number === null) {
    // On ne peut pas être payé d'une facture jamais émise.
    const assigned = await assignNumber(context.companyId, await invoicePrefix(context.companyId));
    if (typeof assigned !== 'string') return fail(assigned.error);
    number = assigned;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('invoices')
    .update({
      amount_paid: paid,
      status: paid >= total ? 'paid' : paid > 0 ? 'partially_paid' : 'sent',
      number,
    })
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateInvoices(id);
  return ok();
}
