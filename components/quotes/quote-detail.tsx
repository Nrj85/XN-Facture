'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  FileCheck,
  FileOutput,
  Pencil,
  Send,
  ThumbsDown,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { InvoicePreview } from '@/components/invoices/invoice-preview';
import { DownloadPdfButton } from '@/components/pdf/download-pdf-button';
import { DocumentCreatedDialog } from '@/components/documents/document-created-dialog';
import { StatusMenu, type StatusAction } from '@/components/documents/status-menu';
import { useCreationNotice } from '@/components/documents/use-creation-notice';
import { formatDate } from '@/lib/format';
import { computeTotals } from '@/lib/invoice-calc';
import { formatQuantity } from '@/lib/money';
import { pdfFileName } from '@/lib/pdf/payload';
import { formatValidityLabel, QUOTE_STATUS_LABELS } from '@/lib/quotes';
import { useCompany } from '@/lib/company-context';
import {
  convertQuoteToInvoiceAction,
  deleteQuoteAction,
  sendQuoteAction,
  setQuoteStatusAction,
} from '@/lib/actions/quotes';
import type { Client, QuoteStatus, QuoteView } from '@/lib/types';

/**
 * Détail d'un devis.
 *
 * Le devis et son client sont lus en base par le Server Component parent :
 * l'écran « introuvable » vit dans la page.
 */
