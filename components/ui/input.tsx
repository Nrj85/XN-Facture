import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const BASE =
  'h-10 w-full rounded-[10px] border bg-surface px-3 text-[13px] text-ink transition-colors duration-150 placeholder:text-ink-3 disabled:bg-sand disabled:text-ink-3';

const TONE = {
  normal: 'border-line hover:border-line-strong',
  invalid: 'border-status-overdue-dot',
} as const;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Aligne les chiffres — obligatoire sur tout montant, quantité ou date. */
  numeric?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, numeric, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(BASE, TONE[invalid ? 'invalid' : 'normal'], numeric && 'tabular', className)}
      {...props}
    />
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/**
 * `<select>` natif habillé plutôt qu'un menu reconstruit : accessible au clavier
 * et aux lecteurs d'écran sans une ligne de JavaScript, et il ouvre le sélecteur
 * système sur téléphone — ce qui compte pour cette audience.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          BASE,
          TONE[invalid ? 'invalid' : 'normal'],
          'cursor-pointer appearance-none pr-9',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8l4 4 4-4" />
      </svg>
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-[10px] border bg-surface px-3 py-2.5 text-[13px] text-ink transition-colors duration-150 placeholder:text-ink-3',
        TONE[invalid ? 'invalid' : 'normal'],
        className,
      )}
      {...props}
    />
  );
});
