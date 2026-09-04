'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileCheck, Handshake, Hourglass, Search, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/dashboard/stat-card';
import { QuoteQuickActions } from '@/components/quotes/quote-quick-actions';
import { formatDate } from '@/lib/format';
import { formatCompact } from '@/lib/money';
import { computeQuoteStats, formatValidityLabel, QUOTE_STATUS_LABELS } from '@/lib/quotes';
import { useCompany } from '@/lib/company-context';
import { deleteQuoteAction } from '@/lib/actions/quotes';
import type { QuoteDisplayStatus, QuoteView } from '@/lib/types';
import { cn } from '@/lib/utils';

type Filter = 'all' | QuoteDisplayStatus;

const FILTERS: Filter[] = ['all', 'draft', 'sent', 'accepted', 'converted', 'refused', 'expired'];

function filterLabel(filter: Filter): string {
  return filter === 'all' ? 'Tous' : QUOTE_STATUS_LABELS[filter];
}

export function QuoteList({ quoteViews }: { quoteViews: QuoteView[] }) {
  const router = useRouter();
  const { formatMoney } = useCompany();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState(useSearchParams().get('q') ?? '');
  const [pendingDelete, setPendingDelete] = useState<QuoteView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stats = useMemo(() => computeQuoteStats(quoteViews), [quoteViews]);

  const counts = useMemo(() => {
    const base = { all: quoteViews.length } as Record<Filter, number>;
    for (const view of quoteViews) {
      base[view.displayStatus] = (base[view.displayStatus] ?? 0) + 1;
    }
    return base;
  }, [quoteViews]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return quoteViews.filter((view) => {
      if (filter !== 'all' && view.displayStatus !== filter) return false;
      if (!needle) return true;
      return (
        view.clientName.toLowerCase().includes(needle) ||
        (view.number?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [quoteViews, filter, query]);

  const filtered = query !== '' || filter !== 'all';
  const open = (id: string) => router.push(`/devis/${id}`);

  return (
    <div className="animate-fade-in space-y-5">
      {/* Pas de bouton « Nouveau devis » ici : la barre supérieure porte
          l'action de la section, juste au-dessus. */}
      <header>
        <p className="label-caps">Documents</p>
        <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">Devis</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-2">
          Vos propositions commerciales. Une fois acceptée, une offre se convertit en facture sans
          ressaisir une seule ligne.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="En attente de réponse"
          value={formatCompact(stats.pendingAmount)}
          unit="FCFA"
          icon={Hourglass}
          hint={`${stats.pendingCount} devis envoyé${stats.pendingCount > 1 ? 's' : ''}, sans réponse à ce jour.`}
        />
        <StatCard
          label="Devis remportés"
          value={formatCompact(stats.wonAmount)}
          unit="FCFA"
          icon={Handshake}
          hint={`${stats.wonCount} accepté${stats.wonCount > 1 ? 's' : ''} ou déjà facturé${stats.wonCount > 1 ? 's' : ''}.`}
        />
        <StatCard
          label="Taux de transformation"
          // « 0 % » et « rien à mesurer » ne sont pas la même information : tant
          // qu'aucun devis n'a été tranché, la carte le dit plutôt que d'inventer
          // un chiffre.
          value={stats.winRate === null ? '—' : String(stats.winRate)}
          unit={stats.winRate === null ? undefined : '%'}
          icon={Trophy}
          meter={stats.winRate === null ? undefined : stats.winRate / 100}
          hint={
            stats.winRate === null
              ? 'Aucun devis tranché pour l’instant.'
              : `Sur ${stats.wonCount + stats.lostCount} devis tranchés, dont ${stats.expiredCount} expiré${stats.expiredCount > 1 ? 's' : ''} sans réponse.`
          }
        />
      </div>

      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
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
                  <span className={cn('tabular text-[11.5px]', active ? 'text-white/75' : 'text-ink-3')}>
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
            icon={FileCheck}
            title={filtered ? 'Aucun résultat' : 'Aucun devis'}
            description={
              filtered
                ? 'Aucun devis ne correspond à cette recherche. Essayez un autre nom ou changez de filtre.'
                : 'Établissez une proposition chiffrée : vous la convertirez en facture dès qu’elle sera acceptée.'
            }
            action={
              filtered ? (
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
                <Button size="sm" onClick={() => router.push('/devis/nouveau')}>
                  Créer un devis
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-[13.5px]">
                <caption className="sr-only">Liste des devis</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Numéro</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Client</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Émission</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Validité</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Montant</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Statut</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((quote) => (
                    <tr
                      key={quote.id}
                      onClick={() => open(quote.id)}
                      className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-paper"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5">
                        {/* Le lien porte l'accessibilité clavier ; le clic sur la
                            ligne n'est qu'un raccourci à la souris. */}
                        <Link
                          href={`/devis/${quote.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="tabular font-semibold text-ink hover:text-brand"
                        >
                          {quote.number ?? <span className="text-ink-3">Sans numéro</span>}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-ink">{quote.clientName}</td>
                      <td className="tabular whitespace-nowrap px-5 py-3.5 text-ink-2">
                        {formatDate(quote.issueDate)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="tabular block text-ink-2">{formatDate(quote.validUntil)}</span>
                        {quote.displayStatus === 'expired' && (
                          <span className="mt-0.5 block text-[11.5px] font-medium text-status-overdue">
                            {formatValidityLabel(quote.daysToExpiry)}
                          </span>
                        )}
                      </td>
                      <td className="tabular whitespace-nowrap px-5 py-3.5 text-right font-semibold text-ink">
                        {formatMoney(quote.total)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge
                          status={quote.displayStatus}
                          label={QUOTE_STATUS_LABELS[quote.displayStatus]}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <QuoteQuickActions
                          quote={quote}
                          onDelete={setPendingDelete}
                          onError={setActionError}
                          onConverted={(invoiceId) => router.push(`/factures/${invoiceId}`)}
                          className="justify-end"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sous `md`, le tableau devient une liste de cartes : sept colonnes
                sont illisibles sur un téléphone. */}
            <ul className="divide-y divide-line md:hidden">
              {results.map((quote) => (
                <li key={quote.id} className="px-4 py-3.5">
                  <Link href={`/devis/${quote.id}`} className="block rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">
                          {quote.clientName}
                        </p>
                        <p className="tabular mt-0.5 text-[12px] text-ink-3">
                          {quote.number ?? 'Sans numéro'}
                        </p>
                      </div>
                      <StatusBadge
                        status={quote.displayStatus}
                        label={QUOTE_STATUS_LABELS[quote.displayStatus]}
                        className="shrink-0"
                      />
                    </div>
                    <div className="mt-2.5 flex items-end justify-between gap-3">
                      <p className="text-[12px] text-ink-3">
                        <span className="tabular">Valable jusqu’au {formatDate(quote.validUntil)}</span>
                        {quote.displayStatus === 'expired' && (
                          <span className="mt-0.5 block font-medium text-status-overdue">
                            {formatValidityLabel(quote.daysToExpiry)}
                          </span>
                        )}
                      </p>
                      <p className="tabular text-right text-[14px] font-semibold text-ink">
                        {formatMoney(quote.total)}
                      </p>
                    </div>
                  </Link>

                  <div className="mt-2 border-t border-line pt-1.5">
                    <QuoteQuickActions
                      quote={quote}
                      onDelete={setPendingDelete}
                      onError={setActionError}
                      onConverted={(invoiceId) => router.push(`/factures/${invoiceId}`)}
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
            const result = await deleteQuoteAction(target.id);
            if (!result.ok) setActionError(result.error);
          });
        }}
        title="Supprimer ce devis ?"
        description={`${pendingDelete?.number ?? 'Ce brouillon'} — ${pendingDelete?.clientName ?? ''} sera définitivement supprimé. Cette action est irréversible.`}
      />
    </div>
  );
}
