'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Pencil, Send, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { DownloadPdfIconButton } from '@/components/pdf/download-pdf-button';
import { pdfFileName } from '@/lib/pdf/payload';
import { sendInvoiceAction, setInvoiceStatusAction } from '@/lib/actions/invoices';
import type { InvoiceView } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Actions rapides d'une ligne de facture.
 *
 * Trois règles ont façonné cette rangée :
 *
 * 1. L'action la plus utile dépend du statut. Un brouillon attend d'être
 *    envoyé, une facture envoyée attend d'être encaissée, une facture payée
 *    n'attend plus rien. Une seule action contextuelle est proposée, en tête —
 *    afficher les deux, dont une inapplicable, obligerait à lire avant de
 *    cliquer.
 * 2. Rien ne flotte. Un menu déroulant serait rogné par le `overflow-x-auto`
 *    du tableau ; les boutons sont donc posés à plat dans la cellule.
 * 3. Chaque bouton arrête la propagation du clic : la ligne entière est un
 *    raccourci vers le détail, et supprimer une facture ne doit pas
 *    accessoirement l'ouvrir.
 *
 * Les écritures sont désormais des Server Actions : les boutons se désactivent
 * le temps de l'aller-retour, faute de quoi un double clic enverrait deux fois
 * la même facture.
 */
export function InvoiceQuickActions({
  invoice,
  onDelete,
  onError,
  className,
}: {
  invoice: InvoiceView;
  /** La confirmation vit dans la liste : une modale par ligne serait absurde. */
  onDelete: (invoice: InvoiceView) => void;
  onError: (message: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const stop = (event: React.MouseEvent) => event.stopPropagation();
  const isDraft = invoice.status === 'draft';
  const collectable =
    invoice.displayStatus === 'sent' ||
    invoice.displayStatus === 'overdue' ||
    invoice.status === 'partially_paid';

  const label = invoice.number ?? 'sans numéro';

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {isDraft && (
        <IconButton
          icon={Send}
          label={`Envoyer la facture de ${invoice.clientName}`}
          tone="brand"
          disabled={pending}
          onClick={(event) => {
            stop(event);
            startTransition(async () => {
              const result = await sendInvoiceAction(invoice.id);
              if (!result.ok) onError(result.error);
            });
          }}
        />
      )}

      {collectable && (
        <IconButton
          icon={BadgeCheck}
          label={`Marquer payée la facture ${label}`}
          tone="brand"
          disabled={pending}
          onClick={(event) => {
            stop(event);
            startTransition(async () => {
              const result = await setInvoiceStatusAction(invoice.id, 'paid');
              if (!result.ok) onError(result.error);
            });
          }}
        />
      )}

      <IconButton
        icon={Pencil}
        label={`Modifier la facture ${label}`}
        onClick={(event) => {
          stop(event);
          router.push(`/factures/${invoice.id}/modifier`);
        }}
      />

      <DownloadPdfIconButton
        label={`Télécharger le PDF de la facture ${label}`}
        onError={onError}
        url={`/api/factures/${invoice.id}/pdf`}
        filename={pdfFileName({
          number: invoice.number,
          client: { name: invoice.clientName },
          docType: 'invoice',
        })}
      />

      <IconButton
        icon={Trash2}
        tone="danger"
        label={`Supprimer la facture ${label}`}
        onClick={(event) => {
          stop(event);
          onDelete(invoice);
        }}
      />
    </div>
  );
}
