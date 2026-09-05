'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Pencil, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { InvoicePreview } from '@/components/invoices/invoice-preview';
import { DownloadInvoiceButton } from '@/components/invoices/download-invoice-button';
import { RecordPaymentDialog } from '@/components/invoices/record-payment-dialog';
import { DocumentCreatedDialog } from '@/components/documents/document-created-dialog';
import { StatusMenu } from '@/components/documents/status-menu';
import { invoiceStatusActions } from '@/components/invoices/invoice-status-actions';
import { useCreationNotice } from '@/components/documents/use-creation-notice';
import { formatDate, formatDueLabel } from '@/lib/format';
import { computeTotals } from '@/lib/invoice-calc';
import { formatQuantity } from '@/lib/money';
import { useCompany } from '@/lib/company-context';
import { deleteInvoiceAction, sendInvoiceAction } from '@/lib/actions/invoices';
import type { Client, InvoiceView } from '@/lib/types';

/**
 * Détail d'une facture.
 *
 * La facture et son client sont lus en base par le Server Component parent :
 * l'écran « introuvable » vit désormais dans la page, avant même que ce
 * composant ne soit rendu.
 */
export function InvoiceDetail({
  invoice,
  client,
}: {
  invoice: InvoiceView;
  client: Client | undefined;
}) {
  const router = useRouter();
  const { formatMoney } = useCompany();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Le formulaire redirige ici avec un drapeau dans l'URL ; il est lu puis
  // effacé, et c'est lui qui déclenche la fenêtre de confirmation.
  const { notice, dismiss } = useCreationNotice(`/factures/${invoice.id}`);

  const totals = computeTotals(invoice.items, invoice.vatRate);

  /** Enveloppe commune : toute écriture remonte son refus au même endroit. */
  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      setActionError(result.ok ? null : (result.error ?? 'Opération impossible.'));
    });
  };

  /**
   * Transitions offertes depuis le statut courant.
   *
   * La table vit dans `invoice-status-actions.ts`, partagée avec le menu
   * d'actions du tableau de bord : deux copies auraient fini par diverger sur
   * des opérations qui attribuent un numéro ou soldent un encaissement.
   */
  const statusActions = invoiceStatusActions({
    invoice,
    total: totals.total,
    formatMoney,
    run,
    onRecordPayment: () => setPaymentOpen(true),
  });

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <Link
          href="/factures"
          className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft hover:text-brand-hover"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5 motion-reduce:transform-none"
            aria-hidden
          />
          Toutes les factures
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="label-caps">{invoice.clientName}</p>
            <StatusBadge status={invoice.displayStatus} />
          </div>
          <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
            {invoice.number ?? 'Brouillon'}
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            Émise le {formatDate(invoice.issueDate)} · échéance le {formatDate(invoice.dueDate)}
            {invoice.displayStatus === 'overdue' && (
              <span className="font-medium text-status-overdue">
                {' '}
                · {formatDueLabel(invoice.daysToDue)}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === 'draft' && (
            <Button
              onClick={() => run(() => sendInvoiceAction(invoice.id))}
              disabled={pending}
              className="gap-1.5"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              {pending ? 'Envoi…' : 'Envoyer'}
            </Button>
          )}
          <StatusMenu
            status={invoice.displayStatus}
            actions={statusActions}
            footnote="« En retard » se déduit de l’échéance, il ne se choisit pas."
          />
          <DownloadInvoiceButton invoice={invoice} />
          <Button
            variant="secondary"
            onClick={() => router.push(`/factures/${invoice.id}/modifier`)}
            className="gap-1.5"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Modifier
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            className="gap-1.5 text-status-overdue hover:border-status-overdue-dot hover:bg-status-overdue-bg"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Supprimer
          </Button>
        </div>
      </header>

      {actionError && (
        <p
          role="alert"
          className="rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-4 py-2.5 text-[13px] font-medium text-status-overdue"
        >
          {actionError}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Lignes de la facture</CardTitle>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <caption className="sr-only">Détail des prestations facturées</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Désignation</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Qté</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Prix unitaire</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={item.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3.5 text-ink">{item.description}</td>
                      <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-ink-2">
                        {formatQuantity(item.quantity)}
                      </td>
                      <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-ink-2">
                        {formatMoney(item.unitPrice)}
                      </td>
                      <td className="tabular whitespace-nowrap px-5 py-3.5 text-right font-semibold text-ink">
                        {formatMoney(totals.lineTotals[index] ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line p-5">
              <dl className="ml-auto max-w-xs space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[12.5px] text-ink-2">Sous-total HT</dt>
                  <dd className="tabular text-[13px] font-medium text-ink">
                    {formatMoney(totals.subtotal)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[12.5px] text-ink-2">
                    TVA {invoice.vatRate.toString().replace('.', ',')} %
                  </dt>
                  <dd className="tabular text-[13px] font-medium text-ink">
                    {formatMoney(totals.vatAmount)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2.5">
                  <dt className="text-[13px] font-semibold text-ink">Total TTC</dt>
                  <dd className="tabular text-[17px] font-bold tracking-[-0.02em] text-ink">
                    {formatMoney(totals.total)}
                  </dd>
                </div>
                {invoice.amountPaid > 0 && (
                  <>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-[12.5px] text-ink-2">Déjà encaissé</dt>
                      <dd className="tabular text-[13px] font-medium text-status-paid">
                        −{formatMoney(invoice.amountPaid)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-[12.5px] font-semibold text-ink-2">Reste dû</dt>
                      <dd className="tabular text-[13px] font-bold text-ink">
                        {formatMoney(invoice.balanceDue)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </div>
          </Card>

        </div>
        {/* Plus de carte « Statut » ici : le menu de l'en-tête fait le même
            travail, en nommant les transitions plutôt que les états, et sans
            obliger à descendre la page pour la trouver. */}

        <div className="lg:sticky lg:top-20">
          <Card className="p-4 sm:p-5">
            <p className="label-caps mb-3">Aperçu du document</p>
            <InvoicePreview
              number={invoice.number}
              client={client}
              address={invoice.address}
              issueDate={invoice.issueDate}
              dueDate={invoice.dueDate}
              lines={invoice.items.map((item, index) => ({
                id: item.id,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: totals.lineTotals[index] ?? 0,
              }))}
              totals={totals}
              notes={invoice.notes}
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const result = await deleteInvoiceAction(invoice.id);
            // On ne quitte la page qu'une fois la suppression confirmée par le
            // serveur : naviguer d'abord masquerait un refus.
            if (result.ok) router.push('/factures');
            else setActionError(result.error);
          });
        }}
        title="Supprimer cette facture ?"
        description={`${invoice.number ?? 'Ce brouillon'} sera définitivement supprimé. Cette action est irréversible.`}
      />

      <DocumentCreatedDialog
        open={notice !== null}
        onClose={dismiss}
        notice={notice ?? 'created'}
        kind="invoice"
        number={invoice.number}
        clientName={invoice.clientName}
        total={formatMoney(totals.total)}
        status={invoice.displayStatus}
        download={<DownloadInvoiceButton invoice={invoice} size="sm" />}
      />

      <RecordPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        invoice={invoice}
      />
    </div>
  );
}
