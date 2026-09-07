import { cookies } from 'next/headers';
import { dictionary, type Dictionary } from './dictionaries';
import { LOCALE_COOKIE, parseLocale, type Locale } from './locale';

/**
 * Accès à la langue **côté serveur**.
 *
 * ⚠️ Ce module importe `next/headers` : il ne peut être tiré que par un Server
 * Component, une Server Action ou une route. Les composants clients passent par
 * `lib/i18n/context.tsx`, qui ne dépend que de `dictionaries.ts`.
 *
 * Lire le cookie rend la page **dynamique**. C'est sans conséquence pour
 * l'application, qui l'était déjà (elle lit une session) — et c'est justement
 * pourquoi la landing publique n'y touche pas et reste statique.
 */
export function getLocale(): Locale {
  return parseLocale(cookies().get(LOCALE_COOKIE)?.value);
}

export function getDictionary(): Dictionary {
  return dictionary(getLocale());
}

export { dictionary } from './dictionaries';
export type { Dictionary } from './dictionaries';
export {
  LOCALES,
  LOCALE_LABELS,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_MAX_AGE,
  parseLocale,
} from './locale';
export type { Locale } from './locale';
