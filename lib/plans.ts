import { formatAmount } from '@/lib/money';

/**
 * Les formules d'abonnement — **source unique**.
 *
 * Elles ne vivaient que dans `components/marketing/pricing.tsx`, en dur, sous
 * forme de texte de vente. L'application avait donc besoin des mêmes chiffres
 * sans pouvoir les lire : les recopier aurait garanti qu'un jour la grille
 * tarifaire annonce 5 000 FCFA pendant que la caisse en réclame 6 000.
 *
 * ⚠️ **Les limites ci-dessous sont DÉCLARÉES, pas encore APPLIQUÉES.** Rien
 * dans le code ne refuse aujourd'hui la sixième facture d'un compte Découverte.
 * C'est un mensonge tant que ce n'est pas fait — et la raison pour laquelle
 * personne ne paierait : la formule gratuite donne déjà tout. Voir CLAUDE.md,
 * « Abonnements », pour l'ordre des étapes.
 */

export const PLAN_CODES = ['discovery', 'pro', 'business'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  /** Entier de francs par mois. Le FCFA n'a pas de centimes. */
  monthlyPrice: number;
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
