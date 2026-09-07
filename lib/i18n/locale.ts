/**
 * Langue de l'interface.
 *
 * **Préférence PERSONNELLE, pas réglage d'entreprise.** Deux associés peuvent
 * partager la même société et ne pas lire la même langue ; le choix vit donc
 * dans un cookie du navigateur et non dans la table `companies`. Aucune
 * migration, et rien à synchroniser entre coéquipiers.
 *
 * **Les documents ne suivent pas.** Factures et devis restent en français,
 * quelle que soit la langue de l'interface : ce sont des pièces comptables
 * camerounaises, portant des mentions légales (NIU, RCCM) qui n'ont pas
 * d'équivalent traduit. Décision prise avec l'utilisateur, à ne pas rouvrir
 * sans lui demander.
 */

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/** Nom du cookie. En clair, parce qu'il n'y a rien de sensible dans « fr ». */
export const LOCALE_COOKIE = 'xn-langue';

/** Un an : la langue qu'on lit ne change pas tous les mois. */
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

/** Nom de chaque langue, écrit DANS cette langue — jamais traduit. */
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};

/**
 * Valide une valeur venue du cookie.
 *
 * Un cookie est fourni par le client : il peut contenir n'importe quoi. Sans
 * ce filtre, une valeur inattendue ferait chercher un dictionnaire inexistant
 * et la page entière tomberait.
 */
export function parseLocale(value: string | undefined | null): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}
