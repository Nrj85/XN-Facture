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
  const firstName = user.displayName.split(' ')[0];

  const filtering = preset !== 'all' || query.trim().length > 0;
  // « Aucune facture émise », « 1 facture émise », « 7 factures émises » :
  // le pluriel suit le nombre, et zéro reste au singulier en français.
  const plural = filtered.length > 1 ? 's' : '';

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
          {filtered.length === 0 ? 'Aucune facture' : `${filtered.length} facture${plural}`}
          {effectiveRange && (
            <>
              {' '}
              émise{plural} entre le{' '}
              <span className="tabular font-medium text-ink">{formatDate(effectiveRange.from)}</span>{' '}
              et le{' '}
              <span className="tabular font-medium text-ink">{formatDate(effectiveRange.to)}</span>
            </>
          )}
          {query.trim() && (
            <>
              {' '}
              correspondant à « <span className="font-medium text-ink">{query.trim()}</span> »
            </>
          )}
          . Tous les chiffres ci-dessous ne portent que sur cette sélection.
        </p>
      )}

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

      <RecentInvoices invoices={filtered.slice(0, 7)} filtering={filtering} />
    </div>
  );
}
