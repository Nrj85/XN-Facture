'use server';

import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/lib/actions/result';

/**
 * Refus et reprise des emails de prospection, depuis un lien reçu par email.
 *
 * ⚠️ **Aucune session n'est requise, et c'est le but.** On clique depuis sa
 * boîte mail, souvent sur un autre appareil que celui où l'on s'est connecté,
 * parfois sans compte ouvert du tout. Exiger une connexion pour se désabonner
 * reviendrait à refuser le désabonnement : c'est le défaut le plus courant du
 * procédé, et celui qui conduit les gens à cliquer sur « indésirable » — ce
 * qui abîme la réputation du domaine d'envoi bien au-delà de la personne
 * concernée.
 *
 * L'autorisation vient donc du **jeton**, aléatoire et propre à chacun, et la
 * fonction `set_marketing_preference` en base est `security definer`. Ce jeton
 * n'ouvre qu'une porte : changer une préférence d'envoi. Il ne donne accès à
 * aucune donnée, n'authentifie personne et ne permet aucune écriture ailleurs.
 */

/**
 * Enregistre le choix et renvoie l'adresse concernée.
 *
 * ⚠️ **Le retour porte l'adresse pour que la page puisse la MONTRER.** Sans
 * elle, on affiche « c'est fait » sans dire pour quelle boîte : quelqu'un qui
 * possède plusieurs adresses ne saurait pas laquelle il vient de retirer, et
 * pourrait croire l'avoir fait pour une autre.
 */
export async function setMarketingPreferenceAction(
  token: string,
  accept: boolean,
): Promise<ActionResult<{ email: string }>> {
  // Contrôle de forme avant l'aller-retour : une chaîne qui n'est pas un UUID
  // ne peut correspondre à aucun jeton, et PostgREST refuserait le paramètre
  // avec un message technique en anglais.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return fail('Ce lien est incomplet ou abîmé. Vérifiez qu’il a été copié en entier.');
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('set_marketing_preference', {
    p_token: token,
    p_accept: accept,
  });

  if (error) {
    return fail('La demande n’a pas abouti. Réessayez dans un instant.');
  }

  // `null` : jeton inconnu, ou compte supprimé depuis l'envoi du message. Un
  // seul message pour les deux cas — les distinguer ferait de cette page un
  // moyen de vérifier si un jeton existe.
  if (!data) {
    return fail('Ce lien n’est plus valable. Il se peut que le compte ait été supprimé.');
  }

  return ok({ email: String(data) });
}
