'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Alignement horizontal du panneau sur son déclencheur.
 *
 * `stretch` convient à un champ, dont la liste doit faire exactement la largeur.
 * Un menu, lui, est plus large que son bouton : il s'aligne sur un bord —
 * `end` à droite, pour qu'un bouton en fin de barre d'actions n'ouvre pas son
 * panneau hors de l'écran.
 */
type Align = 'stretch' | 'start' | 'end';

const ALIGN: Record<Align, string> = {
  stretch: 'left-0 right-0',
  start: 'left-0',
  end: 'right-0',
};

/**
 * Panneau flottant ancré sous son déclencheur.
 *
 * Il bascule au-dessus quand la place manque en bas de fenêtre — sans quoi un
 * champ situé en bas de formulaire ouvrirait un panneau hors écran, ce qui est
 * exactement le cas des dates d'échéance.
 */
export function Popover({
  open,
  onClose,
  children,
  className,
  labelledBy,
  align = 'stretch',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
  align?: Align;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);

  useEffect(() => {
    if (!open) return;

    const panel = ref.current;
    if (panel) {
      const trigger = panel.parentElement?.getBoundingClientRect();
      const spaceBelow = window.innerHeight - (trigger?.bottom ?? 0);
      setAbove(spaceBelow < panel.offsetHeight + 24 && (trigger?.top ?? 0) > panel.offsetHeight);
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // Le conteneur parent englobe le déclencheur : cliquer dessus ne doit pas
      // fermer puis rouvrir aussitôt.
      if (!ref.current?.parentElement?.contains(target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      aria-labelledby={labelledBy}
      className={cn(
        'absolute z-50 rounded-card border border-line bg-surface shadow-pop',
        'animate-fade-in',
        ALIGN[align],
        above ? 'bottom-full mb-2' : 'top-full mt-2',
        className,
      )}
    >
      {children}
    </div>
  );
}
