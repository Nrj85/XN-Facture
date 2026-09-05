'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { InvoiceRowActions } from '@/components/dashboard/invoice-row-actions';
import { RecordPaymentDialog } from '@/components/invoices/record-payment-dialog';
import { formatDate, formatDueLabel } from '@/lib/format';
import { deleteInvoiceAction } from '@/lib/actions/invoices';

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

/**
 * Liste des factures du tableau de bord.
 *
 * Chaque ligne porte un menu ⋯ : modifier, télécharger, changer de statut,
 * supprimer. Le panneau est rendu en portail (voir `ui/action-menu.tsx`), sans
 * quoi le `overflow-x-auto` du tableau le rognerait.
 *
 * La confirmation de suppression et la saisie d'encaissement vivent ici, en un
 * seul exemplaire : une modale par ligne en monterait sept.
 */
export function RecentInvoices({
  invoices,
  filtering = false,
}: {
  invoices: InvoiceView[];
  /** Un filtre est actif : le titre et l'état vide doivent le dire. */
  filtering?: boolean;
}) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<InvoiceView | null>(null);
  const [paymentFor, setPaymentFor] = useState<InvoiceView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const actionsFor = (invoice: InvoiceView) => (
    <InvoiceRowActions
      invoice={invoice}
      onDelete={setPendingDelete}
      onRecordPayment={setPaymentFor}
      onError={setActionError}
    />
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{filtering ? 'Factures de la sélection' : 'Dernières factures'}</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {invoices.length === 0
                ? 'Aucun document à afficher'
                : `Les ${invoices.length} document${invoices.length > 1 ? 's' : ''} le${invoices.length > 1 ? 's' : ''} plus récent${invoices.length > 1 ? 's' : ''}`}
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

        {actionError && (
          <p
            role="alert"
            className="mx-4 mt-3 rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-3 py-2 text-[12.5px] font-medium text-status-overdue sm:mx-5"
          >
            {actionError}
          </p>
        )}

        {invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filtering ? 'Aucune facture sur cette sélection' : 'Aucune facture'}
            description={
              filtering
                ? 'Élargissez la période, ou effacez la recherche pour retrouver toutes vos factures.'
                : 'Créez votre première facture pour commencer à suivre vos encaissements.'
            }
            action={
              !filtering && (
                <Link href="/factures/nouvelle" className={buttonClasses({ size: 'sm' })}>
                  Nouvelle facture
                </Link>
              )
            }
          />
        ) : (
          <>
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
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      onClick={() => router.push(`/factures/${invoice.id}`)}
                      className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-paper"
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
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">{actionsFor(invoice)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Liste de cartes en dessous de md : un tableau à sept colonnes est
                illisible sur un téléphone, et le téléphone est l'appareil
                principal de cette audience. */}
            <ul className="divide-y divide-line md:hidden">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    {/* Le lien ne couvre que l'en-tête : un `<a>` ne peut pas
                        contenir de bouton, et le menu en est un. */}
                    <Link href={`/factures/${invoice.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">
                        {invoice.clientName}
                      </p>
                      <p className="mt-0.5 text-[12px]">
                        <InvoiceRef invoice={invoice} />
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusBadge status={invoice.displayStatus} />
                      {actionsFor(invoice)}
                    </div>
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
          </>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Supprimer cette facture ?"
        description={
          pendingDelete
            ? `${pendingDelete.number ?? 'Ce brouillon'} — ${pendingDelete.clientName}. Cette action est irréversible.`
            : ''
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (!target) return;
          startTransition(async () => {
            const result = await deleteInvoiceAction(target.id);
            if (!result.ok) setActionError(result.error);
          });
        }}
      />

      {/* Le dialogue porte son propre message d'erreur : il a la largeur pour
          le montrer là où la saisie a eu lieu. */}
      {paymentFor && (
        <RecordPaymentDialog open onClose={() => setPaymentFor(null)} invoice={paymentFor} />
      )}
    </>
  );
}
