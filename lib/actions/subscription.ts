'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/db/admin-queries';
import { failFromDb, fail, ok, type ActionResult } from '@/lib/actions/result';
import { firstIssue } from '@/lib/actions/schemas';
import {
  PLAN_CODES,
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

  const origin = await siteOrigin();
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

/* ===========================================================================
 * Côté ADMINISTRATEUR DE PLATEFORME — migration 0022
 *
 * Tout ce qui précède agit sur l'entreprise de l'APPELANT, et aucune de ces
 * fonctions ne prend d'identifiant d'entreprise : il n'y a rien à falsifier.
 * Ce qui suit est l'inverse — un administrateur agit sur l'entreprise d'un
 * AUTRE. La frontière est donc gardée deux fois, et c'est la base qui tranche.
 * =========================================================================== */

/**
 * ⚠️ **LES BORNES REPRENNENT CELLES DE LA MIGRATION 0022.** 1 à 24 mois, et la
 * liste fermée des trois codes. **Si l'une bouge, l'autre doit bouger** —
 * sinon le formulaire accepte ce que la base refuse, et l'administrateur lit
 * un SQLSTATE au lieu d'une phrase.
 */
const octroiSchema = z.object({
  companyId: z.string().uuid('Entreprise introuvable.'),
  plan: z.enum(PLAN_CODES),
  months: z
    .number()
    .int('La durée se compte en mois entiers.')
    .min(1, 'La durée minimale est d’un mois.')
    .max(24, 'La durée maximale est de 24 mois.'),
});

export interface OctroiRendu {
  plan: PlanCode;
  /** `null` pour Découverte, qui n'expire pas : elle EST l'état d'expiration. */
  expiresAt: string | null;
  /**
   * Vrai si une commande en attente **de la même formule** a été soldée au
   * passage. Faux ne signale aucune anomalie : la plupart des octrois ne
   * suivent aucune commande.
   */
  orderSettled: boolean;
}

/**
 * Octroyer une formule à une entreprise — réservé aux administrateurs.
 *
 * ⚠️ **CETTE FONCTION NE DÉCIDE RIEN, ET C'EST LE POINT.** L'autorisation vit
 * dans `admin_set_plan()`, dont la garde `is_platform_admin()` est À
 * L'INTÉRIEUR de la fonction SQL. `subscriptions` n'a toujours **aucune
 * politique d'écriture** : un `PATCH /rest/v1/subscriptions` reste refusé pour
 * tout le monde, administrateur compris. Un contrôle qui ne vivrait qu'ici se
 * sauterait d'une commande curl — c'est la leçon de 0007.
 *
 * Le test ci-dessous ne remplace donc pas la base : il évite un aller-retour
 * et rend une phrase française là où la base parlerait SQLSTATE.
 *
 * ⚠️ **`months` EST IGNORÉ POUR DÉCOUVERTE**, ici comme en base : la formule
 * gratuite n'a pas d'échéance. Le schéma exige quand même une valeur valide
 * pour n'avoir qu'une seule forme de requête — l'appelant envoie 1, la base
 * n'en fait rien.
 */
export async function grantPlanAction(
  companyId: string,
  plan: string,
  months: number,
): Promise<ActionResult<OctroiRendu>> {
  if (!(await isPlatformAdmin())) {
    return fail('Réservé aux administrateurs de plateforme.');
  }

  const parsed = octroiSchema.safeParse({ companyId, plan, months });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_set_plan', {
    p_company: parsed.data.companyId,
    p_plan: parsed.data.plan,
    p_months: parsed.data.months,
  });

  // ⚠️ **LE REFUS EST RELAYÉ, JAMAIS MASQUÉ.** `admin_set_plan` rédige ses
  // exceptions EN FRANÇAIS pour être lues à l'écran, et `describeDbError`
  // relaie `P0001` tel quel. Rendre ici un « réessayez » générique
  // transformerait un refus explicite en invitation à refaire ce qui échouera
  // toujours — le défaut corrigé sur `updateLetterheadAction` le 9 oct.
  if (error) return failFromDb(error);

  // ⚠️ **UNE RÉPONSE VIDE EST UN ÉCHEC, PAS UN SUCCÈS.** `returns table` rend
  // un tableau : une fonction qui n'aurait rien trouvé rendrait `[]`, et lire
  // `data[0].formule_posee` dessus donnerait `undefined` — donc un écran qui
  // annonce un octroi qui n'a pas eu lieu. Même famille que le « 0 compte »
  // affiché sur une lecture ratée.
  const ligne = data?.[0];
  if (!ligne) return fail('L’octroi n’a pas abouti : la base n’a rien renvoyé.');

  // L'espace d'administration est rendu côté serveur : sans cela, la nouvelle
  // formule n'apparaîtrait qu'au prochain rechargement complet.
  revalidatePath('/admin');
  // Et l'entreprise concernée voit sa formule sur son propre écran.
  revalidatePath('/abonnement');

  return ok({
    plan: ligne.formule_posee,
    expiresAt: ligne.echeance_posee ?? null,
    orderSettled: ligne.commande_soldee,
  });
}
