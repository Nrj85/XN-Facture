'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/db/queries';
import { deleteLetterhead, saveLetterhead, LETTERHEAD_MAX_CARACTERES } from '@/lib/db/letterhead';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { firstIssue } from '@/lib/actions/schemas';

/**
 * Réglages du papier à en-tête.
 *
 * ⚠️ **ACTION DÉDIÉE, et non un ajout à `companySchema`.** Le formulaire
 * d'entreprise envoie l'objet entier : y glisser l'image signifierait la
 * remonter au navigateur puis la renvoyer à chaque enregistrement des
 * paramètres, pour quelques centaines de kilo-octets qui n'ont pas changé. Ici
 * l'image n'est transmise **que** lorsqu'on en téléverse une nouvelle.
 */

const schema = z
  .object({
    mode: z.enum(['none', 'preprinted', 'image']),
    topMm: z
      .number()
      .int('La marge s’exprime en millimètres entiers.')
      .min(0)
      .max(120, 'Au-delà de 120 mm il ne resterait plus de place pour la facture.'),
    bottomMm: z
      .number()
      .int('La marge s’exprime en millimètres entiers.')
      .min(0)
      .max(80, 'Au-delà de 80 mm il ne resterait plus de place pour la facture.'),
    keepLegal: z.boolean(),
    /**
     * Même liste blanche que le logo — **c'est le SSRF du 26 sept. 2026**.
     * Cette valeur finit dans `<Image src={…} />` de `@react-pdf`, qui va
     * chercher une URL distante depuis le serveur. `image/svg+xml` est exclu :
     * un SVG est un document, il porte du script.
     */
    dataUrl: z
      .string()
      .max(LETTERHEAD_MAX_CARACTERES, 'Image trop lourde. Réduisez-la avant de la téléverser.')
      .regex(
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
        'En-tête invalide : seule une image importée depuis cet écran est acceptée.',
      )
      .optional(),
    /**
     * Une image est-elle DÉJÀ enregistrée ?
     *
     * ⚠️ **Ce drapeau vient du client, donc il ne décide d'aucun droit** — il
     * ne sert qu'à formuler le refus ci-dessous. Le mentir n'ouvre rien : au
     * pire on passe en mode `image` sans image, et le PDF retombe sur le même
     * rendu que `preprinted` (espace réservé, aucun dessin). Aucune donnée
     * n'est exposée, aucune règle n'est contournée.
     */
    aDejaUneImage: z.boolean().optional(),
  })
  // ⚠️ **ON NE CHOISIT PAS « en-tête téléversé » SANS IMAGE.** Sans cette
  // règle, le mode serait actif, le PDF réserverait l'espace et n'y dessinerait
  // rien : une facture avec un grand vide en haut, et rien à l'écran pour dire
  // pourquoi — le contrôle mort du §6.1, sur un document remis à un client.
  .refine((v) => v.mode !== 'image' || v.dataUrl !== undefined || v.aDejaUneImage === true, {
    message: 'Téléversez d’abord votre en-tête, ou choisissez « papier pré-imprimé ».',
    path: ['dataUrl'],
  });

export type ReglageEnTete = {
  mode: 'none' | 'preprinted' | 'image';
  topMm: number;
  bottomMm: number;
  keepLegal: boolean;
  dataUrl?: string;
  /** Une image est-elle déjà enregistrée ? Décidé par le serveur, pas par le client. */
  aDejaUneImage?: boolean;
};

export async function updateLetterheadAction(saisi: unknown): Promise<ActionResult<undefined>> {
  const session = await requireSession();

  const parsed = schema.safeParse(saisi);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data as ReglageEnTete;

  const supabase = createClient();

  // ⚠️ `select()` après l'`update` pour COMPTER les lignes touchées. Une mise à
  // jour que la RLS filtre entièrement revient sans erreur — l'écran annoncerait
  // « enregistré » alors que rien n'a bougé. Même piège que le 204 de PostgREST.
  const { data, error } = await supabase
    .from('companies')
    .update({
      letterhead_mode: v.mode,
      letterhead_top_mm: v.topMm,
      letterhead_bottom_mm: v.bottomMm,
      letterhead_keep_legal: v.keepLegal,
    })
    .eq('id', session.companyId)
    .select('id');

  if (error) return fail('Les réglages n’ont pas pu être enregistrés. Réessayez.');
  if (!data || data.length === 0) return fail('Entreprise introuvable. Rechargez la page.');

  if (v.dataUrl) {
    if (!(await saveLetterhead(session.companyId, v.dataUrl))) {
      return fail('L’en-tête n’a pas pu être enregistré. Réessayez.');
    }
  }

  // ⚠️ **ON NE SUPPRIME L'IMAGE QUE SUR DEMANDE EXPLICITE**, jamais parce que
  // le mode a changé. Quelqu'un qui bascule en « papier pré-imprimé » pour un
  // temps retrouve son en-tête en revenant — perdre un fichier téléversé parce
  // qu'on a coché autre chose serait une mauvaise surprise.
  revalidatePath('/parametres');
  return ok();
}

/** Retire l'image téléversée, et retombe sur le mode « aucun ». */
export async function removeLetterheadAction(): Promise<ActionResult<undefined>> {
  const session = await requireSession();

  if (!(await deleteLetterhead(session.companyId))) {
    return fail('L’en-tête n’a pas pu être retiré. Réessayez.');
  }

  // Le mode retombe à `none` : laisser `image` sans image produirait un
  // document au grand vide en haut, sans rien pour l'expliquer (§6.1).
  await createClient()
    .from('companies')
    .update({ letterhead_mode: 'none' })
    .eq('id', session.companyId);

  revalidatePath('/parametres');
  return ok();
}
