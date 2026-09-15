import { headers } from 'next/headers';

/**
 * Origine publique du site.
 *
 * `NEXT_PUBLIC_SITE_URL` prime, parce qu'elle est la seule valeur sûre en
 * production : les en-têtes de la requête sont fournis par le client. Un
 * `Host` falsifié détournerait sinon l'adresse de retour d'un paiement — ou
 * celle du webhook, ce qui serait pire : le prestataire notifierait un serveur
 * choisi par l'attaquant.
 *
 * ⚠️ Extrait de `lib/actions/auth.ts`, qui en avait sa propre copie. Deux
 * exemplaires de cette logique auraient fini par diverger, et c'est exactement
 * le genre de divergence qui ne se voit qu'en production.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const store = headers();
  const origin = store.get('origin');
  if (origin) return origin;

  const host = store.get('x-forwarded-host') ?? store.get('host') ?? 'localhost:3000';
  const protocol = store.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}
