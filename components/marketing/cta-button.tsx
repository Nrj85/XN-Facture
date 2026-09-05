import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import styles from './cta-button.module.css';

/**
 * Appel à l'action de la landing — **un seul composant pour tous les boutons
 * de la page**, du bandeau d'en-tête au pied de section.
 *
 * Il rend un `<Link>` et jamais un `<button>` : ces boutons mènent tous
 * quelque part. Un `<button>` aurait retiré le clic milieu, l'ouverture dans
 * un onglet et l'aperçu de l'URL au survol.
 */
export function CtaButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon = ArrowRight,
  showIcon = true,
  pulse = false,
  block = false,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  showIcon?: boolean;
  /** Halo pulsé — réservé à l'action principale, une seule par écran. */
  pulse?: boolean;
  block?: boolean;
  /** Refermer le tiroir mobile avant de naviguer, typiquement. */
  onClick?: () => void;
}) {
  const classes = [
    styles.base,
    styles[variant],
    size === 'sm' ? styles.sm : '',
    pulse ? styles.pulse : '',
    block ? styles.block : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link href={href} className={classes} onClick={onClick}>
      <span>{children}</span>
      {showIcon && <Icon className={styles.icon} size={17} strokeWidth={2.1} aria-hidden />}
    </Link>
  );
}
