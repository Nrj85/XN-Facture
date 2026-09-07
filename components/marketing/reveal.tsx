'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './reveal.module.css';

/**
 * Groupe d'éléments qui apparaissent au défilement, l'un après l'autre.
 *
 * Marquez les enfants à révéler avec `data-reveal`, et donnez-leur leur rang
 * par la propriété CSS `--reveal-index` :
 *
 * ```tsx
 * <RevealGroup>
 *   <div data-reveal style={{ '--reveal-index': 0 }}>…</div>
 *   <div data-reveal style={{ '--reveal-index': 1 }}>…</div>
 * </RevealGroup>
 * ```
 *
 * **L'observation s'arrête au premier passage.** Rejouer l'animation à chaque
 * aller-retour de la molette donnerait une page qui clignote dès qu'on la
 * parcourt — c'est le défaut le plus courant de ce procédé.
 */
export function RevealGroup({
  children,
  className,
  /** Fraction de l'élément visible avant déclenchement. */
  threshold = 0.15,
}: {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Navigateur sans `IntersectionObserver` : on montre tout de suite plutôt
    // que de laisser un bloc vide. Une animation manquante se remarque moins
    // qu'un contenu absent.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          // Une seule fois : l'animation raconte l'arrivée du contenu, elle
          // n'a rien à raconter au second passage.
          observer.disconnect();
        }
      },
      // La marge basse retarde un peu le déclenchement : l'élément entre
      // franchement dans l'écran avant de s'animer, au lieu de se révéler
      // alors qu'il affleure à peine le bord.
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      data-shown={shown ? '' : undefined}
      className={[styles.group, className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
