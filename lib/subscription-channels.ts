/**
 * Les canaux de règlement d'un versement d'abonnement.
 *
 * ⚠️ **CE FICHIER EXISTE POUR UNE SEULE RAISON : un module `'use server'` ne
 * peut exporter QUE des fonctions asynchrones.** `CANAUX` vivait dans
 * `lib/actions/subscription.ts` depuis la migration 0023 (21 oct. 2026), et
 * c'est une constante — donc un `object` à l'exécution. Next le refuse au
 * chargement du module, et la panne ne ressemble en rien à sa cause :
 *
 * ```
 * A "use server" file can only export async functions, found object.
 * exportedName : "CANAUX"
 * POST /abonnement 500
 * ```
 *
 * ⚠️ **L'ÉCRAN QUI TOMBE N'EST PAS CELUI QUI FAUTE.** La validation porte sur
 * TOUS les exports du module, et elle s'exécute **avant** la moindre ligne de
 * l'action appelée. Cliquer « Choisir Pro » sur `/abonnement` échouait donc à
 * cause d'une constante qui ne sert qu'à `/admin` — et `startOrderAction`
 * n'était jamais atteinte. Rien à voir avec Tara, dont l'appel se trouve plus
 * loin dans une fonction qui n'a jamais tourné.
 *
 * ⚠️ **C'EST LA DEUXIÈME FOIS, ET LE PRÉCÉDENT EST DOCUMENTÉ.**
 * `translateAuthError` a quitté `lib/actions/auth.ts` pour
 * `lib/auth-errors.ts` le 15 sept. 2026, pour exactement cette règle. **Toute
 * valeur partagée — constante, table, schéma zod — se range hors d'un module
 * d'actions.** Seuls les `type` et les `interface` peuvent y rester : ils
 * disparaissent à la compilation, donc la validation ne les voit pas.
 */

/** Les quatre canaux de règlement réels, plus « autre ». */
export const CANAUX = ['mtn_momo', 'orange_money', 'bank', 'cash', 'autre'] as const;

export type Canal = (typeof CANAUX)[number];
