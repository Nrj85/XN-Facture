'use client';

import { Plus, Trash2 } from 'lucide-react';
import { computeLineTotal } from '@/lib/invoice-calc';
import { formatAmount } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface DraftItem {
  id: string;
  description: string;
  /** Chaînes brutes : on ne convertit qu'au calcul, pour ne pas se battre avec
   *  le curseur pendant la saisie d'un nombre. */
  quantity: string;
  unitPrice: string;
}

export function parseNumber(value: string): number {
  const normalised = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function LineItemsEditor({
  items,
  onChange,
  error,
}: {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  error?: string;
}) {
  const update = (id: string, patch: Partial<DraftItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    onChange([
      ...items,
      { id: `l_${Date.now().toString(36)}`, description: '', quantity: '1', unitPrice: '' },
    ]);
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div>
      {/* En-têtes de colonnes, à partir de sm seulement : sur téléphone chaque
          ligne devient un bloc avec ses propres libellés. */}
      <div className="hidden gap-2 px-1 pb-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_64px_104px_100px_32px]">
        <span className="label-caps">Description</span>
        <span className="label-caps">Qté</span>
        <span className="label-caps">Prix unitaire</span>
        <span className="label-caps text-right">Total</span>
        <span className="sr-only">Actions</span>
      </div>

      <ul className="space-y-2">
        {items.map((item, index) => {
          const lineTotal = computeLineTotal(parseNumber(item.quantity), parseNumber(item.unitPrice));

          return (
            <li
              key={item.id}
              className={cn(
                'grid gap-2 rounded-[10px] sm:grid-cols-[minmax(0,1fr)_64px_104px_100px_32px] sm:items-center',
                'border border-line p-2.5 sm:border-0 sm:p-0',
              )}
            >
              <div>
                <span className="label-caps mb-1 block sm:hidden">Description</span>
                <Input
                  value={item.description}
                  onChange={(event) => update(item.id, { description: event.target.value })}
                  placeholder="Prestation ou produit"
                  aria-label={`Description de la ligne ${index + 1}`}
                />
              </div>

              <div>
                <span className="label-caps mb-1 block sm:hidden">Quantité</span>
                <Input
                  numeric
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(event) => update(item.id, { quantity: event.target.value })}
                  aria-label={`Quantité de la ligne ${index + 1}`}
                />
              </div>

              <div>
                <span className="label-caps mb-1 block sm:hidden">Prix unitaire</span>
                <Input
                  numeric
                  inputMode="numeric"
                  value={item.unitPrice}
                  onChange={(event) => update(item.id, { unitPrice: event.target.value })}
                  placeholder="0"
                  aria-label={`Prix unitaire de la ligne ${index + 1}`}
                />
              </div>

              {/* Le total est calculé, jamais saisi : il est affiché, pas éditable. */}
              <div className="flex items-center justify-between sm:justify-end">
                <span className="label-caps sm:hidden">Total</span>
                <span className="tabular text-[13px] font-semibold text-ink">
                  {formatAmount(lineTotal)}
                </span>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 transition-[background-color,color,transform] duration-150 ease-out hover:bg-status-overdue-bg hover:text-status-overdue active:scale-90 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Supprimer la ligne {index + 1}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-[11.5px] font-medium text-status-overdue">{error}</p>}

      <button
        type="button"
        onClick={addItem}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft hover:text-brand-hover"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Ajouter une ligne
      </button>
    </div>
  );
}
