'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Modale bâtie sur l'élément `<dialog>` natif.
 *
 * `showModal()` fournit gratuitement ce qu'une modale reconstruite à la main
 * rate presque toujours : piégeage du focus, retour du focus à l'élément
 * déclencheur, fermeture par Échap, et inertie du reste de la page pour les
 * technologies d'assistance.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        // Échap : on laisse React piloter l'état plutôt que le DOM.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clic sur le fond (la zone du <dialog> hors de son contenu).
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'w-[calc(100vw-2rem)] max-w-lg rounded-card border border-line bg-surface p-0 text-ink shadow-pop',
        'backdrop:bg-ink/40',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-[12.5px] text-ink-2">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-2 transition-[background-color,transform] duration-150 ease-out hover:bg-sand hover:text-ink active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Fermer</span>
        </button>
      </div>

      {children && <div className="px-5 py-4">{children}</div>}

      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}

/** Confirmation d'une action destructrice. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Supprimer',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="max-w-md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-status-overdue text-white hover:bg-status-overdue/90"
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
