'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { InvoiceQuickActions } from '@/components/invoices/invoice-quick-actions';
import { formatDate, formatDueLabel } from '@/lib/format';
import { matchesQuery, STATUS_LABELS } from '@/lib/invoices';

import { useCompany } from '@/lib/company-context';
import { deleteInvoiceAction } from '@/lib/actions/invoices';
import type { DisplayStatus, InvoiceView } from '@/lib/types';
import { cn } from '@/lib/utils';

type Filter = 'all' | DisplayStatus;

const FILTERS: Filter[] = ['all', 'draft', 'sent', 'paid', 'overdue'];

function filterLabel(filter: Filter): string {
  return filter === 'all' ? 'Toutes' : STATUS_LABELS[filter];
}

export function InvoiceList({ views }: { views: InvoiceView[] }) {
  const router = useRouter();
  const { formatMoney } = useCompany();
  const [filter, setFilter] = useState<Filter>('all');
  // Terme initial repris de l'URL : c'est ce qui rend la recherche de la barre
  // latérale utile depuis n'importe quelle page.
  const [query, setQuery] = useState(useSearchParams().get('q') ?? '');
  // Suppression demandée depuis les actions rapides. Une seule confirmation
  // pour toute la liste : une modale par ligne en monterait dix-sept.
  const [pendingDelete, setPendingDelete] = useState<InvoiceView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: views.length, draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 } as Record<Filter, number>;
    for (const view of views) base[view.displayStatus] = (base[view.displayStatus] ?? 0) + 1;
    return base;
  }, [views]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return views.filter((view) => {
      if (filter !== 'all' && view.displayStatus !== filter) return false;
      return matchesQuery(view, needle);
    });
  }, [views, filter, query]);

  const open = (id: string) => router.push(`/factures/${id}`);

  return (
    <div className="animate-fade-in space-y-5">
      {/* Pas de bouton « Nouvelle facture » ici : la barre supérieure en porte
          déjà un, juste au-dessus. Deux fois la même action côte à côte se lit
          comme un défaut. */}
      <header>
        <p className="label-caps">Documents</p>
        <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">Factures</h1>
        <p className="mt-2 text-sm text-ink-2">
          {views.length} facture{views.length > 1 ? 's' : ''} au total.
        </p>
      </header>

      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {/* Filtres par statut, avec le nombre de factures concernées : le
              compteur évite d'avoir à cliquer pour découvrir qu'une catégorie
              est vide. */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par statut">
            {FILTERS.map((value) => {
              const active = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium',
                    'transition-[background-color,color,box-shadow] duration-150 ease-out',
                    active
                      ? 'bg-brand text-white shadow-card'
                      : 'text-ink-2 hover:bg-sand hover:text-ink',
                  )}
                >
                  {filterLabel(value)}
                  <span
                    className={cn(
                      'tabular text-[11.5px]',
                      active ? 'text-white/75' : 'text-ink-3',
                    )}
                  >
                    {counts[value] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="relative sm:ml-auto sm:w-64">
            <span className="sr-only">Rechercher par client ou numéro</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un client"
              className="pl-9"
            />
          </label>
        </CardHeader>

        {results.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={query || filter !== 'all' ? 'Aucun résultat' : 'Aucune facture'}
            description={
              query || filter !== 'all'
                ? 'Aucune facture ne correspond à cette recherche. Essayez un autre nom ou changez de filtre.'
                : 'Créez votre première facture pour commencer à suivre vos encaissements.'
            }
            action={
              query || filter !== 'all' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              ) : (
                <Button size="sm" onClick={() => router.push('/factures/nouvelle')}>
                  Créer une facture
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-[13.5px]">
                <caption className="sr-only">Liste des factures</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Numéro</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Client</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Émission</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Échéance</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Montant</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Statut</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((invoice) => (
                    <tr
                      key={invoice.id}
                      onClick={() => open(invoice.id)}
                      className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-paper"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5">
                        {/* Le lien porte l'accessibilité clavier ; le clic sur la
                            ligne n'est qu'un raccourci à la souris. */}
                        <Link
                          href={`/factures/${invoice.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="tabular font-semibold text-ink hover:text-brand"
                        >
                          {invoice.number ?? <span className="text-ink-3">Sans numéro</span>}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-ink">{invoice.clientName}</td>
                      <td className="tabular whitespace-nowrap px-5 py-3.5 text-ink-2">
                        {formatDate(invoice.issueDate)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="tabular block text-ink-2">{formatDate(invoice.dueDate)}</span>
                        {invoice.displayStatus === 'overdue' && (
                          <span className="mt-0.5 block text-[11.5px] font-medium text-status-overdue">
                            {formatDueLabel(invoice.daysToDue)}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <span className="tabular block font-semibold text-ink">
                          {formatMoney(invoice.total)}
                        </span>
                        {invoice.amountPaid > 0 && invoice.balanceDue > 0 && (
                          <span className="tabular mt-0.5 block text-[11.5px] text-ink-3">
                            {formatMoney(invoice.amountPaid)} encaissé
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={invoice.displayStatus} />
                      </td>
                      <td className="px-3 py-2">
                        <InvoiceQuickActions
                          invoice={invoice}
                          onDelete={setPendingDelete}
                          onError={setActionError}
                          className="justify-end"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sur téléphone, la carte n'est plus un lien enveloppant : un lien
                ne peut pas contenir de boutons. Le lien couvre l'en-tête de la
                carte, les actions rapides vivent sur leur propre rangée. */}
            <ul className="divide-y divide-line md:hidden">
              {results.map((invoice) => (
                <li key={invoice.id} className="px-4 py-3.5">
                  <Link href={`/factures/${invoice.id}`} className="block rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">
                          {invoice.clientName}
                        </p>
                        <p className="tabular mt-0.5 text-[12px] text-ink-3">
                          {invoice.number ?? 'Sans numéro'}
                        </p>
                      </div>
                      <StatusBadge status={invoice.displayStatus} className="shrink-0" />
                    </div>
                    <div className="mt-2.5 flex items-end justify-between gap-3">
                      <p className="text-[12px] text-ink-3">
                        <span className="tabular">Échéance {formatDate(invoice.dueDate)}</span>
                        {invoice.displayStatus === 'overdue' && (
                          <span className="mt-0.5 block font-medium text-status-overdue">
                            {formatDueLabel(invoice.daysToDue)}
                          </span>
                        )}
                      </p>
                      <p className="tabular text-right text-[14px] font-semibold text-ink">
                        {formatMoney(invoice.total)}
                      </p>
                    </div>
                  </Link>

                  <div className="mt-2 border-t border-line pt-1.5">
                    <InvoiceQuickActions
                      invoice={invoice}
                      onDelete={setPendingDelete}
                      onError={setActionError}
                      className="-ml-1.5"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {actionError && (
        <p
          role="alert"
          className="rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-4 py-2.5 text-[13px] font-medium text-status-overdue"
        >
          {actionError}
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          startTransition(async () => {
            const result = await deleteInvoiceAction(target.id);
            if (!result.ok) setActionError(result.error);
          });
        }}
        title="Supprimer cette facture ?"
        description={`${pendingDelete?.number ?? 'Ce brouillon'} — ${pendingDelete?.clientName ?? ''} sera définitivement supprimé. Cette action est irréversible.`}
      />
    </div>
  );
}
