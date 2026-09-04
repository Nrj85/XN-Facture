/**
 * Résultat uniforme des Server Actions.
 *
 * Aligné sur les retours déjà en place en phase 2 (`ConvertResult`,
 * `deleteClient`) : une action qui peut être légitimement refusée remonte sa
 * raison, elle ne lève pas. Une exception traverserait la frontière serveur en
 * message générique — « An error occurred in the Server Components render » —
 * et l'utilisateur n'apprendrait rien.
 *
 * Les erreurs *inattendues* (base injoignable, bug) lèvent, elles, et sont
 * traitées comme telles.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Traduit une erreur PostgreSQL en message lisible.
 *
 * Les codes traités sont ceux que le schéma peut réellement produire :
 * violation de clé étrangère (suppression d'un client rattaché), unicité
 * (numéro en double), et refus de politique RLS. Le reste remonte tel quel
 * plutôt que d'être masqué derrière un « une erreur est survenue » qui
 * empêcherait tout diagnostic.
 */
export function describeDbError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case '23503':
      return 'Cet élément est référencé ailleurs et ne peut pas être supprimé.';
    case '23505':
      return 'Ce numéro est déjà attribué. Réessayez.';
    case '23514':
      return 'La base a refusé cette valeur : elle viole une règle du document.';
    case '42501':
      return 'Vous n’avez pas les droits nécessaires sur cette entreprise.';
    default:
      return error.message;
  }
}
