'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { failFromDb, fail, ok, type ActionResult } from '@/lib/actions/result';
import { parsePlan, parsePeriod } from '@/lib/plans';

/**
 * Commander une formule.
 *
 * ⚠️ **Le montant n'est PAS un paramètre**, ni ici ni dans la fonction SQL.
 * Une Server Action est une route HTTP : le client peut y envoyer ce qu'il
 * veut. S'il pouvait annoncer le prix, il se commanderait la formule Pro à
 * 1 FCFA. Seuls la formule et la période transitent, et tous deux sont
 * revalidés en base contre une liste fermée.
 *
 * ⚠️ **Commander n'accorde rien.** `subscription_orders` et `subscriptions`
 * sont deux tables distinctes, et la seconde n'a toujours aucune politique
 * d'écriture. La formule ne s'active qu'au règlement constaté — à la main
 * aujourd'hui, par l'Edge Function de l'agrégateur demain.
 */
export async function startOrderAction(
  plan: string,
  period: string,
): Promise<ActionResult<{ reference: string }>> {
  const formule = parsePlan(plan);
  const periode = parsePeriod(period);

  if (!formule || formule === 'discovery') return fail('Cette formule ne peut pas être commandée.');
  if (!periode) return fail('Choisissez une périodicité.');

  const supabase = createClient();
  const { data, error } = await supabase.rpc('start_subscription_order', {
    p_plan: formule,
    p_period: periode,
  });

  if (error) return failFromDb(error);
  if (typeof data !== 'string') return fail('La commande n’a pas pu être enregistrée. Réessayez.');

  revalidatePath('/abonnement');
  return ok({ reference: data });
}

/** Renoncer à une commande en attente. Sans effet sur une commande réglée. */
export async function cancelOrderAction(): Promise<ActionResult<undefined>> {
  const supabase = createClient();
  const { error } = await supabase.rpc('cancel_subscription_order');
  if (error) return failFromDb(error);

  revalidatePath('/abonnement');
  return ok();
}
