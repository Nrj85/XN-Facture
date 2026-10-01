'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/db/admin-queries';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { firstIssue } from '@/lib/actions/schemas';

/**
 * Édition des témoignages de la page d'accueil.
 *
 * ⚠️ **LA RÉGÉNÉRATION DE LA LANDING EST LE CŒUR DE CE FICHIER, pas un
 * détail.** `/` est une page STATIQUE : sans `revalidatePath('/')`, un
 * enregistrement réussi n'apparaîtrait **jamais** en ligne, et l'éditeur
 * conclurait que la fonction ne marche pas. Chaque action qui écrit doit
 * l'appeler — y compris la suppression et la simple bascule de publication.
 *
 * ⚠️ **ET LA COQUILLE AUSSI**, pas seulement la page : `(marketing)/layout.tsx`
 * lit le même contenu pour décider d'afficher le lien « Témoignages » de
 * l'en-tête. `revalidatePath('/', 'layout')` couvre les deux d'un coup, là où
 * un `revalidatePath('/')` seul laisserait un lien d'en-tête en désaccord avec
 * la page.
 */

/**
 * ⚠️ **LES BORNES REPRENNENT EXACTEMENT LES CONTRAINTES DE LA MIGRATION 0016.**
 * Elles ne remplacent pas la base — elles la doublent pour que le refus arrive
 * dans le formulaire, en français, avant un aller-retour qui échouerait en
 * `23514` avec un message anglais de Postgres. **Si l'une bouge, l'autre doit
 * bouger** : des bornes qui divergent donneraient un formulaire qui accepte ce
 * que la base refuse.
 */
const temoignageSchema = z.object({
  quote: z
    .string()
    .trim()
    .min(20, 'Le témoignage doit faire au moins 20 caractères.')
    .max(400, 'Le témoignage ne doit pas dépasser 400 caractères : au-delà, la grille de la page d’accueil ne tient plus.'),
  authorName: z
    .string()
    .trim()
    .min(2, 'Le nom est obligatoire.')
    .max(60, 'Le nom ne doit pas dépasser 60 caractères.'),
  authorRole: z
    .string()
    .trim()
    .min(2, 'Précisez l’activité et la ville — c’est ce qui rend le témoignage crédible.')
    .max(80, 'Cette ligne ne doit pas dépasser 80 caractères.'),
  position: z.number().int().min(0).max(999),
  published: z.boolean(),
});

export type TemoignageSaisi = z.infer<typeof temoignageSchema>;

/**
 * Garde commune.
 *
 * ⚠️ **ELLE NE REMPLACE PAS LA RLS, elle la double.** Les politiques de 0016
 * refusent déjà toute écriture à qui n'est pas administrateur — vérifié : un
 * client ordinaire connecté obtient `42501` à l'insertion et **0 ligne** sur
 * une mise à jour. Ce contrôle-ci existe pour que le refus soit une phrase
 * française à l'écran plutôt qu'une erreur Postgres, et pour qu'on n'envoie
 * pas une écriture dont on sait qu'elle sera rejetée.
 */
async function exigeAdmin(): Promise<string | null> {
  return (await isPlatformAdmin())
    ? null
    : 'Réservé aux administrateurs de la plateforme.';
}

/** Régénère la page d'accueil ET sa coquille. Voir l'avertissement en tête. */
function regenererLanding() {
  revalidatePath('/', 'layout');
}

export async function createTestimonial(saisi: unknown): Promise<ActionResult<undefined>> {
  const refus = await exigeAdmin();
  if (refus) return fail(refus);

  const parsed = temoignageSchema.safeParse(saisi);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { error } = await createClient().from('site_testimonials').insert({
    quote: parsed.data.quote,
    author_name: parsed.data.authorName,
    author_role: parsed.data.authorRole,
    position: parsed.data.position,
    published: parsed.data.published,
  });
  if (error) return fail('Le témoignage n’a pas pu être ajouté. Réessayez.');

  regenererLanding();
  return ok();
}

export async function updateTestimonial(
  id: string,
  saisi: unknown,
): Promise<ActionResult<undefined>> {
  const refus = await exigeAdmin();
  if (refus) return fail(refus);

  const parsed = temoignageSchema.safeParse(saisi);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  // ⚠️ `select()` après l'`update` pour COMPTER les lignes touchées. Sans lui,
  // une mise à jour que la RLS a entièrement filtrée revient sans erreur — et
  // l'écran annoncerait « enregistré » alors que rien n'a bougé. C'est le même
  // piège que le 204 de PostgREST, consigné en section 1 de CLAUDE.md.
  const { data, error } = await createClient()
    .from('site_testimonials')
    .update({
      quote: parsed.data.quote,
      author_name: parsed.data.authorName,
      author_role: parsed.data.authorRole,
      position: parsed.data.position,
      published: parsed.data.published,
    })
    .eq('id', id)
    .select('id');

  if (error) return fail('La modification n’a pas pu être enregistrée. Réessayez.');
  if (!data || data.length === 0) return fail('Ce témoignage n’existe plus. Rechargez la page.');

  regenererLanding();
  return ok();
}

export async function deleteTestimonial(id: string): Promise<ActionResult<undefined>> {
  const refus = await exigeAdmin();
  if (refus) return fail(refus);

  const { data, error } = await createClient()
    .from('site_testimonials')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) return fail('La suppression n’a pas abouti. Réessayez.');
  if (!data || data.length === 0) return fail('Ce témoignage n’existe plus. Rechargez la page.');

  regenererLanding();
  return ok();
}

/**
 * Publier ou retirer, sans repasser par le formulaire.
 *
 * C'est le geste le plus fréquent — on écrit une fois, on publie et on retire
 * souvent — et le seul qui change ce que voit le public. Le séparer de
 * `updateTestimonial` évite d'avoir à renvoyer les trois textes pour changer un
 * booléen, donc évite d'écraser par mégarde une saisie en cours.
 */
export async function setTestimonialPublished(
  id: string,
  published: boolean,
): Promise<ActionResult<undefined>> {
  const refus = await exigeAdmin();
  if (refus) return fail(refus);

  const { data, error } = await createClient()
    .from('site_testimonials')
    .update({ published })
    .eq('id', id)
    .select('id');

  if (error) return fail('Le changement n’a pas pu être enregistré. Réessayez.');
  if (!data || data.length === 0) return fail('Ce témoignage n’existe plus. Rechargez la page.');

  regenererLanding();
  return ok();
}
