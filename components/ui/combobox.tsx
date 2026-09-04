'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Ligne secondaire, en retrait : email, ville, précision. */
  hint?: string;
}

/**
 * Met en gras la portion du libellé qui correspond à la saisie, comme dans la
 * référence : l'utilisateur voit immédiatement *pourquoi* une option ressort.
 */
function Highlight({ label, query }: { label: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{label}</>;

  const index = label.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return <>{label}</>;

  return (
    <>
      {label.slice(0, index)}
      <span className="font-semibold">{label.slice(index, index + needle.length)}</span>
      {label.slice(index + needle.length)}
    </>
  );
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner',
  searchable = false,
  invalid,
  disabled = false,
  id,
  'aria-describedby': describedBy,
  emptyLabel = 'Aucun résultat',
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  /** Active le filtrage à la frappe. À réserver aux listes qui le méritent. */
  searchable?: boolean;
  invalid?: boolean;
  /**
   * Le champ reste lisible et annonce sa valeur, mais refuse d'être modifié.
   * Le masquer serait pire : l'utilisateur ne verrait plus le statut du tout.
   */
  disabled?: boolean;
  id?: string;
  'aria-describedby'?: string;
  emptyLabel?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !searchable) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.hint?.toLowerCase().includes(needle),
    );
  }, [options, query, searchable]);

  // À l'ouverture, l'option active est celle déjà retenue : les flèches partent
  // de la sélection courante, pas du haut de la liste.
  useEffect(() => {
    if (!open) return;
    const index = filtered.findIndex((option) => option.value === value);
    setActiveIndex(index >= 0 ? index : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function commit(option: ComboboxOption) {
    onChange(option.value);
    close();
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) commit(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex h-10 items-center rounded-[10px] border pl-3 pr-2 transition-colors duration-150',
          disabled ? 'bg-sand' : 'bg-surface',
          invalid ? 'border-status-overdue-dot' : 'border-line',
          !disabled && !invalid && 'hover:border-line-strong',
          // Le champ porte l'anneau de focus quand l'input interne l'a : sans ça
          // le contour se dessinerait autour du texte seul.
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-bright focus-within:ring-offset-2 focus-within:ring-offset-paper',
        )}
      >
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete={searchable ? 'list' : 'none'}
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-disabled={disabled || undefined}
          readOnly={!searchable || disabled}
          disabled={disabled}
          value={open && searchable ? query : (selected?.label ?? '')}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onMouseDown={() => {
            if (!disabled) setOpen((current) => !current);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full bg-transparent text-[13px] outline-none placeholder:text-ink-3',
            disabled ? 'cursor-not-allowed text-ink-2' : 'text-ink',
            !searchable && !disabled && 'cursor-pointer',
          )}
        />
        <ChevronDown
          className={cn(
            'ml-1 h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200 ease-out motion-reduce:transition-none',
            open && '-rotate-180',
          )}
          aria-hidden
        />
      </div>

      <Popover open={open} onClose={close}>
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="max-h-64 overflow-y-auto p-1.5"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-center text-[13px] text-ink-3">{emptyLabel}</li>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left transition-colors duration-100',
                      isActive && 'bg-brand-soft',
                      isSelected ? 'text-brand-hover' : 'text-ink',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">
                        <Highlight label={option.label} query={searchable ? query : ''} />
                      </span>
                      {option.hint && (
                        <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
                          {option.hint}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </Popover>
    </div>
  );
}
