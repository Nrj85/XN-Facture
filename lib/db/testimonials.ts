import { createClient, createIsolatedClient } from '@/lib/supabase/server';
import type { Testimonial } from '@/lib/testimonials';

/**
 * Lectures des témoignages — **côté serveur uniquement**.
 *
 * ⚠️ **SÉPARÉ DE `lib/testimonials.ts`, et il faut que cela le reste.** Ce
 * fichier importe `lib/supabase/server.ts`, donc `next/headers` : tout
 * composant CLIENT qui l'importerait ferait échouer le build. Le type et les
 * initiales vivent dans l'autre module, sans aucune dépendance au serveur.
 */

type Row = {
  id: string;
  quote: string;
  author_name: string;
  author_role: string;
  position: number;
  published: boolean;
};

const toTestimonial = (row: Row): Testimonial => ({
  id: row.id,
  quote: row.quote,
  authorName: row.author_name,
  authorRole: row.author_role,
  position: row.position,
  published: row.published,
});

const COLONNES = 'id, quote, author_name, author_role, position, published';

/**
 * Les témoignages PUBLIÉS, pour la page d'accueil.
 *
 * ⚠️ **CLIENT SANS COOKIE, ET C'EST CE QUI GARDE LA LANDING STATIQUE.**
 * `createClient()` appelle `cookies()`, une API dynamique : l'utiliser ici
 * ferait basculer `/` en rendu à la requête, et la page passerait de **1,81 ko
 * servis depuis le cache** à un rendu serveur par visiteur. C'est une décision
 * documentée du projet — la première page que voit un prospect sur un réseau
 * lent ne doit rien attendre — et elle ne doit pas tomber pour un texte
 * d'accroche.
 *
 * `createIsolatedClient()` ne touche aucun cookie, donc Next continue de
 * prérendre la page ; elle est régénérée par le `revalidatePath('/', 'layout')`
 * des actions d'administration.
 *
 * **Le contrôle qui tranche est la sortie de `npm run build`** : `○ /`, et non
 * `ƒ /`.
 *
 * ⚠️ **UN ÉCHEC NE FAIT PAS TOMBER LA PAGE.** Si la base est injoignable au
 * moment de la régénération, on rend une liste vide et la section disparaît —
 * la page d'accueil continue de s'afficher. Laisser l'erreur remonter ferait
 * échouer le rendu de la landing entière pour une section d'agrément.
 */
export async function getPublishedTestimonials(): Promise<Testimonial[]> {
  try {
    const { data, error } = await createIsolatedClient()
      .from('site_testimonials')
      .select(COLONNES)
      .eq('published', true)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<Row[]>();

    if (error) return [];
    return (data ?? []).map(toTestimonial);
  } catch {
    return [];
  }
}

/**
 * Tous les témoignages, publiés ou non — pour l'écran d'administration.
 *
 * Ici on passe par `createClient()` : la session est nécessaire, c'est elle qui
 * porte le droit. La RLS ne rend les lignes non publiées qu'à un administrateur
 * de plateforme (`site_testimonials_select_auth`, migration 0016), donc cette
 * fonction reste sûre même appelée depuis un autre écran.
 */
export async function getAllTestimonials(): Promise<Testimonial[]> {
  const { data, error } = await createClient()
    .from('site_testimonials')
    .select(COLONNES)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<Row[]>();

  if (error) throw new Error(`Lecture des témoignages impossible : ${error.message}`);
  return (data ?? []).map(toTestimonial);
}
