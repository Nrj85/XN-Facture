import { initials, type Testimonial } from '@/lib/testimonials';
import styles from './testimonials.module.css';

/**
 * Témoignages.
 *
 * ⚠️ **LE CONTENU NE VIT PLUS ICI — il vient de la base** (`site_testimonials`,
 * migration 0016) et se modifie depuis `/admin/temoignages`. Ce composant ne
 * fait plus que peindre ce qu'on lui donne.
 *
 * Avant le 1er oct. 2026, trois témoignages étaient écrits en dur dans ce
 * fichier. **Ils étaient inventés** — CLAUDE.md les signalait depuis le
 * 5 sept. comme la dernière fabrication visible du produit. Ils sont désormais
 * en base **non publiés** : ils ne s'affichent plus, et restent disponibles
 * comme gabarit à réécrire.
 *
 * ⚠️ **L'APPELANT NE DOIT PAS MONTER CE COMPOSANT AVEC UNE LISTE VIDE.** Ce
 * n'est pas lui qui décide d'afficher ou non la section : une grille vide
 * laisserait un titre « Ce qu'en disent les premiers utilisateurs » suivi de
 * rien, ce qui est pire que l'absence de section. `app/(marketing)/page.tsx`
 * omet la `Section` entière quand il n'y a aucun témoignage publié.
 */
export function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <div className={styles.grid}>
      {items.map((avis) => (
        <figure key={avis.id} className={styles.card}>
          <blockquote className={styles.quote}>« {avis.quote} »</blockquote>
          <figcaption className={styles.author}>
            <span className={styles.avatar} aria-hidden>
              {initials(avis.authorName)}
            </span>
            <span>
              <p className={styles.name}>{avis.authorName}</p>
              <p className={styles.role}>{avis.authorRole}</p>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
