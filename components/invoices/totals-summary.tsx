'use client';

import type { InvoiceTotals } from '@/lib/invoice-calc';

import { useCompany } from '@/lib/company-context';
import { totalsBlock } from '@/lib/vat';
import { cn } from '@/lib/utils';

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', strong && 'pt-2.5')}>
      <span
        className={cn(
          strong ? 'text-[13px] font-semibold text-ink' : 'text-[12.5px] text-ink-2',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'tabular',
          strong
            ? 'text-[17px] font-bold tracking-[-0.02em] text-ink'
            : 'text-[13px] font-medium text-ink',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * ⚠️ **`vatExempt` n'est pas déduit de `totals`, il est reçu.** Un taux à zéro
 * ne suffit pas à conclure : une entreprise assujettie peut légitimement
 * facturer à 0 % (exportation, produit exonéré), et elle doit alors voir la
 * ligne « TVA 0 % ». Seul le document sait s'il est hors du champ de la taxe.
 */
export function TotalsSummary({
  totals,
  vatExempt = false,
  className,
}: {
  totals: InvoiceTotals;
  vatExempt?: boolean;
  className?: string;
}) {
  const { formatMoney } = useCompany();
  const bloc = totalsBlock(totals, vatExempt);

  return (
    <div className={cn('space-y-2', className)}>
      {bloc.rows.map((row) => (
        <Row key={row.label} label={row.label} value={formatMoney(row.amount)} />
      ))}
      <div className="border-t border-line">
        <Row label={bloc.totalLabel} value={formatMoney(bloc.totalAmount)} strong />
      </div>
      {bloc.mention && <p className="text-[11.5px] text-ink-3">{bloc.mention}</p>}
    </div>
  );
}
