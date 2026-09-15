import { formatAmount } from '@/lib/money';

/**
 * Les formules d'abonnement — **source unique**.
 *
 * Elles ne vivaient que dans `components/marketing/pricing.tsx`, en dur, sous
 * forme de texte de vente. L'application avait donc besoin des mêmes chiffres
 * sans pouvoir les lire : les recopier aurait garanti qu'un jour la grille
 * tarifaire annonce 5 000 FCFA pendant que la caisse en réclame 6 000.
 *
 * ⚠️ **`monthlyInvoices` est APPLIQUÉ, `maxMembers` ne l'est PAS.**
 * Le plafond de factures est tenu par le déclencheur `invoices_quota`
 * (0007_quota_factures.sql), donc par la base et sur tous les chemins — pas
 * par ce fichier, qui ne sert qu'à l'afficher. La limite d'utilisateurs, elle,
 * reste déclarative : rien n'empêche aujourd'hui une sixième personne de
 * rejoindre une entreprise. À faire avant de vendre la formule Entreprise sur
 * cet argument.
 */

export const PLAN_CODES = ['discovery', 'pro', 'business'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  /** Entier de francs par mois. Le FCFA n'a pas de centimes. */
  monthlyPrice: number;
  /**
   * Entier de francs par an, `null` pour la formule gratuite.
   *
   * **Dix mois payés pour douze.** Ce n'est pas une promotion décorative :
   * le mobile money ne sait pas prélever automatiquement, donc chaque
   * renouvellement est un paiement MANUEL qui peut ne pas venir. Douze
   * occasions de perdre un client par an contre une seule — la remise coûte
   * moins cher que l'attrition qu'elle évite, et elle encaisse d'avance.
   */
  yearlyPrice: number | null;
  pitch: string;
  features: string[];
  cta: string;
  featured?: boolean;
  /** `null` = illimité. */
  monthlyInvoices: number | null;
  /** `null` = illimité. */
  maxMembers: number | null;
}

export const PLANS: PlanDefinition[] = [
  {
    code: 'discovery',
    name: 'Découverte',
    monthlyPrice: 0,
    yearlyPrice: null,
    pitch: 'De quoi éprouver l’outil sur vos premières factures, sans rien engager.',
    features: ['5 factures par mois', 'Devis illimités', 'Modèle PDF avec vos mentions légales'],
    cta: 'Créer mon compte',
    monthlyInvoices: 5,
    maxMembers: 1,
  },
  {
    code: 'pro',
    name: 'Pro',
    monthlyPrice: 5000,
    yearlyPrice: 50000,
    pitch: 'Pour l’indépendant ou l’artisan qui facture toutes les semaines.',
    features: [
      'Factures et devis illimités',
      'TVA et échéances automatiques',
      'Suivi des encaissements et des retards',
      'Relances par email',
    ],
    cta: 'Choisir Pro',
    featured: true,
    monthlyInvoices: null,
    maxMembers: 1,
  },
  {
    code: 'business',
    name: 'Entreprise',
    monthlyPrice: 15000,
    yearlyPrice: 150000,
    pitch: 'Pour une équipe qui partage le même carnet de clients.',
    features: [
      'Jusqu’à 5 utilisateurs',
      'Tableau de bord et encours par ancienneté',
      'Export comptable',
      'Support prioritaire',
    ],
    cta: 'Choisir Entreprise',
    monthlyInvoices: null,
    maxMembers: 5,
  },
];

export const DEFAULT_PLAN: PlanCode = 'discovery';

export function planByCode(code: PlanCode): PlanDefinition {
  // `noUncheckedIndexedAccess` : `find` peut rendre `undefined` aux yeux du
  // compilateur. Le repli n'arrive jamais — `PlanCode` ne porte que des codes
  // présents dans `PLANS` — mais il vaut mieux qu'une formule inconnue rende
  // la gratuite qu'une page blanche.
  return PLANS.find((plan) => plan.code === code) ?? (PLANS[0] as PlanDefinition);
}

