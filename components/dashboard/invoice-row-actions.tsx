'use client';

import { usePlanLimit } from '@/components/subscription/plan-limit';
import type { ActionResult } from '@/lib/actions/result';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { ActionMenu, type MenuAction } from '@/components/ui/action-menu';
import { invoiceStatusActions } from '@/components/invoices/invoice-status-actions';
import { pdfFileName } from '@/lib/pdf/payload';
import { usePdfDownload } from '@/lib/pdf/use-pdf-download';
import { useCompany } from '@/lib/company-context';
import { useT } from '@/lib/i18n/context';
import type { InvoiceView } from '@/lib/types';

/**
 * Menu ⋯ d'une ligne de facture du tableau de bord.
 *
 * Il rassemble ce qu'on veut faire sans quitter l'écran : modifier,
 * télécharger, changer de statut, supprimer.
 *
 * **Les transitions de statut ne sont pas réécrites ici** : elles viennent de
 * `invoiceStatusActions`, la même table que la page de détail. Un menu qui
 * proposerait « Marquer comme payée » sur une facture annulée, ou qui
 * oublierait une transition ajoutée ailleurs, serait pire que pas de menu.
 *
 * La suppression et l'encaissement remontent à la liste : la confirmation et
 * la saisie du montant vivent là-haut, en un seul exemplaire, plutôt qu'une
 * modale par ligne.
 */
export function InvoiceRowActions({
  invoice,
  onDelete,
  onRecordPayment,
  onError,
}: {
  invoice: InvoiceView;
  onDelete: (invoice: InvoiceView) => void;
  onRecordPayment: (invoice: InvoiceView) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const { formatMoney } = useCompany();
  const t = useT();
  const { download } = usePdfDownload();
  const [, startTransition] = useTransition();
  const planLimit = usePlanLimit();

  const run = (action: () => Promise<ActionResult<unknown>>) => {
    startTransition(async () => {
      const result = await action();
      if (result.ok) return;
      if (planLimit.report(result)) return;
      onError(result.error);
    });
  };

  const transitions = invoiceStatusActions({
    invoice,
    total: invoice.total,
    formatMoney,
    run,
    onRecordPayment: () => onRecordPayment(invoice),
  });

  const actions: MenuAction[] = [
    {
      label: t.rowActions.open,
      icon: Pencil,
      hint: t.rowActions.openHint,
      onSelect: () => router.push(`/factures/${invoice.id}`),
    },
    {
      label: t.rowActions.download,
      icon: Download,
      onSelect: async () => {
        const nom = pdfFileName({
          docType: 'invoice',
          number: invoice.number,
          client: { name: invoice.clientName },
        });
        const echec = await download(`/api/factures/${invoice.id}/pdf`, nom);
        if (echec) onError(echec);
      },
    },
    // Les transitions gardent leur ordre et leur regroupement d'origine ;
    // seul le premier « correctif » porte le filet de séparation.
    ...transitions.map((action, index): MenuAction => ({
      label: action.label,
      icon: action.icon,
      hint: action.hint,
      onSelect: action.onSelect,
      separated:
        index === 0 ||
        (action.group === 'correct' && transitions[index - 1]?.group !== 'correct'),
    })),
    {
      label: t.rowActions.delete,
      icon: Trash2,
      hint: t.rowActions.deleteHint,
      tone: 'danger',
      separated: true,
      onSelect: () => onDelete(invoice),
    },
  ];

  return (
    <ActionMenu
      actions={actions}
      label={t.rowActions.label(invoice.number ?? t.rowActions.thisDraft)}
      title={invoice.number ?? t.rowActions.draft}
    />
  );
}
