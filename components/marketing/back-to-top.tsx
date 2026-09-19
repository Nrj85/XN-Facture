'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import styles from './back-to-top.module.css';

/**
 * Retour en haut de page, pour les pages publiques.
 *
 * La landing fait plusieurs écrans de haut, et les trois pages légales sont de
 * longs textes : arrivé en bas, il fallait remonter à la molette ou au pouce
 * sur toute la hauteur. L'en-tête est bien collant, mais rien n'y ramène.
 *
 * ⚠️ **Il APPARAÎT, il n'est pas toujours là.** Posé en permanence, il
 * masquerait un coin de la page d'accueil alors qu'il n'y sert à rien — on est
 * déjà en haut. Le seuil est **une hauteur d'écran** : il se montre quand le
 * premier écran est passé, ce qui se règle tout seul du téléphone au grand
 * moniteur, là où un seuil en pixels serait juste sur l'un et faux sur l'autre.
 *
 * ⚠️ **Écouteur `passive`, et l'état ne change que sur bascule.** React
 * n'attribue pas un nouveau rendu quand on réécrit le même booléen : le
 * défilement ne coûte donc qu'une comparaison. C'est le même motif que
 * `site-header`, délibérément — deux mécaniques différentes pour la même chose
 * auraient fini par diverger.
 *
 * ⚠️ **Le focus est déplacé, pas seulement la page.** Sans cela, après le clic
 * le focus resterait sur un bouton devenu invisible : au clavier on repartirait
 * du bas de la page, et un lecteur d'écran continuerait d'annoncer le pied de
 * page. Il est donc posé sur l'ancre `#haut`, au début du document.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function remonter() {
    // Instantané quand le système demande moins de mouvement : un défilement
    // animé sur toute la hauteur d'une page est précisément ce que ce réglage
    // vise à éviter.
    const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sobre ? 'auto' : 'smooth' });

    const haut = document.getElementById('haut');
    if (haut) haut.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      onClick={remonter}
      // `visibility: hidden` le retire aussi de l'ordre de tabulation : sans
      // cela, on tabulerait sur un bouton qu'on ne voit pas.
      className={`${styles.bouton} ${visible ? styles.visible : ''}`}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp size={20} strokeWidth={2.2} aria-hidden />
      <span className={styles.sr}>Revenir en haut de la page</span>
    </button>
  );
}
