'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { LineItemsEditor, parseNumber, type DraftItem } from '@/components/invoices/line-items-editor';
import { TotalsSummary } from '@/components/invoices/totals-summary';
import { InvoicePreview } from '@/components/invoices/invoice-preview';
import { computeTotals } from '@/lib/invoice-calc';
import { addDays } from '@/lib/format';

import { QUOTE_NOTES, QUOTE_VALIDITY_DAYS } from '@/lib/quotes';
import { useCompany } from '@/lib/company-context';
import { createQuoteAction, updateQuoteAction, type QuoteDraftInput } from '@/lib/actions/quotes';
import type { Client, QuoteView } from '@/lib/types';

/**
 * Création et modification d'un devis.
 *
 * Jumeau du formulaire de facture, dont il reprend l'éditeur de lignes, le
 * récapitulatif et l'aperçu. Les deux écrans ne sont volontairement pas fondus
 * en un seul composant paramétré : leurs champs propres — numéro attribué à
 * l'envoi contre durée de validité, mentions par défaut opposées — auraient
 * rempli le fichier de conditions, et un formulaire qui manipule de l'argent
 * doit rester lisible d'un bout à l'autre.
 */

interface FormState {
  clientId: string;
  issueDate: string;
  validUntil: string;
  address: string;
  notes: string;
  items: DraftItem[];
}

function emptyItem(suffix: string): DraftItem {
  return { id: `l_${suffix}`, description: '', quantity: '1', unitPrice: '' };
}

function initialState(today: string, quote?: QuoteView): FormState {
  if (quote) {
    return {
      clientId: quote.clientId,
      issueDate: quote.issueDate,
      validUntil: quote.validUntil,
      address: quote.address,
      notes: quote.notes ?? '',
      items: quote.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })),
    };
  }
  return {
    clientId: '',
    issueDate: today,
    validUntil: addDays(today, QUOTE_VALIDITY_DAYS),
    address: '',
    notes: QUOTE_NOTES,
    items: [emptyItem('1')],
  };
}

type Errors = Partial<Record<'clientId' | 'validUntil' | 'items', string>>;

