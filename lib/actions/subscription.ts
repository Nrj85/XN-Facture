'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { failFromDb, fail, ok, type ActionResult } from '@/lib/actions/result';
import {
  parsePlan,
  parsePeriod,
  planByCode,
  priceFor,
  type BillingPeriod,
  type PlanCode,
} from '@/lib/plans';
import { createPaymentLink, taraConfig } from '@/lib/payments/tara';
import { webhookUrl } from '@/lib/billing-config';
import { siteOrigin } from '@/lib/site-origin';

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

  await attacherLienDePaiement(supabase, data, formule, periode);

  revalidatePath('/abonnement');
  return ok({ reference: data });
}

/**
 * Demande son lien de paiement au prestataire et le pose sur la commande.
 *
 * ⚠️ **Ne lève jamais et ne fait jamais échouer la commande.** Celle-ci existe
 * déjà en base avec sa référence ; refuser ici laisserait l'utilisateur devant
 * une erreur alors que le règlement manuel reste ouvert. Sans lien, l'écran
 * retombe simplement sur les coordonnées mobile money.
 */
async function attacherLienDePaiement(
  supabase: ReturnType<typeof createClient>,
  reference: string,
  plan: PlanCode,
  period: BillingPeriod,
): Promise<void> {
  const config = taraConfig();
  if (!config) return;

  const formule = planByCode(plan);
  // ⚠️ Le prix vient d'ICI, pas du navigateur. `lib/plans.ts` est la seule
  // source du montant : c'est ce qui empêche de se commander Pro à 1 FCFA.
  const montant = priceFor(formule, period);
  if (montant === null) return;

  const origin = siteOrigin();
  const webhook = webhookUrl(origin);
  // Pas de secret de notification posé : on ne donne aucune adresse de rappel
  // plutôt qu'une adresse ouverte à tous. `webHookUrl` est obligatoire côté
  // Tara, donc la demande est simplement abandonnée.
  if (!webhook) return;

  const duree = period === 'yearly' ? 'un an' : 'un mois';
  const resultat = await createPaymentLink(config, {
    reference,
    name: `XN-Facture — Formule ${formule.name}`,
    description: `Abonnement ${formule.name} pour ${duree}. Référence ${reference}.`,
    price: montant,
    returnUrl: `${origin}/abonnement?commande=${encodeURIComponent(reference)}`,
    webhookUrl: webhook,
  });

  if (!resultat.ok) return;

  await supabase.rpc('attach_payment_links', {
    p_reference: reference,
    p_provider: 'tara',
    p_links: resultat.links,
  });
}

/** Renoncer à une commande en attente. Sans effet sur une commande réglée. */
export async function cancelOrderAction(): Promise<ActionResult<undefined>> {
  const supabase = createClient();
  const { error } = await supabase.rpc('cancel_subscription_order');
  if (error) return failFromDb(error);

  revalidatePath('/abonnement');
  return ok();
}

/**
 * Déclarer que l'on ne renouvellera pas — ou revenir sur cette décision.
 *
 * ⚠️ **Ce n'est PAS une résiliation immédiate, et le mot est évité partout.**
 * Il n'existe aucun prélèvement à interrompre : le mobile money ne sait pas
 * débiter d'office. L'accès court jusqu'à l'échéance déjà payée — la
 * raccourcir reviendrait à reprendre de l'argent reçu.
 *
 * Deux effets réels, qui distinguent ce bouton d'un contrôle mort : les
 * relances J-7 et J-1 cessent, et l'écran annonce la date de fin au lieu de
 * réclamer un paiement.
 *
 * `set_renewal_intent` ne prend **pas d'identifiant d'entreprise** : elle agit
 * sur celle de l'appelant, il n'y a rien à falsifier. C'est ce qui permet
 * d'ouvrir cette écriture alors que `subscriptions` n'a aucune politique
 * d'écriture.
 */
export async function setRenewalIntentAction(renew: boolean): Promise<ActionResult<undefined>> {
  const supabase = createClient();
  const { error } = await supabase.rpc('set_renewal_intent', { p_renew: renew });
  if (error) return failFromDb(error);

  revalidatePath('/abonnement');
  return ok();
}
