import type { LucideIcon } from 'lucide-react';
import styles from './info-card.module.css';

export interface InfoItem {
  icon: LucideIcon;
  title: string;
  text: string;
  /** Ton du carré d'icône : accentué, doux, ou neutre. */
  badge?: 'brand' | 'soft' | 'sand';
  /** Numéro d'étape en filigrane, pour la section « Comment ça marche ». */
  step?: string;
}

/**
 * Grille de cartes à icône.
 *
 * `columns` fixe la largeur maximale ; en dessous de 640 px la grille passe à
 * une colonne quoi qu'il arrive. C'est la règle mobile d'abord : trois cartes
 * côte à côte sur un téléphone donnent trois colonnes de texte illisibles.
 */
export function InfoCardGrid({
  items,
  columns = 3,
  onSurface = false,
}: {
  items: InfoItem[];
  columns?: 3 | 4;
  /** La grille est posée sur un fond blanc : les cartes passent en papier. */
  onSurface?: boolean;
}) {
  return (
    <div className={`${styles.grid} ${columns === 4 ? styles.cols4 : styles.cols3}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const badge =
          item.badge === 'soft'
            ? styles.softBadge
            : item.badge === 'sand'
              ? styles.sandBadge
              : styles.brandBadge;

        return (
          <article
            key={item.title}
            className={`${styles.card} ${onSurface ? styles.onSurface : ''}`}
          >
            {item.step && (
              <span className={styles.step} aria-hidden>
                {item.step}
              </span>
            )}
            <span className={`${styles.badge} ${badge}`} aria-hidden>
              <Icon size={21} strokeWidth={1.9} />
            </span>
            <h3 className={styles.cardTitle}>{item.title}</h3>
            <p className={styles.cardText}>{item.text}</p>
          </article>
        );
      })}
    </div>
  );
}
