'use client';

import { useState } from 'react';
import { ChevronDown, Info, type LucideIcon } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { StatusBadge, type BadgeStatus } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

/**
 * Menu de changement de statut.
 *
 * Chaque entrée est nommée par la **transition**, pas par l'état : « Marquer
 * comme payée », et non « Payée ». La nuance n'est pas cosmétique — une liste
 * déroulante d'états laisse croire qu'on choisit une valeur parmi d'autres,
 * alors qu'on déclenche une opération qui, ici, attribue un numéro ou solde un
 * encaissement. Les libellés disent ce qui va se produire.
 *
 * Les transitions impossibles ne sont pas grisées, elles sont **absentes** :
 * un devis refusé n'a rien à faire d'un « Marquer comme payé », et proposer
 * l'inapplicable oblige à lire avant de cliquer.
 */
export interface StatusAction {
  /** Libellé à l'infinitif ou à l'impératif : ce que le clic va faire. */
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Explication courte, quand la conséquence n'est pas évidente. */
  hint?: string;
  /** Sépare les corrections et annulations des avancements normaux. */
  group?: 'advance' | 'correct';
}

export function StatusMenu({
  status,
  statusLabel,
  actions,
  footnote,
  className,
}: {
  /** Statut courant, rappelé en tête du panneau. */
  status: BadgeStatus;
  statusLabel?: string;
  actions: StatusAction[];
  /** Précision affichée en pied de panneau (les statuts dérivés, typiquement). */
  footnote?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const advance = actions.filter((action) => action.group !== 'correct');
  const correct = actions.filter((action) => action.group === 'correct');

  const item = (action: StatusAction) => {
    const Icon = action.icon;
    return (
      <li key={action.label}>
        <button
          type="button"
          onClick={() => {
            action.onSelect();
            setOpen(false);
          }}
          className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-sand"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.9} aria-hidden />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">{action.label}</span>
            {action.hint && (
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">
                {action.hint}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-ink',
          'transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out',
          'hover:border-line-strong hover:bg-sand hover:shadow-card',
          'active:scale-[0.97] active:duration-75',
          'motion-reduce:transition-none motion-reduce:active:scale-100',
        )}
      >
        Changer le statut
        <ChevronDown
          className={cn(
            'h-4 w-4 text-ink-3 transition-transform duration-200 ease-out motion-reduce:transition-none',
            open && '-rotate-180',
          )}
          aria-hidden
        />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} align="end" className="w-[276px]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
          <span className="label-caps">Statut actuel</span>
          <StatusBadge status={status} label={statusLabel} />
        </div>

        {actions.length === 0 ? (
          <p className="px-3 py-3 text-[12.5px] text-ink-3">
            Aucun changement possible depuis ce statut.
          </p>
        ) : (
          <ul className="py-1" role="menu">
            {advance.map(item)}
            {correct.length > 0 && advance.length > 0 && (
              <li className="my-1 border-t border-line" role="separator" />
            )}
            {correct.map(item)}
          </ul>
        )}

        {footnote && (
          <p className="flex items-start gap-1.5 border-t border-line px-3 py-2.5 text-[11.5px] leading-snug text-ink-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {footnote}
          </p>
        )}
      </Popover>
    </div>
  );
}
