'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';

/**
 * Menu d'actions en pointillés (⋯), ancré sur son bouton.
 *
 * **Pourquoi une primitive de plus alors que `Popover` existe.** `Popover` se
 * positionne en `absolute` dans le flux : posé dans une cellule de tableau, il
 * est rogné par le `overflow-x-auto` qui entoure ce tableau. C'est exactement
 * la raison pour laquelle les actions rapides des listes sont posées à plat
 * (voir `invoice-quick-actions.tsx`). Ici le panneau est rendu dans un
 * **portail sur `document.body`**, en `fixed` : plus aucun ancêtre ne peut le
 * découper, et un menu redevient possible là où il était interdit.
 *
 * Le panneau se replace au défilement et au redimensionnement plutôt que de
 * se fermer : sur un tableau qu'on fait glisser latéralement, un menu qui
 * disparaît au moindre mouvement est plus agaçant qu'utile.
 */
export interface MenuAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Explication courte, quand la conséquence n'est pas évidente. */
  hint?: string;
  /** `danger` colore l'entrée au survol — suppression, annulation. */
  tone?: 'neutral' | 'danger';
  /** Trace un filet au-dessus : sépare les corrections des avancements. */
  separated?: boolean;
  disabled?: boolean;
}

const MARGE = 8;
const LARGEUR = 244;

export function ActionMenu({
  actions,
  label = 'Actions',
  title,
  className,
}: {
  actions: MenuAction[];
  label?: string;
  /** Titre du panneau — rappelle sur quoi porte le menu. */
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const hauteur = panelRef.current?.offsetHeight ?? 0;
    const placeEnBas = window.innerHeight - trigger.bottom;
    const above = hauteur > 0 && placeEnBas < hauteur + MARGE && trigger.top > hauteur + MARGE;

    // Aligné à droite sur le bouton, puis ramené dans la fenêtre : un menu en
    // fin de ligne déborderait sinon par la droite sur les écrans étroits.
    const left = Math.min(
      Math.max(MARGE, trigger.right - LARGEUR),
      window.innerWidth - LARGEUR - MARGE,
    );
    setPos({
      top: above ? trigger.top - hauteur - MARGE : trigger.bottom + MARGE,
      left,
      above,
    });
  }, []);

  // `useLayoutEffect` : mesurer puis positionner avant la peinture, sinon le
  // panneau apparaît une image au mauvais endroit.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const cible = event.target as Node;
      if (panelRef.current?.contains(cible) || triggerRef.current?.contains(cible)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const utilisables = actions.filter((action) => !action.disabled);

  return (
    <>
      <IconButton
        ref={triggerRef}
        icon={MoreHorizontal}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={className}
        onClick={(event) => {
          // La ligne entière est un raccourci vers le détail : ouvrir le menu
          // ne doit pas accessoirement ouvrir la facture.
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      />

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={title ?? label}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: LARGEUR }}
            className={cn(
              'fixed z-50 rounded-card border border-line bg-surface shadow-pop animate-fade-in',
              pos ? 'visible' : 'invisible',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {title && (
              <p className="label-caps truncate border-b border-line px-3 py-2.5">{title}</p>
            )}

            {utilisables.length === 0 ? (
              <p className="px-3 py-3 text-[12.5px] text-ink-3">Aucune action disponible.</p>
            ) : (
              <ul className="py-1">
                {utilisables.map((action) => {
                  const Icon = action.icon;
                  return (
                    <li
                      key={action.label}
                      className={action.separated ? 'mt-1 border-t border-line pt-1' : undefined}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpen(false);
                          action.onSelect();
                        }}
                        className={cn(
                          'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-150',
                          action.tone === 'danger'
                            ? 'hover:bg-status-overdue-bg'
                            : 'hover:bg-sand',
                        )}
                      >
                        <Icon
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            action.tone === 'danger' ? 'text-status-overdue' : 'text-ink-3',
                          )}
                          strokeWidth={1.9}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block text-[13px] font-medium',
                              action.tone === 'danger' ? 'text-status-overdue' : 'text-ink',
                            )}
                          >
                            {action.label}
                          </span>
                          {action.hint && (
                            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">
                              {action.hint}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
