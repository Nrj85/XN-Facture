'use client';

import { DownloadPdfButton } from '@/components/pdf/download-pdf-button';
import { pdfFileName } from '@/lib/pdf/payload';
import type { InvoiceView } from '@/lib/types';

/**
 * Téléchargement du PDF d'une facture.
 *
 * Réduit à une adresse et un nom de fichier : la facture est relue côté
 * serveur, le navigateur n'a plus rien à transmettre.
 */
export function DownloadInvoiceButton({
  invoice,
  variant = 'secondary',
  size = 'md',
}: {
  invoice: InvoiceView;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
}) {
  return (
    <DownloadPdfButton
      variant={variant}
      size={size}
      url={`/api/factures/${invoice.id}/pdf`}
      filename={pdfFileName({
        number: invoice.number,
        client: { name: invoice.clientName },
        docType: 'invoice',
      })}
    />
  );
}
