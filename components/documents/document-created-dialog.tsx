'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge, type BadgeStatus } from '@/components/ui/status-badge';

export type CreationNotice = 'created' | 'sent' | 'updated';

/**
 * Confirmation affichée juste après l'enregistrement d'un document.
 *
 * Elle se montre sur la page de détail, une fois la redirection faite : à ce
 * moment le document existe pour de bon, il est sous les yeux de
 * l'utilisateur, et fermer la fenêtre ne le laisse pas sur un formulaire
 * périmé. Elle rappelle le numéro et le total — les deux seuls chiffres qu'on
 * relit — et met à portée l'action qui suit presque toujours : récupérer le PDF.
 */
const COPY: Record<CreationNotice, Record<'invoice' | 'quote', { title: string; body: string }>> = {
  created: {
    invoice: {
      title: 'Facture créée avec succès',
      body: 'Elle est enregistrée comme brouillon. Son numéro définitif lui sera attribué à l’envoi.',
    },
    quote: {
      title: 'Devis créé avec succès',
      body: 'Il est enregistré comme brouillon. Son numéro définitif lui sera attribué à l’envoi.',
    },
  },
  sent: {
    invoice: {
      title: 'Facture créée et envoyée',
      body: 'Son numéro définitif est attribué. Téléchargez le PDF pour le transmettre à votre client.',
    },
    quote: {
      title: 'Devis créé et envoyé',
      body: 'Son numéro définitif est attribué. Téléchargez le PDF pour le transmettre à votre client.',
    },
  },
  updated: {
    invoice: {
      title: 'Facture mise à jour',
      body: 'Les modifications sont enregistrées. Le PDF reflète désormais les nouveaux montants.',
    },
    quote: {
      title: 'Devis mis à jour',
      body: 'Les modifications sont enregistrées. Le PDF reflète désormais les nouveaux montants.',
    },
  },
};

export function DocumentCreatedDialog({
  open,
  onClose,
  notice,
  kind,
  number,
  clientName,
  total,
  status,
  statusLabel,
  download,
}: {
  open: boolean;
  onClose: () => void;
  notice: CreationNotice;
  kind: 'invoice' | 'quote';
  number: string | null;
  clientName: string;
  /** Total déjà formaté par le `formatMoney` du store. */
  total: string;
  status: BadgeStatus;
  statusLabel?: string;
  /** Bouton de téléchargement, fourni par l'appelant qui sait bâtir la charge PDF. */
  download?: React.ReactNode;
}) {
  const copy = COPY[notice][kind];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={copy.title}
      description={copy.body}
      className="max-w-md"
      footer={
        <>
          {download}
          <Button size="sm" onClick={onClose}>
            Continuer
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-status-paid-bg"
          aria-hidden
        >
          <Check className="h-4 w-4 text-status-paid" strokeWidth={2.4} />
        </span>

        <dl className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[12.5px] text-ink-2">Client</dt>
            <dd className="min-w-0 truncate text-[13px] font-semibold text-ink">{clientName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[12.5px] text-ink-2">Numéro</dt>
            <dd className="tabular text-[13px] font-medium text-ink">
              {number ?? <span className="text-ink-3">Attribué à l’envoi</span>}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[12.5px] text-ink-2">Statut</dt>
            <dd>
              <StatusBadge status={status} label={statusLabel} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
            <dt className="text-[13px] font-semibold text-ink">Total TTC</dt>
            <dd className="tabular text-[17px] font-bold tracking-[-0.02em] text-ink">{total}</dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}
