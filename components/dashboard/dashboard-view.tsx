'use client';

import { Clock, FileText, TrendingUp, CheckCircle2 } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { ReceivablesPanel } from '@/components/dashboard/receivables-panel';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { formatDateLong } from '@/lib/format';
import { computeAging, computeStats } from '@/lib/invoices';
import { formatAmount } from '@/lib/money';
import { useCompany } from '@/lib/company-context';
import type { InvoiceView } from '@/lib/types';

/**
 * Tableau de bord.
 *
 * Les factures sont lues en base par le Server Component parent. L'agrégation
 * reste en TypeScript : `computeStats` et `computeAging` sont les mêmes
 * fonctions qu'en phase 2, et le contrôle croisé — somme des quatre tranches
 * égale au reste à encaisser — continue donc de tenir. Les descendre en SQL
 * dupliquerait l'arrondi, ce qu'on s'interdit.
 */
export function DashboardView({ views, today }: { views: InvoiceView[]; today: string }) {
  const { company, formatMoney, user } = useCompany();
  const stats = computeStats(views);
  const aging = computeAging(views);
  const collectedShare = stats.invoiced > 0 ? stats.paid / stats.invoiced : 0;
  const firstName = user.displayName.split(' ')[0];

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <p className="label-caps">{formatDateLong(today)}</p>
        <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
          Tableau de bord
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Bonjour {firstName} — voici où en est {company.name}.
        </p>
      </header>

      <section aria-label="Chiffres clés" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Factures émises"
          value={String(stats.invoiceCount)}
          unit={stats.invoiceCount > 1 ? 'factures' : 'facture'}
          icon={FileText}
          hint={
            stats.draftCount > 0
              ? `${stats.draftCount} brouillon${stats.draftCount > 1 ? 's' : ''} pas encore envoyé${stats.draftCount > 1 ? 's' : ''}`
              : 'Aucun brouillon en attente'
          }
        />
        <StatCard
          label="Montant facturé"
          value={formatAmount(stats.invoiced)}
          unit="FCFA"
          icon={TrendingUp}
          hint="Brouillons et factures annulées exclus"
        />
        <StatCard
          label="Montant encaissé"
          value={formatAmount(stats.paid)}
          unit="FCFA"
          icon={CheckCircle2}
          meter={collectedShare}
          hint={`${Math.round(collectedShare * 100)} % du montant facturé`}
        />
        <StatCard
          label="Reste à encaisser"
          value={formatAmount(stats.outstanding)}
          unit="FCFA"
          icon={Clock}
          hint={
            stats.overdueCount > 0 ? (
              <>
                dont{' '}
                <span className="font-semibold text-status-overdue">
                  {formatMoney(stats.overdueAmount)}
                </span>{' '}
                en retard sur {stats.overdueCount} factures
              </>
            ) : (
              'Aucune facture en retard'
            )
          }
        />
      </section>

      <ReceivablesPanel
        buckets={aging}
        total={stats.outstanding}
        overdueAmount={stats.overdueAmount}
      />

      <RecentInvoices invoices={views.slice(0, 7)} />
    </div>
  );
}
