'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyId } from '@/lib/actions/context';
import { companySchema, firstIssue } from '@/lib/actions/schemas';
import { describeDbError, fail, ok, type ActionResult } from '@/lib/actions/result';
import { fromCompany } from '@/lib/db/mappers';
import type { Company } from '@/lib/types';

/**
 * Enregistrement des paramètres de l'entreprise.
 *
 * Le taux de TVA et le délai de règlement ne s'appliquent qu'aux NOUVEAUX
 * documents : ceux qui existent portent leur propre `vat_rate`, figé à
 * l'émission. Aucune mise à jour en cascade ici — ce serait réécrire des
 * montants déjà communiqués à des clients.
 */
export async function updateCompanyAction(company: Company): Promise<ActionResult<undefined>> {
  const parsed = companySchema.safeParse(company);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const context = await requireCompanyId();
  if (!context.ok) return context;

  const supabase = createClient();
  const { error } = await supabase
    .from('companies')
    .update(fromCompany(parsed.data as Company))
    .eq('id', context.companyId);

  if (error) return fail(describeDbError(error));

  // L'entreprise alimente la coquille entière (barre latérale, aperçus, PDF) :
  // on invalide depuis la racine plutôt que route par route.
  revalidatePath('/', 'layout');
  return ok();
}
