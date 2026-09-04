import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  // Orange à 4,55:1 avec du texte blanc — l'orange vif de la marque ne passe
  // pas le contraste AA sous du blanc, il est réservé aux repères graphiques.
  primary: 'bg-brand text-white shadow-card hover:bg-brand-hover hover:shadow-raised',
  secondary:
    'bg-surface text-ink border border-line hover:bg-sand hover:border-line-strong hover:shadow-card',
  ghost: 'text-ink-2 hover:bg-sand hover:text-ink',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

/**
 * Classes du bouton, exposées à part pour qu'un `<Link>` puisse porter
 * exactement la même apparence sans qu'on redéfinisse un second bouton. Une
 * navigation doit rester une vraie ancre : clic milieu, ouverture dans un
 * onglet, menu contextuel.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-[10px] font-semibold',
    // L'enfoncement est la seule animation qui porte une information : elle
    // confirme que le clic a été pris en compte. Le reste (couleur, ombre)
    // ne fait qu'accompagner. Durées courtes et `ease-out` : un bouton doit
    // répondre, pas se donner en spectacle.
    'transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out',
    'active:scale-[0.97] active:duration-75',
    // Sans mouvement : on garde le retour visuel de couleur, on retire le
    // déplacement.
    'motion-reduce:transition-none motion-reduce:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
});
