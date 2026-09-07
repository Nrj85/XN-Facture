'use client';

import { useMemo, useState } from 'react';
import { Clock, FileText, TrendingUp, CheckCircle2 } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { ReceivablesPanel } from '@/components/dashboard/receivables-panel';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { formatDate, formatDateLong } from '@/lib/format';
import { computeAging, computeStats, matchesQuery } from '@/lib/invoices';
import { formatAmount } from '@/lib/money';
import {
  isRangeValid,
  isWithinRange,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from '@/lib/period';
import { useCompany } from '@/lib/company-context';
import { useT } from '@/lib/i18n/context';
import type { InvoiceView } from '@/lib/types';

/**
 * Tableau de bord.
 *
 * Les factures sont lues en base par le Server Component parent. L'agrégation
 * reste en TypeScript : `computeStats` et `computeAging` sont les mêmes
 * fonctions qu'en phase 2, et le contrôle croisé — somme des quatre tranches
 * égale au reste à encaisser — continue donc de tenir. Les descendre en SQL
 * dupliquerait l'arrondi, ce qu'on s'interdit.
 *
 * Le filtrage se fait **sur les données déjà chargées**, sans aller-retour
 * serveur : la page reçoit déjà toutes les factures de l'entreprise, et sur un
 * réseau lent une requête par frappe coûterait bien plus que le tri local.
 */
export function DashboardView({ views, today }: { views: InvoiceView[]; today: string }) {
  const { company, formatMoney, user } = useCompany();
  const t = useT();

  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [query, setQuery] = useState('');
  // Bornes de la période personnalisée. Initialisées au mois en cours plutôt
  // qu'à des champs vides : ouvrir « personnalisée » sur un écran sans dates
  // obligerait à deux saisies avant de voir quoi que ce soit.
  const [range, setRange] = useState<DateRange>(
    () => resolvePeriod('this-month', today) ?? { from: today, to: today },
  );

  const rangeInvalid = preset === 'custom' && !isRangeValid(range);

  const effectiveRange = useMemo(() => {
    if (preset === 'custom') return isRangeValid(range) ? range : null;
    return resolvePeriod(preset, today);
  }, [preset, range, today]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return views.filter((view) => {
      // La période porte sur la date d'ÉMISSION : c'est elle qui rattache une
      // facture à un exercice. Filtrer sur l'échéance ferait sortir d'un mois
      // une facture qu'on y a bien émise.
      if (effectiveRange && !isWithinRange(view.issueDate, effectiveRange)) return false;
      return matchesQuery(view, needle);
    });
  }, [views, effectiveRange, query]);

  const stats = computeStats(filtered);
  const aging = computeAging(filtered);
  const collectedShare = stats.invoiced > 0 ? stats.paid / stats.invoiced : 0;
  // `noUncheckedIndexedAccess` rend `[0]` optionnel aux yeux du compilateur :
  // on retombe sur le nom entier plutôt que d'afficher « Bonjour undefined ».
  const firstName = user.displayName.split(' ')[0] ?? user.displayName;

  const filtering = preset !== 'all' || query.trim().length > 0;
  // « Aucune facture émise », « 1 facture émise », « 7 factures émises » :
  // le pluriel suit le nombre, et zéro reste au singulier en français.
  const plural = filtered.length > 1 ? 's' : '';

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <p className="label-caps">{formatDateLong(today)}</p>
        <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
          {t.dashboard.title}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {t.dashboard.greeting(firstName, company.name)}
        </p>
      </header>

      <DashboardFilters
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={setRange}
        query={query}
        onQueryChange={setQuery}
        today={today}
        rangeInvalid={rangeInvalid}
      />

      {/* Ce que couvrent les chiffres, dit explicitement. Sans cette ligne, un
          filtre actif fait lire des totaux partiels comme s'ils étaient ceux de
          l'entreprise entière. */}
      {filtering && (
        <p className="text-[12.5px] text-ink-2" role="status">
          {/* La phrase s'assemble en trois morceaux et doit rester grammaticale
              dans les six combinaisons possibles (avec/sans période,
              avec/sans recherche, zéro ou plusieurs résultats). D'où le pluriel
              piloté par `plural` et non par la présence d'un filtre. */}
          {t.dashboard.scopeCount(filtered.length)}
          {effectiveRange && (
            <>
              {' '}
              {t.dashboard.scopeIssued(filtered.length)}{' '}
              <span className="tabular font-medium text-ink">{formatDate(effectiveRange.from)}</span>{' '}
              {t.dashboard.scopeAnd}{' '}
              <span className="tabular font-medium text-ink">{formatDate(effectiveRange.to)}</span>
            </>
          )}
          {query.trim() && (
            <>
              {' '}
              {t.dashboard.scopeMatching} «{' '}
              <span className="font-medium text-ink">{query.trim()}</span> »
            </>
          )}
          . {t.dashboard.scopeSuffix}
        </p>
      )}

      <section aria-label={t.dashboard.keyFigures} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.dashboard.invoiceCount}
          value={String(stats.invoiceCount)}
          unit={t.dashboard.invoiceUnit(stats.invoiceCount)}
          icon={FileText}
          hint={
            stats.draftCount > 0
              ? t.dashboard.draftsPending(stats.draftCount)
              : t.dashboard.noDraft
          }
        />
        <StatCard
          label={t.dashboard.invoiced}
          value={formatAmount(stats.invoiced)}
          unit="FCFA"
          icon={TrendingUp}
          hint={t.dashboard.invoicedHint}
        />
        <StatCard
          label={t.dashboard.collected}
          value={formatAmount(stats.paid)}
          unit="FCFA"
          icon={CheckCircle2}
          meter={collectedShare}
          hint={t.dashboard.collectedHint(Math.round(collectedShare * 100))}
        />
        <StatCard
          label={t.dashboard.outstanding}
          value={formatAmount(stats.outstanding)}
          unit="FCFA"
          icon={Clock}
          hint={
            stats.overdueCount > 0
              ? t.dashboard.overdueHint(formatMoney(stats.overdueAmount), stats.overdueCount)
              : t.dashboard.noOverdue
          }
        />
      </section>

      <ReceivablesPanel
        buckets={aging}
        total={stats.outstanding}
        overdueAmount={stats.overdueAmount}
      />

      <RecentInvoices invoices={filtered.slice(0, 7)} filtering={filtering} />
    </div>
  );
}
