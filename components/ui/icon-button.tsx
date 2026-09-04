import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'text-ink-2 hover:bg-sand hover:text-ink',
  brand: 'text-brand hover:bg-brand-soft hover:text-brand-hover',
  // Le rouge ne s'installe qu'au survol : une rangée de poubelles rouges au
  // repos crie au danger là où il n'y en a pas encore.
  danger: 'text-ink-2 hover:bg-status-overdue-bg hover:text-status-overdue',
};

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Libellé lu par les technologies d'assistance et affiché en infobulle. */
  label: string;
  tone?: Tone;
}

/**
 * Bouton-icône : 36 × 36 px, soit la cible tactile minimale du design système.
 *
 * Le libellé n'est jamais optionnel — un bouton qui ne porte qu'un pictogramme
 * est muet pour un lecteur d'écran. Il sert aussi de `title`, ce qui lève
 * l'ambiguïté à la souris.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, tone = 'neutral', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={label}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
        'transition-[background-color,color,transform] duration-150 ease-out',
        'active:scale-90 active:duration-75',
        'motion-reduce:transition-none motion-reduce:active:scale-100',
        'disabled:pointer-events-none disabled:opacity-40',
        TONES[tone],
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  );
});
