'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface FieldProps {
  label: string;
  /** Marque le champ comme obligatoire, visuellement et pour les lecteurs d'écran. */
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: { id: string; 'aria-describedby': string | undefined }) => React.ReactNode;
}

/**
 * Enveloppe libellé + champ + message. Le libellé est toujours lié au champ par
 * un `id` généré, et le message d'erreur lui est rattaché par `aria-describedby`
 * — sans quoi un lecteur d'écran annonce le champ sans jamais dire pourquoi il
 * est refusé.
 */
export function Field({ label, required, error, hint, className, children }: FieldProps) {
  const id = useId();
  const messageId = error || hint ? `${id}-message` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[12.5px] font-medium text-ink-2">
        {label}
        {required && (
          <span className="ml-0.5 text-status-overdue-dot" aria-hidden>
            *
          </span>
        )}
      </label>

      {children({ id, 'aria-describedby': messageId })}

      {(error || hint) && (
        <p
          id={messageId}
          className={cn('text-[11.5px]', error ? 'font-medium text-status-overdue' : 'text-ink-3')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
