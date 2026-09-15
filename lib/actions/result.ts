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
/**
 * Motif d'échec **lisible par la machine**.
 *
 * Certains refus ne sont pas des pannes : ce sont des décisions produit, et
 * l'interface doit pouvoir y répondre autrement que par un bandeau rouge. Un
 * plafond de formule atteint appelle une invitation à changer de formule, avec
 * un chemin pour le faire — pas un message sans issue.
 *
 * ⚠️ **Ne jamais reconnaître ces cas en comparant le texte du message.** Il est
 * rédigé pour être lu par un humain, donc il sera reformulé un jour, et la
 * comparaison cassera en silence.
 */
export type FailureReason = 'plan-limit';

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; reason?: FailureReason };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, reason?: FailureReason): ActionResult<never> {
  return reason ? { ok: false, error, reason } : { ok: false, error };
}

/**
 * Erreur PostgreSQL → échec typé.
 *
 * À préférer à `fail(describeDbError(e))` : c'est le seul endroit qui sait
 * traduire une étiquette de la base en motif applicatif, donc le seul à tenir
 * à jour quand la base en ajoute une.
 *
 * `hint` porte l'étiquette (`'plan-limit'`, posée par `enforce_invoice_quota`),
 * `message` porte le texte destiné à l'utilisateur.
 */
export function failFromDb(error: {
  code?: string;
  message: string;
  hint?: string | null;
}): ActionResult<never> {
  return fail(describeDbError(error), error.hint === 'plan-limit' ? 'plan-limit' : undefined);
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
    case 'P0001':
      // `raise exception` d'un déclencheur — aujourd'hui le plafond de la
      // formule Découverte (`invoices_quota`, 0007). Le message est rédigé EN
      // FRANÇAIS dans la base, à destination de l'utilisateur : le relayer tel
      // quel est voulu, pas un oubli de traduction. Toute nouvelle exception
      // de ce type doit donc être écrite pour être lue à l'écran.
      return error.message;
    default:
      return error.message;
  }
}
