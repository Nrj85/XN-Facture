import { ShieldCheck, Sparkles } from 'lucide-react';
import type { PlanCode } from '@/lib/plans';
import { planByCode } from '@/lib/plans';

/**
 * Badges d'identité de la barre latérale.
 *
 * ⚠️ **DEUX badges, parce que ce sont DEUX attributs distincts.** La formule
 * appartient à l'ENTREPRISE — elle s'applique à toute l'équipe, et deux
 * associés ne peuvent pas être l'un en Pro et l'autre en Découverte. Le rôle
 * d'administrateur de plateforme appartient à la PERSONNE (`platform_admins`
 * est indexée par `user_id`). Les fondre en un seul badge aurait laissé croire
 * que la formule se règle par utilisateur.
 *
 * D'où leur placement : le badge d'administrateur suit le nom de la personne,
 * le badge de formule suit le nom de l'entreprise.
 *
 * ⚠️ **Les libellés viennent de `lib/plans.ts`**, source unique du nom des
 * formules — comme le prix. Les recopier ici aurait produit un « Business »
 * sur l'écran le jour où la grille dit « Entreprise ».
 */

const BASE =
  'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.04em]';

/**
 * Badge de formule payante.
 *
 * ⚠️ **Rien n'est affiché en Découverte, et c'est voulu.** Un badge
 * « Découverte » n'apprendrait rien — c'est l'état par défaut — et occuperait
 * une place rare dans une barre de 248 px.
 *
 * ⚠️ **Le `plan` reçu doit être le plan EFFECTIF**, celui que rend
 * `effectivePlan()`. Afficher `subscriptions.plan` brut mettrait un badge
 * « Pro » sur un abonnement expiré, pendant que le déclencheur `invoices_quota`
 * refuserait la sixième facture du mois. C'est exactement la divergence que la
 * section « Abonnements » met en garde contre.
 */
export function PlanBadge({ plan }: { plan: PlanCode }) {
  if (plan === 'discovery') return null;

  return (
    <span
      className={`${BASE} bg-brand-soft text-brand-hover`}
      // `brand` sur `brand-soft` ne donne que 4,11:1 : le texte est en
      // `brand-hover` (5,38:1), conformément au tableau des couleurs.
      title={`Formule ${planByCode(plan).name}`}
    >
      <Sparkles size={10} strokeWidth={2.6} aria-hidden />
      {planByCode(plan).name}
    </span>
  );
}

/**
 * Badge d'administrateur de plateforme.
 *
 * ⚠️ **Il ne vaut PAS un badge de formule, et ne doit jamais le remplacer.**
 * Être administrateur ne change rien au plafond de factures : celui-ci est
 * appliqué par `invoices_quota` sur la formule de l'entreprise, sans exception
 * pour qui que ce soit. Afficher « Pro » à un administrateur dont l'entreprise
 * est en Découverte serait un mensonge que la base démentirait à la sixième
 * facture.
 *
 * ⚠️ **Neutre, pas doré.** C'est un rôle technique, pas une récompense ; le
 * ton de marque est réservé à ce qui se vend.
 */
export function AdminBadge() {
  return (
    <span
      className={`${BASE} bg-sand-deep text-ink-2`}
      title="Administrateur de plateforme"
    >
      <ShieldCheck size={10} strokeWidth={2.6} aria-hidden />
      Admin
    </span>
  );
}