/**
 * Lit une formule venue de l'extérieur — chaîne de requête, base, API.
 *
 * Tout ce qui arrive du réseau passe par ici : `?plan=` est fourni par le
 * visiteur, donc il vaut n'importe quoi jusqu'à preuve du contraire.
 */
export function parsePlan(value: unknown): PlanCode | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase();
  return (PLAN_CODES as readonly string[]).includes(code) ? (code as PlanCode) : null;
}

/** Destination du bouton de la grille tarifaire. */
export function planSignupHref(code: PlanCode): string {
  return `/inscription?plan=${code}`;
}

/** « Gratuit » ou « 5 000 FCFA / mois » — jamais de `toLocaleString` ici. */
export function planPriceLabel(plan: PlanDefinition): string {
  return plan.monthlyPrice === 0 ? 'Gratuit' : `${formatAmount(plan.monthlyPrice)} FCFA / mois`;
}

/** « 50 000 FCFA / an » — `null` quand la formule est gratuite. */
export function planYearlyLabel(plan: PlanDefinition): string | null {
  return plan.yearlyPrice === null ? null : `${formatAmount(plan.yearlyPrice)} FCFA / an`;
}

/** Combien de mois offerts par le paiement annuel. Calculé, jamais écrit en dur. */
export function planMonthsFree(plan: PlanDefinition): number {
  if (plan.yearlyPrice === null || plan.monthlyPrice === 0) return 0;
  return 12 - Math.round(plan.yearlyPrice / plan.monthlyPrice);
}

/**
 * La formule qui s'applique VRAIMENT, échéance comprise.
 *
 * ⚠️ **Cette règle existe en deux exemplaires, et c'est délibéré** : ici pour
 * l'affichage, et dans `enforce_invoice_quota()` (0007) pour l'appliquer. La
 * base est l'autorité — l'application ne fait que dire la même chose à
 * l'écran. **Toute modification doit toucher les deux**, sinon l'utilisateur
 * lit « Pro » pendant que ses factures sont refusées.
 *
 * Un abonnement expiré retombe en Découverte : on ne ferme jamais la porte,
 * les factures d'un entrepreneur sont sa comptabilité.
 */
export function effectivePlan(
  plan: PlanCode,
  expiresAt: string | null,
  today: string,
): PlanCode {
  if (plan === 'discovery') return 'discovery';
  // Comparaison de chaînes : les dates ISO `AAAA-MM-JJ` s'ordonnent
  // lexicographiquement, comme partout ailleurs dans le projet.
  if (expiresAt !== null && expiresAt < today) return 'discovery';
  return plan;
}

// --- Périodicité de facturation ---------------------------------------------

export const BILLING_PERIODS = ['monthly', 'yearly'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export function parsePeriod(value: unknown): BillingPeriod | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase();
  return (BILLING_PERIODS as readonly string[]).includes(code) ? (code as BillingPeriod) : null;
}

/**
 * Prix à régler pour une formule et une période.
 *
 * ⚠️ **C'est LA source du montant.** Une commande (`subscription_orders`) n'en
 * stocke aucun, délibérément : un prix figé en base deviendrait une seconde
 * vérité, et un jour la caisse réclamerait ce que la grille tarifaire
 * n'annonce plus. Le montant se recalcule ici à chaque affichage.
 *
 * `null` pour la formule gratuite : elle ne se commande pas.
 */
export function priceFor(plan: PlanDefinition, period: BillingPeriod): number | null {
  if (plan.monthlyPrice === 0) return null;
  return period === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
}

/** « 5 000 FCFA / mois » ou « 50 000 FCFA / an ». */
export function priceLabelFor(plan: PlanDefinition, period: BillingPeriod): string {
  const montant = priceFor(plan, period);
  if (montant === null) return 'Gratuit';
  return `${formatAmount(montant)} FCFA / ${period === 'yearly' ? 'an' : 'mois'}`;
}

/** Les formules réellement commandables — la gratuite est celle qu'on a déjà. */
export const PAID_PLANS: PlanDefinition[] = PLANS.filter((plan) => plan.monthlyPrice > 0);