export function QuoteForm({
  clients,
  today,
  quote,
}: {
  clients: Client[];
  today: string;
  quote?: QuoteView;
}) {
  const router = useRouter();
  const { company } = useCompany();
  const isEditing = Boolean(quote);

  const [form, setForm] = useState<FormState>(() => initialState(today, quote));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const [showPreview, setShowPreview] = useState(true);

  // Le taux de TVA du devis en cours de modification prime sur celui de
  // l'entreprise : réviser un devis ne doit pas en changer le montant proposé.
  const vatRate = quote?.vatRate ?? company.vatRate;

  const selectedClient = clients.find((client) => client.id === form.clientId);

  const parsedItems = useMemo(
    () =>
      form.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: parseNumber(item.quantity),
        unitPrice: parseNumber(item.unitPrice),
      })),
    [form.items],
  );

  const totals = useMemo(() => computeTotals(parsedItems, vatRate), [parsedItems, vatRate]);

  // Seules les lignes réellement commencées apparaissent dans l'aperçu : une
  // ligne vierge affichée en « Sans désignation · 1 · 0 » laisserait croire
  // qu'elle figurera sur le document envoyé.
  const previewLines = parsedItems
    .map((item, index) => ({ ...item, total: totals.lineTotals[index] ?? 0 }))
    .filter((line) => line.description.trim() !== '' || line.unitPrice > 0);

  const patch = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }));

  /** Sélectionner un client reprend son adresse, tant qu'elle n'a pas été retouchée. */
  const onClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    const previous = clients.find((c) => c.id === form.clientId);
    const addressUntouched =
      form.address === '' ||
      (previous && form.address === `${previous.address ?? ''}, ${previous.city}`);

    patch({
      clientId,
      address: addressUntouched && client ? `${client.address ?? ''}, ${client.city}` : form.address,
    });
  };

  function validate(): Errors {
    const next: Errors = {};
    if (!form.clientId) next.clientId = 'Choisissez un client.';
    if (form.validUntil < form.issueDate) {
      next.validUntil = 'La date de validité ne peut pas précéder la date d’émission.';
    }
    const usable = parsedItems.filter(
      (item) => item.description.trim() !== '' && item.quantity > 0 && item.unitPrice > 0,
    );
    if (usable.length === 0) {
      next.items = 'Ajoutez au moins une ligne avec une désignation, une quantité et un prix.';
    }
    return next;
  }

  function buildDraft(): QuoteDraftInput {
    return {
      clientId: form.clientId,
      issueDate: form.issueDate,
      validUntil: form.validUntil,
      address: form.address,
      notes: form.notes.trim() || undefined,
      items: parsedItems
        .filter((item) => item.description.trim() !== '' || item.unitPrice > 0)
        .map((item) => ({
          id: item.id,
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice),
        })),
    };
  }

  function submit(send: boolean) {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const draft = buildDraft();

    startTransition(async () => {
      if (quote) {
        const result = await updateQuoteAction(quote.id, draft);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        router.push(`/devis/${quote.id}?maj=1`);
        return;
      }

      const result = await createQuoteAction(draft, { send });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      // Le paramètre déclenche la fenêtre de confirmation sur la page de détail.
      router.push(`/devis/${result.data.id}?cree=1${send ? '&envoye=1' : ''}`);
    });
  }

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label-caps">{isEditing ? 'Modification' : 'Nouveau devis'}</p>
          <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
            {isEditing ? (quote?.number ?? 'Brouillon') : 'Créer un devis'}
          </h1>
          <div className="mt-3">
            <Switch checked={showPreview} onCheckedChange={setShowPreview} label="Afficher l’aperçu" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => submit(false)} disabled={pending}>
            {isEditing ? 'Enregistrer' : 'Enregistrer comme brouillon'}
          </Button>
          {!isEditing && (
            <Button onClick={() => submit(true)} disabled={pending} className="gap-2">
              {pending && (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {pending ? 'Enregistrement…' : 'Envoyer le devis'}
            </Button>
          )}
        </div>
      </header>

      {serverError && (
        <p
          role="alert"
          className="rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-4 py-2.5 text-[13px] font-medium text-status-overdue"
        >
          {serverError}
        </p>
      )}

      <div
        className={
          showPreview
            ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start'
            : 'grid gap-5'
        }
      >
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Détails du devis</CardTitle>
            </CardHeader>
            <div className="space-y-4 p-5">
              <Field label="Client" required error={errors.clientId}>
                {(props) => (
                  <Combobox
                    {...props}
                    searchable
                    value={form.clientId}
                    onChange={onClientChange}
                    invalid={Boolean(errors.clientId)}
                    placeholder="Rechercher un client"
                    emptyLabel="Aucun client ne correspond"
                    options={clients.map((client) => ({
                      value: client.id,
                      label: client.name,
                      hint: `${client.city} · ${client.email}`,
                    }))}
                  />
                )}
              </Field>

              <Field
                label="Numéro de devis"
                hint="Attribué automatiquement à l’envoi, sur une séquence distincte de celle des factures."
              >
                {(props) => (
                  <Input
                    {...props}
                    readOnly
                    numeric
                    value={quote?.number ?? 'Attribué à l’envoi'}
                    className="bg-sand text-ink-3"
                  />
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date d’émission" required>
                  {(props) => (
                    <DatePicker
                      {...props}
                      today={today}
                      value={form.issueDate}
                      onChange={(issueDate) => patch({ issueDate })}
                    />
                  )}
                </Field>
                <Field
                  label="Valable jusqu’au"
                  required
                  error={errors.validUntil}
                  hint={errors.validUntil ? undefined : 'Passée cette date, le devis s’affiche « expiré ».'}
                >
                  {(props) => (
                    <DatePicker
                      {...props}
                      today={today}
                      value={form.validUntil}
                      min={form.issueDate}
                      invalid={Boolean(errors.validUntil)}
                      onChange={(validUntil) => patch({ validUntil })}
                    />
                  )}
                </Field>
              </div>

              <Field label="Adresse du destinataire">
                {(props) => (
                  <Input
                    {...props}
                    value={form.address}
                    placeholder="Reprise du client sélectionné"
                    onChange={(event) => patch({ address: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Lignes du devis</CardTitle>
                <p className="mt-0.5 text-[12.5px] text-ink-3">
                  Montants en {company.currency === 'XAF' ? 'FCFA' : 'F CFA'}, sans centimes
                </p>
              </div>
            </CardHeader>
            <div className="p-5">
              <LineItemsEditor
                items={form.items}
                onChange={(items) => patch({ items })}
                error={errors.items}
              />

              <div className="mt-5 border-t border-line pt-4">
                <TotalsSummary totals={totals} className="ml-auto max-w-xs" />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Note</CardTitle>
            </CardHeader>
            <div className="p-5">
              <Field label="Mention affichée en bas du devis">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={3}
                    value={form.notes}
                    placeholder="Conditions de l’offre, délais de réalisation, modalités d’acceptation…"
                    onChange={(event) => patch({ notes: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </Card>
        </div>

        {showPreview && (
          <div className="lg:sticky lg:top-20">
            <Card className="p-4 sm:p-5">
              <p className="label-caps mb-3">Aperçu</p>
              <InvoicePreview
                variant="quote"
                number={quote?.number ?? null}
                client={selectedClient}
                address={form.address}
                issueDate={form.issueDate}
                dueDate={form.validUntil}
                lines={previewLines}
                totals={totals}
                notes={form.notes.trim() || undefined}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
