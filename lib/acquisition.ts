/**
 * Source d'une inscription : `?ref=` (lien d'un partenaire) et `utm_*`
 * (campagnes). Voir la migration 0025.
 *
 * Le parcours tient en trois temps :
 *   1. le middleware lit les paramètres de la première page vue et les garde
 *      dans le cookie `xn_src` — **la première source gagne**, une visite
 *      ultérieure par un autre lien ne l'écrase pas ;
 *   2. l'inscrit confirme son email ou passe par Google, puis crée son
 *      entreprise sur `/bienvenue` ;
 *   3. `createCompany` relit le cookie et appelle `record_acquisition`.
 *
 * ⚠️ **Ce module est importé par le middleware** : il ne doit dépendre de rien
 * qui exige Node (pas de `next/headers`, pas de client Supabase).
 *
 * ⚠️ **Rien ici n'accorde de droit.** La valeur vient du navigateur, elle est
 * falsifiable, et la base la normalise de toute façon. Elle sert à compter.
 */

export const ACQUISITION_COOKIE = 'xn_src';

/** 90 jours : le temps qu'un prospect revienne s'inscrire après un premier clic. */
export const ACQUISITION_MAX_AGE = 60 * 60 * 24 * 90;

export interface Acquisition {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** Chemin de la première page vue (jamais l'URL entière). */
  p?: string;
}

const CLES = ['ref', 'utm_source', 'utm_medium', 'utm_campaign'] as const;

/** Une valeur courte et sans surprise ; la base refera le nettoyage complet. */
function borne(value: string | null): string | undefined {
  const v = value?.trim().slice(0, 60);
  return v ? v : undefined;
}

/** Les paramètres d'une URL, ou `null` s'il n'y a aucune source. */
export function acquisitionFromUrl(params: URLSearchParams, pathname: string): Acquisition | null {
  const source: Acquisition = {};
  for (const cle of CLES) {
    const v = borne(params.get(cle));
    if (v) source[cle] = v;
  }
  if (!CLES.some((cle) => source[cle])) return null;
  source.p = pathname.slice(0, 80);
  return source;
}

export function serializeAcquisition(source: Acquisition): string {
  return encodeURIComponent(JSON.stringify(source));
}

/** Relit le cookie ; une valeur illisible vaut « pas de source », jamais une erreur. */
export function parseAcquisition(raw: string | undefined): Acquisition | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    const source: Acquisition = {};
    for (const cle of [...CLES, 'p'] as const) {
      if (typeof v[cle] === 'string') source[cle] = (v[cle] as string).slice(0, 80);
    }
    return CLES.some((cle) => source[cle]) ? source : null;
  } catch {
    return null;
  }
}
