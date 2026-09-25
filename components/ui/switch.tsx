'use client';

import { cn } from '@/lib/utils';

/**
 * Interrupteur à deux états.
 *
 * ⚠️ **REFAIT LE 25 sept. 2026 : on ne distinguait pas l'allumé de l'éteint.**
 * Remonté par l'utilisateur, capture à l'appui. La piste éteinte était en
 * `line-strong` (#D8CFBD) sur un fond crème `paper` (#FBF8F3) — moins de 1,5:1,
 * très loin du plancher de **3:1** qu'exige le contraste des éléments
 * d'interface. Le curseur blanc posé dessus n'était pas plus lisible. De loin,
 * les deux états se ressemblaient ; de près, il fallait deviner.
 *
 * ⚠️ **TROIS indices portent désormais l'état, pas un seul.** §6.7 interdit de
 * faire reposer une information sur la couleur seule :
 *
 *   1. **plein contre creux** — allumé, la piste est remplie de `brand` ;
 *      éteint, elle est claire avec un contour franc. C'est le seul indice qui
 *      survit à une impression en noir et blanc ou à un daltonisme ;
 *   2. **la position du curseur**, à gauche ou à droite ;
 *   3. la couleur, en dernier renfort.
 *
 * ⚠️ **Le curseur change de couleur avec l'état, et ce n'est pas décoratif.**
 * Blanc sur `brand` : 4,5:1. Blanc sur une piste claire : invisible. Éteint, il
 * passe donc en `ink-3`, qui tient 3:1 sur la piste comme sur le fond.
 *
 * ⚠️ **44 × 24 px, et le bouton entier fait au moins 36 px de haut** (§6.5).
 * L'ancien mesurait 36 × 20 dans un bouton haut de 20 px — sous le plancher
 * tactile, sur l'appareil qui est justement le principal ici.
 */
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
      className="group inline-flex min-h-9 items-center gap-3 rounded-[10px] text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink"
    >
      {label}
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 ease-out',
          checked
            ? 'border-brand-hover bg-brand'
            : // `sand-deep` plutôt que blanc : la piste reste distincte du fond
              // crème même quand le contour est très fin à l'écran.
              'border-ink-3 bg-sand-deep group-hover:border-ink-2',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none',
            checked ? 'translate-x-5 bg-surface shadow-card' : 'translate-x-0 bg-ink-3',
          )}
        />
      </span>
    </button>
  );
}
