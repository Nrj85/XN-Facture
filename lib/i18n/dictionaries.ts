import { en } from './en';
import { fr } from './fr';
import type { Locale } from './locale';

/**
 * Accès aux dictionnaires — **module utilisable des deux côtés**.
 *
 * ⚠️ Ce fichier ne doit RIEN importer de `next/headers`. Il est tiré par le
 * contexte client (`context.tsx`) ; y faire entrer une API serveur casse la
 * compilation avec « You're importing a component that needs next/headers »,
 * et l'erreur ne désigne pas le fichier fautif mais celui qui l'importe.
 * Les fonctions qui lisent le cookie vivent dans `index.ts`, côté serveur.
 */
export type Dictionary = typeof fr;

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
