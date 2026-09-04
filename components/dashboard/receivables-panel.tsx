'use client';

import { Card } from '@/components/ui/card';
import type { AgingBucket, AgingKey } from '@/lib/invoices';

import { useCompany } from '@/lib/company-context';
import { cn } from '@/lib/utils';

/**
 * Encours clients ventilé par ancienneté.
 *
 * Forme : barre empilée horizontale — la donnée est une part-à-tout sur quatre
 * tranches. Couleur : rampe SÉQUENTIELLE d'une seule teinte, du clair au foncé,
 * parce que les tranches sont ordonnées (plus la dette vieillit, plus la couleur
 * fonce). Ce n'est pas une palette catégorielle : il n'y a pas quatre identités
 * à distinguer, il y a une échelle à lire.
 *
 * Les paliers clairs passent sous 3:1 vis-à-vis de la surface : chaque tranche
 * est donc étiquetée directement sous la barre, et deux segments voisins sont
 * séparés par un écart de 2px en couleur de fond plutôt que par un contour.
 */
const BAR_COLORS: Record<AgingKey, string> = {
  current: 'bg-aging-1',
  d1_30: 'bg-aging-2',
  d31_60: 'bg-aging-3',
  d60p: 'bg-aging-4',
};

export function ReceivablesPanel({
  buckets,
  total,
  overdueAmount,
}: {
  buckets: AgingBucket[];
  total: number;
  overdueAmount: number;
}) {
  const { formatMoney } = useCompany();
  const visible = buckets.filter((bucket) => bucket.amount > 0);
  const share = (amount: number) => (total > 0 ? (amount / total) * 100 : 0);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Encours clients</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Ce qu&apos;il reste à encaisser, par ancienneté
          </p>
        </div>
        <div className="text-right">
          <p className="tabular type-display text-[30px] leading-none text-ink sm:text-[34px]">
            {formatMoney(total)}
          </p>
          {overdueAmount > 0 && (
            <p className="mt-1.5 text-[12.5px] font-medium text-status-overdue">
              dont {formatMoney(overdueAmount)} en retard
            </p>
          )}
        </div>
      </div>

      {total > 0 ? (
        <>
          <div className="mt-5 flex h-3.5 gap-[2px]" role="img" aria-label="Répartition de l'encours par ancienneté">
            {visible.map((bucket, index) => (
              <div
                key={bucket.key}
                style={{ flexGrow: bucket.amount, flexBasis: 0 }}
                className={cn(
                  'group relative min-w-[6px]',
                  index === 0 && 'rounded-l-[4px]',
                  index === visible.length - 1 && 'rounded-r-[4px]',
                  BAR_COLORS[bucket.key],
                )}
              >
                <span className="sr-only">
                  {bucket.label} : {formatMoney(bucket.amount)} sur {bucket.count} facture
                  {bucket.count > 1 ? 's' : ''}
                </span>
                <span
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11.5px] font-medium text-white shadow-pop group-hover:block"
                  aria-hidden
                >
                  {bucket.label} · {formatMoney(bucket.amount)}
                </span>
              </div>
            ))}
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            {buckets.map((bucket) => (
              <li key={bucket.key}>
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn('h-2 w-2 shrink-0 rounded-[3px]', BAR_COLORS[bucket.key])}
                    aria-hidden
                  />
                  <span className="text-[12px] font-semibold text-ink-2">{bucket.label}</span>
                </span>
                <p className="tabular mt-1.5 text-[15px] font-bold leading-none tracking-[-0.01em] text-ink">
                  {formatMoney(bucket.amount)}
                </p>
                <p className="mt-1 text-[11.5px] text-ink-3">
                  {bucket.count} facture{bucket.count > 1 ? 's' : ''} · {Math.round(share(bucket.amount))} %
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-5 text-[13px] text-ink-2">
          Aucune facture en attente de paiement. Tout est encaissé.
        </p>
      )}
    </Card>
  );
}