export function QuoteDetail({
  quote,
  client,
}: {
  quote: QuoteView;
  client: Client | undefined;
}) {
  const router = useRouter();
  const { formatMoney } = useCompany();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { notice, dismiss } = useCreationNotice(`/devis/${quote.id}`);

  const totals = computeTotals(quote.items, quote.vatRate);
  const pdfUrl = `/api/devis/${quote.id}/pdf`;
  const pdfName = pdfFileName({
    number: quote.number,
    client: { name: quote.clientName },
    docType: 'quote',
  });

  /** Enveloppe commune : toute écriture remonte son refus au même endroit. */
  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      setConvertError(result.ok ? null : (result.error ?? 'Opération impossible.'));
    });
  };

  const accept: StatusAction = {
    label: 'Marquer comme accepté',
    icon: BadgeCheck,
    hint: 'Le devis pourra ensuite être converti en facture.',
    onSelect: () => run(() => setQuoteStatusAction(quote.id, 'accepted')),
  };
  const refuse: StatusAction = {
    label: 'Marquer comme refusé',
    icon: ThumbsDown,
    hint: 'Il sort des devis en attente et compte dans le taux de transformation.',
    group: 'correct',
    onSelect: () => run(() => setQuoteStatusAction(quote.id, 'refused')),
  };
  const backToSent: StatusAction = {
    label: 'Repasser en envoyé',
    icon: Undo2,
    hint: 'Le devis redevient en attente de réponse.',
    group: 'correct',
    onSelect: () => run(() => setQuoteStatusAction(quote.id, 'sent')),
  };
  const backToDraft: StatusAction = {
    label: 'Repasser en brouillon',
    icon: Undo2,
    hint: 'Le numéro déjà attribué reste acquis, pour ne pas trouer la séquence.',
    group: 'correct',
    onSelect: () => run(() => setQuoteStatusAction(quote.id, 'draft')),
  };

  /**
   * Un devis converti n'offre aucune transition : son statut est verrouillé par
   * la facture qu'il a produite. Le rouvrir laisserait croire qu'on peut défaire
   * une facture depuis ici, ce qui n'est pas le cas.
   */
  const STATUS_ACTIONS: Record<QuoteStatus, StatusAction[]> = {
    draft: [
      {
        label: 'Marquer comme envoyé',
        icon: Send,
        hint: 'Attribue le numéro définitif.',
        onSelect: () => run(() => sendQuoteAction(quote.id)),
      },
      accept,
    ],
    sent: [accept, refuse, backToDraft],
    accepted: [refuse, backToSent],
    refused: [accept, backToSent],
  };

  const statusActions = quote.invoiceId ? [] : STATUS_ACTIONS[quote.status];

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <Link
          href="/devis"
          className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft hover:text-brand-hover"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5 motion-reduce:transform-none"
            aria-hidden
          />
          Tous les devis
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="label-caps">{quote.clientName}</p>
            <StatusBadge
              status={quote.displayStatus}
              label={QUOTE_STATUS_LABELS[quote.displayStatus]}
            />
          </div>
          <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
            {quote.number ?? 'Brouillon'}
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            Émis le {formatDate(quote.issueDate)} · valable jusqu’au {formatDate(quote.validUntil)}
            {quote.displayStatus === 'expired' && (
              <span className="font-medium text-status-overdue">
                {' '}
                · {formatValidityLabel(quote.daysToExpiry)}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quote.status === 'draft' && (
            <Button
              onClick={() => run(() => sendQuoteAction(quote.id))}
              disabled={pending}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" aria-hidden />
              {pending ? 'Envoi…' : 'Envoyer'}
            </Button>
          )}
          {quote.displayStatus === 'accepted' && (
            <Button
              className="gap-1.5"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await convertQuoteToInvoiceAction(quote.id);
                  if (result.ok) router.push(`/factures/${result.data.invoiceId}?cree=1`);
                  else setConvertError(result.error);
                });
              }}
            >
              <FileOutput className="h-4 w-4" aria-hidden />
              {pending ? 'Conversion…' : 'Convertir en facture'}
            </Button>
          )}
          <StatusMenu
            status={quote.displayStatus}
            statusLabel={QUOTE_STATUS_LABELS[quote.displayStatus]}
            actions={statusActions}
            footnote={
              quote.invoiceId
                ? 'Statut figé : ce devis a produit une facture.'
                : '« Expiré » se déduit de la date de validité, il ne se choisit pas.'
            }
          />
          <DownloadPdfButton url={pdfUrl} filename={pdfName} />
          <Button
            variant="secondary"
            onClick={() => router.push(`/devis/${quote.id}/modifier`)}
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

      {convertError && (
        <p
          role="alert"
          className="rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-4 py-2.5 text-[13px] font-medium text-status-overdue"
        >
          {convertError}
        </p>
      )}

      {/* Un devis déjà facturé mène à sa facture. Sans ce lien, retrouver le
          document produit supposerait de fouiller la liste des factures. */}
      {quote.invoiceId && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-status-paid-dot bg-status-paid-bg px-5 py-3.5">
          <p className="text-[13px] font-medium text-status-paid">
            Ce devis a été converti en facture.
          </p>
          <Link
            href={`/factures/${quote.invoiceId}`}
            className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-status-paid hover:underline"
          >
            Ouvrir la facture
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none"
              aria-hidden
            />
          </Link>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Lignes du devis</CardTitle>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <caption className="sr-only">Détail des prestations proposées</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Désignation</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Qté</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Prix unitaire</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, index) => (
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
                    TVA {quote.vatRate.toString().replace('.', ',')} %
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
              </dl>
            </div>
          </Card>
        </div>
        {/* Plus de carte « Statut » ici : le menu de l'en-tête fait le même
            travail, en nommant les transitions plutôt que les états. */}

        <div className="lg:sticky lg:top-20">
          <Card className="p-4 sm:p-5">
            <p className="label-caps mb-3">Aperçu du document</p>
            <InvoicePreview
              variant="quote"
              number={quote.number}
              client={client}
              address={quote.address}
              issueDate={quote.issueDate}
              dueDate={quote.validUntil}
              lines={quote.items.map((item, index) => ({
                id: item.id,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: totals.lineTotals[index] ?? 0,
              }))}
              totals={totals}
              notes={quote.notes}
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const result = await deleteQuoteAction(quote.id);
            if (result.ok) router.push('/devis');
            else setConvertError(result.error);
          });
        }}
        title="Supprimer ce devis ?"
        description={`${quote.number ?? 'Ce brouillon'} sera définitivement supprimé. Cette action est irréversible.`}
      />

      <DocumentCreatedDialog
        open={notice !== null}
        onClose={dismiss}
        notice={notice ?? 'created'}
        kind="quote"
        number={quote.number}
        clientName={quote.clientName}
        total={formatMoney(totals.total)}
        status={quote.displayStatus}
        statusLabel={QUOTE_STATUS_LABELS[quote.displayStatus]}
        download={<DownloadPdfButton url={pdfUrl} filename={pdfName} size="sm" />}
      />
    </div>
  );
}
