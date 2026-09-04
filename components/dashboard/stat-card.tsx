import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export interface StatCardProps {
  label: string;
  /** Valeur déjà formatée. Le chiffre est le sujet de la carte, pas le libellé. */
  value: string;
  /**
   * Unité posée après la valeur, en plus petit. Séparer « 25 510 000 » de
   * « FCFA » garde le nombre lisible en gros corps sans faire déborder la carte.
   */
  unit?: string;
  hint?: React.ReactNode;
  icon: LucideIcon;
  /** Ratio 0–1 : affiche un compteur sous la valeur. */
  meter?: number;
}

export function StatCard({ label, value, unit, hint, icon: Icon, meter }: StatCardProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">{label}</p>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-sand" aria-hidden>
          <Icon className="h-4 w-4 text-ink-2" strokeWidth={1.9} />
        </span>
      </div>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="tabular text-[25px] font-bold leading-none tracking-[-0.03em] text-ink sm:text-[28px]">
          {value}
        </span>
        {unit && <span className="text-[12.5px] font-semibold text-ink-3">{unit}</span>}
      </p>

      {meter !== undefined && (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sand-deep"
          role="img"
          aria-label={`${Math.round(meter * 100)} % encaissé`}
        >
          <div
            className="h-full rounded-full bg-aging-3"
            style={{ width: `${Math.min(100, Math.max(0, meter * 100))}%` }}
          />
        </div>
      )}

      {hint && <p className="mt-2.5 text-[12.5px] leading-snug text-ink-3">{hint}</p>}
    </Card>
  );
}
