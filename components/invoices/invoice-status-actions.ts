import { BadgeCheck, Ban, Coins, RotateCcw, Send, Undo2 } from 'lucide-react';
import type { StatusAction } from '@/components/documents/status-menu';
import { sendInvoiceAction, setInvoiceStatusAction } from '@/lib/actions/invoices';
import type { InvoiceView } from '@/lib/types';

/**
 * Transitions de statut d'une facture — **table unique**.
 *
 * Elle vivait dans `invoice-detail.tsx`. Le tableau de bord ayant désormais lui
 * aussi un menu d'actions, la recopier aurait garanti qu'un jour les deux
 * divergent : une transition ajoutée d'un côté, absente de l'autre, sur des
 * opérations qui attribuent un numéro ou soldent un encaissement.
 *
 * Les transitions sont construites à partir du statut **stocké**, jamais de
 * l'affiché : « en retard » n'est pas un état qu'on quitte, c'est une facture
 * envoyée dont l'échéance est passée. Les deux se traitent identiquement.
 *
 * Chaque entrée est nommée par ce qu'elle FAIT — « Marquer comme payée », et
 * non « Payée ». Les transitions impossibles sont absentes, pas grisées.
 */
export function invoiceStatusActions({
  invoice,
  total,
  formatMoney,
  run,
  onRecordPayment,
}: {
  invoice: InvoiceView;
  /** Total TTC, pour annoncer ce que « Marquer comme payée » va solder. */
  total: number;
  formatMoney: (amount: number) => string;
  /** Enveloppe d'écriture de l'appelant : elle porte le `useTransition` et l'erreur. */
  run: (action: () => Promise<{ ok: boolean; error?: string }>) => void;
  /** Un statut qui suppose un montant se saisit par son montant. */
  onRecordPayment: () => void;
}): StatusAction[] {
  const markPaid: StatusAction = {
    label: 'Marquer comme payée',
    icon: BadgeCheck,
    hint: `Solde la facture à ${formatMoney(total)}.`,
    onSelect: () => run(() => setInvoiceStatusAction(invoice.id, 'paid')),
  };

  const recordPartial: StatusAction = {
    label:
      invoice.amountPaid > 0 ? 'Corriger l’encaissement' : 'Enregistrer un encaissement partiel',
    icon: Coins,
    hint: 'Le statut se déduira du montant reçu.',
    onSelect: onRecordPayment,
  };

  const cancel: StatusAction = {
    label: 'Annuler la facture',
    icon: Ban,
    hint: 'Elle sort des statistiques mais garde son numéro.',
    group: 'correct',
    onSelect: () => run(() => setInvoiceStatusAction(invoice.id, 'cancelled')),
  };

  const backToDraft: StatusAction = {
    label: 'Repasser en brouillon',
    icon: Undo2,
    hint: 'Le numéro déjà attribué reste acquis, pour ne pas trouer la séquence.',
    group: 'correct',
    onSelect: () => run(() => setInvoiceStatusAction(invoice.id, 'draft')),
  };

  const byStatus: Record<InvoiceView['status'], StatusAction[]> = {
    draft: [
      {
        label: 'Marquer comme envoyée',
        icon: Send,
        hint: 'Attribue le numéro définitif.',
        onSelect: () => run(() => sendInvoiceAction(invoice.id)),
      },
      markPaid,
      cancel,
    ],
    sent: [markPaid, recordPartial, backToDraft, cancel],
    partially_paid: [markPaid, recordPartial, cancel],
    paid: [
      {
        label: 'Annuler le règlement',
        icon: RotateCcw,
        hint: 'La facture repasse en attente d’encaissement.',
        group: 'correct',
        onSelect: () => run(() => setInvoiceStatusAction(invoice.id, 'sent')),
      },
    ],
    cancelled: [
      {
        label: 'Rétablir la facture',
        icon: RotateCcw,
        hint: 'Elle repasse en attente d’encaissement.',
        onSelect: () => run(() => setInvoiceStatusAction(invoice.id, 'sent')),
      },
    ],
  };

  return byStatus[invoice.status];
}
