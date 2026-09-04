'use client';

import type { InvoiceTotals } from '@/lib/invoice-calc';

import { useCompany } from '@/lib/company-context';
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

export function TotalsSummary({
  totals,
  className,
}: {
  totals: InvoiceTotals;
  className?: string;
}) {
  const { formatMoney } = useCompany();
  return (
    <div className={cn('space-y-2', className)}>
      <Row label="Sous-total HT" value={formatMoney(totals.subtotal)} />
      <Row
        label={`TVA ${totals.vatRate.toString().replace('.', ',')} %`}
        value={formatMoney(totals.vatAmount)}
      />
      <div className="border-t border-line">
        <Row label="Total TTC" value={formatMoney(totals.total)} strong />
      </div>
    </div>
  );
}
