'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, FileOutput, Pencil, Send, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { DownloadPdfIconButton } from '@/components/pdf/download-pdf-button';
import { pdfFileName } from '@/lib/pdf/payload';
import {
  convertQuoteToInvoiceAction,
  sendQuoteAction,
  setQuoteStatusAction,
} from '@/lib/actions/quotes';
import type { QuoteView } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Actions rapides d'une ligne de devis.
 *
 * Même discipline que pour les factures : une seule action contextuelle, celle
 * que le statut appelle. Un devis avance sur un chemin unique — on l'envoie, le
 * client l'accepte, on le facture — et c'est exactement l'étape suivante qui est
 * proposée. Un devis refusé ou déjà facturé n'en propose aucune : il n'a plus
 * d'étape suivante, et un bouton qui ne mènerait nulle part serait un mensonge.
 */
export function QuoteQuickActions({
  quote,
  onDelete,
  onError,
  onConverted,
  className,
}: {
  quote: QuoteView;
  onDelete: (quote: QuoteView) => void;
  onError: (message: string) => void;
  onConverted: (invoiceId: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const stop = (event: React.MouseEvent) => event.stopPropagation();
  const label = quote.number ?? 'sans numéro';
  const status = quote.displayStatus;

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {status === 'draft' && (
        <IconButton
          icon={Send}
          label={`Envoyer le devis de ${quote.clientName}`}
          tone="brand"
          disabled={pending}
          onClick={(event) => {
            stop(event);
            startTransition(async () => {
              const result = await sendQuoteAction(quote.id);
              if (!result.ok) onError(result.error);
            });
          }}
        />
      )}

      {(status === 'sent' || status === 'expired') && (
        <IconButton
          icon={BadgeCheck}
          label={`Marquer accepté le devis ${label}`}
          tone="brand"
          disabled={pending}
          onClick={(event) => {
            stop(event);
            startTransition(async () => {
              const result = await setQuoteStatusAction(quote.id, 'accepted');
              if (!result.ok) onError(result.error);
            });
          }}
        />
      )}

      {status === 'accepted' && (
        <IconButton
          icon={FileOutput}
          label={`Convertir en facture le devis ${label}`}
          tone="brand"
          disabled={pending}
          onClick={(event) => {
            stop(event);
            startTransition(async () => {
              const result = await convertQuoteToInvoiceAction(quote.id);
              if (result.ok) onConverted(result.data.invoiceId);
              else onError(result.error);
            });
          }}
        />
      )}

      <IconButton
        icon={Pencil}
        label={`Modifier le devis ${label}`}
        onClick={(event) => {
          stop(event);
          router.push(`/devis/${quote.id}/modifier`);
        }}
      />

      <DownloadPdfIconButton
        label={`Télécharger le PDF du devis ${label}`}
        onError={onError}
        url={`/api/devis/${quote.id}/pdf`}
        filename={pdfFileName({
          number: quote.number,
          client: { name: quote.clientName },
          docType: 'quote',
        })}
      />

      <IconButton
        icon={Trash2}
        tone="danger"
        label={`Supprimer le devis ${label}`}
        onClick={(event) => {
          stop(event);
          onDelete(quote);
        }}
      />
    </div>
  );
}
