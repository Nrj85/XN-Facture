import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand text-[13px] font-extrabold tracking-tight text-white"
        aria-hidden
      >
        XN
      </span>
      <span className="type-display text-[15px] leading-none text-ink">
        Facture
      </span>
    </span>
  );
}
