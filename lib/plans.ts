import { formatAmount } from '@/lib/money';

/**
 * Les formules d'abonnement — **source unique**.
 *
 * Elles ne vivaient que dans `components/marketing/pricing.tsx`, en dur, sous
 * forme de texte de vente. L'application avait donc besoin des mêmes chiffres
 * sans pouvoir les lire : les recopier aurait garanti qu'un jour la grille
 * tarifaire annonce 5 000 FCFA pendant que la caisse en réclame 6 000.
 *
 * ⚠️ **`monthlyInvoices` est APPLIQUÉ ; `maxMembers` N'EST LU NULLE PART.**
 * Le plafond de factures est tenu par le déclencheur `invoices_quota`
 * (0007_quota_factures.sql), donc par la base et sur tous les chemins — pas
 * par ce fichier, qui ne sert qu'à l'afficher.
 *
 * ⚠️ **`maxMembers` NE SERT À RIEN AUJOURD'HUI, et il ne faut pas lire sa
 * présence ici comme un plafond en vigueur — constaté le 7 oct. 2026.** Ce
 * commentaire annonçait une limite « déclarative » que rien n'empêchait de
 * dépasser. C'est l'inverse : **le multi-utilisateur n'existe pas.**
 * `company_members` n'a aucune politique d'écriture, et son seul `insert` du
 * projet entier est dans `create_company_for_current_user`, qui y met le
 * créateur. Aucune deuxième personne ne peut rejoindre une entreprise —
 * mesuré en base : 8 entreprises, 8 appartenances, maximum 1 membre.
 *
 * Le champ reste ici parce que c'est bien lui qui portera le plafond le jour
 * où l'invitation existera. En attendant, **la mention « Jusqu'à 5
 * utilisateurs » de la formule Entreprise ci-dessous est une promesse sans
 * implémentation**, et elle est servie en production. Voir CLAUDE.md,
 * « Ce qui n'existe PAS encore ».
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
  /**
   * Ce que la formule apporte **aujourd’hui**, et rien d’autre.
   *
   * ⚠️ **Tout ce qui est écrit ici est servi en production sur la page qui
   * vend le produit.** Trois entrées de cette liste n’avaient aucune
   * implémentation jusqu’au 7 oct. 2026 — voir `upcoming`. **Avant d’en
   * ajouter une, en chercher le code.**
   */
  features: string[];
  /**
   * Ce qui est annoncé mais **pas encore livré**.
   *
   * ⚠️ **SÉPARÉ DE `features`, ET NON MARQUÉ DEDANS — c’est le point de
   * conception.** Un rendu qui ignore ce champ n’affiche QUE ce qui existe :
   * le défaut est donc honnête, et un nouvel écran ne peut pas promettre par
   * accident. C’est pourquoi la fenêtre de plafond (`plan-limit.tsx`), qui
   * sert à convaincre, ne le lit pas : on ne persuade pas avec du vide.
   *
   * Les deux écrans qui le rendent sont ceux où l’on DÉCIDE d’acheter — la
   * grille publique et `/abonnement` — et ils le marquent « à venir ».
   */
  upcoming: string[];
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
    // Les trois sont réelles : le plafond de 5 est tenu par le déclencheur
    // `invoices_quota` (0007), les devis sont bien hors plafond, et le PDF
    // porte NIU et RCCM depuis la phase 2.
    features: ['5 factures par mois', 'Devis illimités', 'Modèle PDF avec vos mentions légales'],
    upcoming: [],
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
    // ⚠️ La PREMIÈRE ligne dit que la formule est cumulative. Sans elle, les
    // lignes suivantes se lisent comme exclusives alors que la plupart sont
    // ouvertes à Découverte aussi : le seul verrou du produit est le plafond
    // de factures.
    features: [
      'Tout ce que contient Découverte',
      'Factures illimitées — le plafond de 5 par mois disparaît',
      'TVA calculée, ou mention « TVA non applicable »',
      'Suivi des encaissements, des retards et de l’encours par ancienneté',
      'Votre papier à en-tête sur chaque facture et chaque devis',
    ],
    // ⚠️ « Relances par email » était annoncé ici et N’EXISTE PAS : les seules
    // relances du projet sont NOS avis d’échéance d’abonnement (0011), qui
    // partent à nos abonnés — pas des rappels aux clients de l'utilisateur.
    // C’est la phase 5.
    upcoming: ['Relances automatiques de vos factures impayées'],
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
    // ⚠️ **DEUX DES QUATRE ARGUMENTS DE CETTE CARTE N’EXISTAIENT PAS**, et un
    // troisième n’était pas exclusif — constaté le 7 oct. 2026 :
    //
    //   « Jusqu'à 5 utilisateurs »   company_members n'a AUCUNE politique
    //                                 d’écriture : aucune deuxième personne ne
    //                                 peut rejoindre une entreprise
    //   « Export comptable »          le seul export du dépôt est le CSV
    //                                 d’administration, réservé aux admins
    //   « Tableau de bord et encours » existe, mais ouvert à TOUTES les
    //                                 formules, Découverte comprise
    //
    // ⚠️ **IL NE RESTE DONC QU’UNE SEULE LIGNE RÉELLE ET EXCLUSIVE**, et elle
    // ne tient pas au code : le support prioritaire est une promesse humaine.
    // Tant que l’invitation et l’export n’existent pas, **Entreprise et Pro
    // sont fonctionnellement IDENTIQUES** — `enforce_invoice_quota` (0007) ne
    // distingue que `discovery` du reste. À savoir avant d'en défendre l'écart
    // de prix.
    features: [
      'Tout ce que contient Pro',
      'Support prioritaire',
    ],
    upcoming: ['Jusqu’à 5 utilisateurs sur le même carnet de clients', 'Export comptable'],
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
