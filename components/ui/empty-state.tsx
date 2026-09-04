import type { LucideIcon } from 'lucide-react';

/**
 * Un écran vide est une invitation à agir, pas une page blanche : il dit ce
 * qu'il n'y a pas, pourquoi, et quoi faire ensuite.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-sand" aria-hidden>
        <Icon className="h-5 w-5 text-ink-3" strokeWidth={1.8} />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-ink-2">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
