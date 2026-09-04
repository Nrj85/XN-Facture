'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import {
  describeDate,
  isSameMonth,
  monthGrid,
  monthLabel,
  parseIso,
  shiftMonth,
  WEEKDAY_NAMES,
  type YearMonth,
} from '@/lib/calendar';
import { formatDate, type IsoDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export function DatePicker({
  value,
  onChange,
  today,
  min,
  invalid,
  id,
  'aria-describedby': describedBy,
}: {
  value: IsoDate;
  onChange: (value: IsoDate) => void;
  /** Date du jour, injectée : la donnée fictive est figée sur une date de référence. */
  today: IsoDate;
  /** Bornage bas — l'échéance ne peut pas précéder l'émission. */
  min?: IsoDate;
  invalid?: boolean;
  id?: string;
  'aria-describedby'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<YearMonth>(() => parseIso(value));
  const [focused, setFocused] = useState<IsoDate>(value);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Rouvrir replace le calendrier sur le mois de la date retenue, pas sur celui
  // où l'utilisateur avait navigué la fois précédente.
  useEffect(() => {
    if (open) {
      setView(parseIso(value));
      setFocused(value);
    }
  }, [open, value]);

  const grid = monthGrid(view);

  function commit(iso: IsoDate) {
    if (min && iso < min) return;
    onChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function move(days: number) {
    const parsed = parseIso(focused);
    const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
    const iso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
    setFocused(iso);
    setView(parseIso(iso));
  }

  function onGridKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    };
    if (event.key in moves) {
      event.preventDefault();
      move(moves[event.key] as number);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(focused);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      setView((current) => shiftMonth(current, event.key === 'PageUp' ? -1 : 1));
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        // `aria-invalid` n'a pas de sens sur un bouton : c'est le message
        // d'erreur du champ, relié par `aria-describedby`, qui porte l'anomalie.
        aria-describedby={describedBy}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-[10px] border bg-surface px-3 text-left transition-colors duration-150',
          invalid ? 'border-status-overdue-dot' : 'border-line hover:border-line-strong',
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
        <span className="tabular flex-1 text-[13px] text-ink">{formatDate(value)}</span>
      </button>

      <Popover open={open} onClose={() => setOpen(false)} className="w-[286px] p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView((current) => shiftMonth(current, -1))}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 transition-[background-color,transform] duration-150 ease-out hover:bg-sand active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="sr-only">Mois précédent</span>
          </button>
          <p aria-live="polite" className="text-[13px] font-semibold capitalize text-ink">
            {monthLabel(view)}
          </p>
          <button
            type="button"
            onClick={() => setView((current) => shiftMonth(current, 1))}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 transition-[background-color,transform] duration-150 ease-out hover:bg-sand active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
            <span className="sr-only">Mois suivant</span>
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-0.5" aria-hidden>
          {WEEKDAY_NAMES.map((day) => (
            <span key={day} className="label-caps py-1 text-center text-ink-3">
              {day}
            </span>
          ))}
        </div>

        {/* `role="group"` plutôt que `role="grid"` : une grille ARIA impose des
            lignes explicites, et prétendre en être une sans en avoir la
            structure dessert les lecteurs d'écran. Chaque jour porte sa date
            complète en `aria-label`, ce qui suffit ici. */}
        <div
          role="group"
          aria-label={`Calendrier — ${monthLabel(view)}`}
          tabIndex={0}
          onKeyDown={onGridKeyDown}
          className="mt-0.5 grid grid-cols-7 gap-0.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-bright"
        >
          {grid.map((iso) => {
            const inMonth = isSameMonth(iso, view);
            const isSelected = iso === value;
            const isToday = iso === today;
            const disabled = Boolean(min && iso < min);
            const day = parseIso(iso).day;

            return (
              <button
                key={iso}
                type="button"
                tabIndex={-1}
                disabled={disabled}
                // L'état est porté par le libellé, pas par un rôle emprunté :
                // sur un simple bouton, `aria-selected` est ignoré.
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${describeDate(iso)}${isSelected ? ', date retenue' : ''}${isToday ? ", aujourd'hui" : ''}`}
                onClick={() => commit(iso)}
                className={cn(
                  'tabular grid h-9 place-items-center rounded-[8px] text-[13px] transition-colors duration-100',
                  'disabled:pointer-events-none disabled:opacity-30',
                  isSelected
                    ? 'bg-brand font-semibold text-white'
                    : inMonth
                      ? 'text-ink hover:bg-brand-soft'
                      : 'text-ink-3 hover:bg-sand',
                  // Aujourd'hui : un liseré, jamais un fond — le fond plein est
                  // réservé à la date réellement retenue.
                  !isSelected && isToday && 'ring-1 ring-inset ring-brand-bright font-semibold',
                  iso === focused && !isSelected && 'ring-1 ring-inset ring-line-strong',
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
          <button
            type="button"
            onClick={() => commit(today)}
            className="rounded-lg px-2 py-1 text-[12.5px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft hover:text-brand-hover"
          >
            Aujourd&apos;hui
          </button>
          <span className="tabular text-[11.5px] text-ink-3">{formatDate(value)}</span>
        </div>
      </Popover>
    </div>
  );
}
