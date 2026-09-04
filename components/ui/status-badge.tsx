import { STATUS_LABELS } from '@/lib/invoices';
import type { DisplayStatus, QuoteDisplayStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Tout ce qu'un badge sait rendre : statuts de facture et de devis. */
export type BadgeStatus = DisplayStatus | QuoteDisplayStatus;

/**
 * Chaque statut porte un point coloré ET un libellé : l'information n'est jamais
 * transmise par la couleur seule. Les fonds sont teintés et les textes vérifiés
 * au-dessus de 6:1.
 *
 * Les statuts de devis réemploient les mêmes trios que les factures, avec la
 * même lecture : vert « c'est acquis », rouge « c'est perdu », gris « c'est
 * inerte ». Aucun jeu de couleurs supplémentaire n'a été introduit — deux verts
 * proches seraient impossibles à distinguer et n'apprendraient rien de plus.
 */
const STYLES: Record<BadgeStatus, { pill: string; dot: string }> = {
  paid: { pill: 'bg-status-paid-bg text-status-paid', dot: 'bg-status-paid-dot' },
  sent: { pill: 'bg-status-sent-bg text-status-sent', dot: 'bg-status-sent-dot' },
  draft: { pill: 'bg-status-draft-bg text-status-draft', dot: 'bg-status-draft-dot' },
  overdue: { pill: 'bg-status-overdue-bg text-status-overdue', dot: 'bg-status-overdue-dot' },
  cancelled: { pill: 'bg-status-draft-bg text-status-draft line-through', dot: 'bg-status-draft-dot' },
  accepted: { pill: 'bg-status-paid-bg text-status-paid', dot: 'bg-status-paid-dot' },
  converted: { pill: 'bg-status-paid-bg text-status-paid', dot: 'bg-status-paid-dot' },
  refused: { pill: 'bg-status-overdue-bg text-status-overdue', dot: 'bg-status-overdue-dot' },
  expired: { pill: 'bg-status-draft-bg text-status-draft', dot: 'bg-status-draft-dot' },
};

/**
 * Libellés par défaut, au féminin (une facture). Un devis passe son propre
 * `label` : « envoyé » ne s'accorde pas comme « envoyée », et un badge qui se
 * trompe de genre trahit tout de suite le gabarit générique.
 */
const DEFAULT_LABELS: Record<BadgeStatus, string> = {
  ...STATUS_LABELS,
  accepted: 'Accepté',
  converted: 'Facturé',
  refused: 'Refusé',
  expired: 'Expiré',
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: BadgeStatus;
  label?: string;
  className?: string;
}) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        style.pill,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} aria-hidden />
      {label ?? DEFAULT_LABELS[status]}
    </span>
  );
}
