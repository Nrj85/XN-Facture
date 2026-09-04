'use client';

import { cn } from '@/lib/utils';

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="group inline-flex items-center gap-2.5 rounded-[10px] text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink"
    >
      {label}
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ease-out',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-card transition-transform duration-150 ease-out motion-reduce:transition-none',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
