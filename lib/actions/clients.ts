'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyId } from '@/lib/actions/context';
import { clientSchema, firstIssue } from '@/lib/actions/schemas';
import { describeDbError, fail, ok, type ActionResult } from '@/lib/actions/result';
import { fromClient } from '@/lib/db/mappers';
import { countDocumentsForClient } from '@/lib/db/queries';
import type { Client } from '@/lib/types';

function revalidateClients() {
  revalidatePath('/clients');
  // Les listes et formulaires de documents affichent des noms de clients.
  revalidatePath('/factures');
  revalidatePath('/devis');
  revalidatePath('/dashboard');
}

export async function createClientAction(
  client: Omit<Client, 'id'>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = clientSchema.safeParse(client);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('clients')
    .insert(fromClient(parsed.data as Omit<Client, 'id'>, context.companyId))
    .select('id')
    .single();

  if (error) return fail(describeDbError(error));

  revalidateClients();
  return ok({ id: data.id as string });
}

export async function updateClientAction(
  id: string,
  client: Omit<Client, 'id'>,
): Promise<ActionResult<undefined>> {
  const parsed = clientSchema.safeParse(client);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();
  const { error } = await supabase
    .from('clients')
    .update(fromClient(parsed.data as Omit<Client, 'id'>, context.companyId))
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateClients();
  return ok();
}

/**
 * Suppression d'un client.
 *
 * La base refuserait de toute façon (`on delete restrict` sur `invoices` et
 * `quotes`), mais le décompte est fait AVANT pour pouvoir dire ce qui bloque.
 * « Ce client est rattaché à 3 factures » est actionnable ; « violates foreign
 * key constraint » ne l'est pas.
 */
export async function deleteClientAction(id: string): Promise<ActionResult<undefined>> {
  const context = await requireCompanyId();
  if (!context.ok) return context;

  const counts = await countDocumentsForClient(context.companyId, id);
  if (counts.invoices > 0 || counts.quotes > 0) {
    const parts = [
      counts.invoices > 0 && `${counts.invoices} facture${counts.invoices > 1 ? 's' : ''}`,
      counts.quotes > 0 && `${counts.quotes} devis`,
    ].filter(Boolean);

    return fail(
      `Ce client est rattaché à ${parts.join(' et ')}. ` +
        'Supprimez-les ou changez leur client avant de continuer.',
    );
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('company_id', context.companyId);

  if (error) return fail(describeDbError(error));

  revalidateClients();
  return ok();
}
