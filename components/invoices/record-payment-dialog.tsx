'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useCompany } from '@/lib/company-context';
import { recordPaymentAction } from '@/lib/actions/invoices';
import type { InvoiceView } from '@/lib/types';

/**
 * Saisie d'un encaissement.
 *
 * « Marquer comme partiellement payée » sans demander le montant produirait un
 * statut vide de sens : la facture s'annoncerait partiellement réglée avec zéro
 * franc encaissé, et le reste à encaisser du tableau de bord serait faux. Le
 * montant est donc la donnée, le statut n'en est que la conséquence.
 */
function parseAmount(value: string): number {
  // On tolère les espaces de milliers et la virgule décimale, comme on les tape.
  const cleaned = value.replace(/[\s  ]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function RecordPaymentDialog({
  open,
  onClose,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceView;
}) {
  const { formatMoney } = useCompany();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  // Le solde restant est la réponse attendue dans la grande majorité des cas :
  // on la propose, sans l'imposer.
  useEffect(() => {
    if (!open) return;
    setText(String(invoice.balanceDue));
    setError(undefined);
  }, [open, invoice.balanceDue]);

  function confirm() {
    const amount = parseAmount(text);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Saisissez un montant supérieur à zéro.');
      return;
    }
    if (amount > invoice.total) {
      setError(`Le montant dépasse le total de la facture (${formatMoney(invoice.total)}).`);
      return;
    }

    // Le serveur revalide la borne à partir des lignes relues en base : la
    // vérification ci-dessus est un confort, pas une garantie.
    startTransition(async () => {
      const result = await recordPaymentAction(invoice.id, amount);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  const amount = parseAmount(text);
  const preview =
    Number.isFinite(amount) && amount > 0 && amount <= invoice.total
      ? amount >= invoice.total
        ? 'La facture passera à « Payée ».'
        : `La facture passera à « Partiellement payée », reste dû ${formatMoney(invoice.total - Math.round(amount))}.`
      : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enregistrer un encaissement"
      description={`${invoice.number ?? 'Ce brouillon'} — ${invoice.clientName}`}
      className="max-w-md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button size="sm" onClick={confirm} disabled={pending} className="gap-1.5">
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            )}
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <dl className="mb-4 space-y-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[12.5px] text-ink-2">Total TTC</dt>
          <dd className="tabular text-[13px] font-medium text-ink">{formatMoney(invoice.total)}</dd>
        </div>
        {invoice.amountPaid > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[12.5px] text-ink-2">Déjà encaissé</dt>
            <dd className="tabular text-[13px] font-medium text-status-paid">
              {formatMoney(invoice.amountPaid)}
            </dd>
          </div>
        )}
      </dl>

      <Field
        label="Montant encaissé au total"
        required
        error={error}
        hint={error ? undefined : preview}
      >
        {(props) => (
          <Input
            {...props}
            numeric
            inputMode="numeric"
            autoFocus
            value={text}
            invalid={Boolean(error)}
            onChange={(event) => {
              setText(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirm();
            }}
          />
        )}
      </Field>

      {/* Le champ porte le CUMUL, pas le versement du jour : c'est ce que le
          modèle stocke, et laisser croire à un ajout ferait doubler le montant
          au second encaissement. */}
      <p className="mt-2 text-[11.5px] leading-snug text-ink-3">
        Indiquez le total reçu à ce jour, versements précédents compris.
      </p>
    </Dialog>
  );
}
