'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatDueLabel } from '@/lib/format';

import { useCompany } from '@/lib/company-context';
import type { InvoiceView } from '@/lib/types';

function InvoiceRef({ invoice }: { invoice: InvoiceView }) {
  // Un brouillon n'a pas encore de numéro : il n'en consomme un qu'à l'envoi.
  return invoice.number ? (
    <span className="tabular font-semibold text-ink">{invoice.number}</span>
  ) : (
    <span className="text-ink-3">Sans numéro</span>
  );
}

function DueCell({ invoice }: { invoice: InvoiceView }) {
  const late = invoice.displayStatus === 'overdue';
  return (
    <>
      <span className="tabular block text-ink-2">{formatDate(invoice.dueDate)}</span>
      {late && (
        <span className="mt-0.5 block text-[11.5px] font-medium text-status-overdue">
          {formatDueLabel(invoice.daysToDue)}
        </span>
      )}
    </>
  );
}

function AmountCell({ invoice }: { invoice: InvoiceView }) {
  const { formatMoney } = useCompany();
  const partial = invoice.amountPaid > 0 && invoice.balanceDue > 0;
  return (
    <>
      <span className="tabular block font-semibold text-ink">{formatMoney(invoice.total)}</span>
      {partial && (
        <span className="tabular mt-0.5 block text-[11.5px] text-ink-3">
          {formatMoney(invoice.amountPaid)} encaissé
        </span>
      )}
    </>
  );
}

export function RecentInvoices({ invoices }: { invoices: InvoiceView[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Dernières factures</CardTitle>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Les {invoices.length} documents les plus récents
          </p>
        </div>
        <Link
          href="/factures"
          className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft hover:text-brand-hover"
        >
          Voir toutes les factures
          {/* La flèche avance : elle dit où mène le lien. */}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none"
            aria-hidden
          />
        </Link>
      </CardHeader>

      {/* Tableau à partir de md. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[13.5px]">
          <caption className="sr-only">Dernières factures émises</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="label-caps px-5 py-2.5 text-left">Numéro</th>
              <th scope="col" className="label-caps px-5 py-2.5 text-left">Client</th>
              <th scope="col" className="label-caps px-5 py-2.5 text-left">Émission</th>
              <th scope="col" className="label-caps px-5 py-2.5 text-left">Échéance</th>
              <th scope="col" className="label-caps px-5 py-2.5 text-right">Montant</th>
              <th scope="col" className="label-caps px-5 py-2.5 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-b border-line last:border-0 transition-colors hover:bg-paper"
              >
                <td className="whitespace-nowrap px-5 py-3.5">
                  <InvoiceRef invoice={invoice} />
                </td>
                <td className="px-5 py-3.5 font-medium text-ink">{invoice.clientName}</td>
                <td className="tabular whitespace-nowrap px-5 py-3.5 text-ink-2">
                  {formatDate(invoice.issueDate)}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5">
                  <DueCell invoice={invoice} />
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                  <AmountCell invoice={invoice} />
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={invoice.displayStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Liste de cartes en dessous de md : un tableau à six colonnes est
          illisible sur un téléphone, et le téléphone est l'appareil principal
          de cette audience. */}
      <ul className="divide-y divide-line md:hidden">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{invoice.clientName}</p>
                <p className="mt-0.5 text-[12px]">
                  <InvoiceRef invoice={invoice} />
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
              <p className="text-right">
                <AmountCell invoice={invoice} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
