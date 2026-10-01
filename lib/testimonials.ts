/**
 * Témoignages de la page d'accueil — **partie utilisable des DEUX CÔTÉS**.
 *
 * ⚠️ **CE FICHIER NE DOIT RIEN IMPORTER DU SERVEUR.** Les lectures en base
 * vivent dans `lib/db/testimonials.ts` ; ici il n'y a que le type et une
 * fonction pure. La raison est un échec de compilation déjà payé :
 *
 *     You're importing a component that needs "next/headers".
 *     Import trace: lib/supabase/server.ts → lib/testimonials.ts
 *                   → components/admin/testimonials-editor.tsx
 *
 * L'éditeur est un composant CLIENT et a besoin du type et des initiales. Tant
 * que les requêtes étaient dans ce fichier, les importer tirait
 * `lib/supabase/server.ts`, donc `next/headers`, dans le bundle client — et le
 * build échouait en désignant l'importateur, pas le fautif.
 *
 * **C'est la même séparation que `lib/i18n/dictionaries.ts` et `index.ts`**,
 * et pour la même raison. Ne pas la défaire.
 */

export type Testimonial = {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  position: number;
  published: boolean;
};

/**
 * Initiales de l'avatar, **dérivées du nom** plutôt que saisies.
 *
 * La version en dur portait un champ `initials` distinct (« AN », « KM »,
 * « FE »). Le supprimer retire un champ du formulaire — ce qui compte quand on
 * saisit sur un téléphone — et surtout rend impossible l'incohérence d'un
 * « KM » resté sous un nom qu'on vient de changer.
 *
 * Deux lettres au plus : au-delà, elles ne tiennent plus dans le rond et
 * rétrécissent au point d'être illisibles.
 */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? '')
    .join('');
}
