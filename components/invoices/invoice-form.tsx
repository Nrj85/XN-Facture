'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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

import { useCompany } from '@/lib/company-context';
import { createInvoiceAction, updateInvoiceAction, type InvoiceDraftInput } from '@/lib/actions/invoices';
import type { Client, Company, InvoiceView } from '@/lib/types';

interface FormState {
  clientId: string;
  issueDate: string;
  dueDate: string;
  address: string;
  notes: string;
  items: DraftItem[];
}

function emptyItem(suffix: string): DraftItem {
  return { id: `l_${suffix}`, description: '', quantity: '1', unitPrice: '' };
}

function initialState(company: Company, today: string, invoice?: InvoiceView): FormState {
  if (invoice) {
    return {
      clientId: invoice.clientId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      address: invoice.address,
      notes: invoice.notes ?? '',
      items: invoice.items.map((item) => ({
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
    dueDate: addDays(today, company.paymentTermsDays),
    address: '',
    // La mention par défaut vient des paramètres : la ressaisir à chaque
    // facture serait absurde.
    notes: company.defaultNotes ?? '',
    items: [emptyItem('1')],
  };
}

type Errors = Partial<Record<'clientId' | 'dueDate' | 'items', string>>;

/**
 * `today` arrive en props depuis le serveur plutôt que d'être calculé ici :
 * évalué des deux côtés, il pourrait différer d'un jour entre le rendu serveur
 * et le rendu client si la requête traverse minuit — et React signalerait une
 * incohérence d'hydratation sur une date de facture.
 */
export function InvoiceForm({
  clients,
  today,
  invoice,
}: {
  clients: Client[];
  today: string;
  invoice?: InvoiceView;
}) {
  const router = useRouter();
  const { company } = useCompany();
  const isEditing = Boolean(invoice);

  const [form, setForm] = useState<FormState>(() => initialState(company, today, invoice));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const [showPreview, setShowPreview] = useState(true);
  // Champs dérivés des paramètres : on cesse de les recalculer dès que
  // l'utilisateur y a touché.
  const [dueTouched, setDueTouched] = useState(false);
  const [notesTouched, setNotesTouched] = useState(false);

  /**
   * L'échéance et la mention par défaut suivent les paramètres tant que
   * l'utilisateur n'y a pas touché. Utile quand on modifie le délai de
   * règlement pendant qu'un formulaire est ouvert dans un autre onglet.
   */
  useEffect(() => {
    if (invoice) return; // En modification, on ne réécrit jamais les valeurs saisies.
    setForm((current) => ({
      ...current,
      dueDate: dueTouched ? current.dueDate : addDays(current.issueDate, company.paymentTermsDays),
      notes: notesTouched ? current.notes : (company.defaultNotes ?? ''),
    }));
  }, [company.paymentTermsDays, company.defaultNotes, invoice, dueTouched, notesTouched, form.issueDate]);

  const selectedClient = clients.find((client) => client.id === form.clientId);

  // Recalculé à chaque frappe, par le même moteur que l'enregistrement : l'aperçu
  // ne peut pas afficher un montant différent de celui qui sera stocké.
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

  const totals = useMemo(
    () => computeTotals(parsedItems, invoice?.vatRate ?? company.vatRate),
    [parsedItems, invoice?.vatRate, company.vatRate],
  );

  // L'aperçu ne montre que les lignes réellement commencées : sur un formulaire
  // vierge, afficher une ligne « Sans désignation · 1 · 0 » donnerait à croire
  // qu'elle figurera sur le document.
  const previewLines = parsedItems
    .map((item, index) => ({ ...item, total: totals.lineTotals[index] ?? 0 }))
    .filter((line) => line.description.trim() !== '' || line.unitPrice > 0);

  const patch = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }));

  /** Sélectionner un client reprend son adresse, tant qu'elle n'a pas été retouchée. */
  const onClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    const previous = clients.find((c) => c.id === form.clientId);
    const addressUntouched =
      form.address === '' || (previous && form.address === `${previous.address ?? ''}, ${previous.city}`);

    patch({
      clientId,
      address: addressUntouched && client ? `${client.address ?? ''}, ${client.city}` : form.address,
    });
  };

  function validate(): Errors {
    const next: Errors = {};
    if (!form.clientId) next.clientId = 'Choisissez un client.';
    if (form.dueDate < form.issueDate) {
      next.dueDate = 'L’échéance ne peut pas précéder la date d’émission.';
    }
    const usable = parsedItems.filter(
      (item) => item.description.trim() !== '' && item.quantity > 0 && item.unitPrice > 0,
    );
    if (usable.length === 0) {
      next.items = 'Ajoutez au moins une ligne avec une désignation, une quantité et un prix.';
    }
    return next;
  }

  function buildDraft(): InvoiceDraftInput {
    return {
      clientId: form.clientId,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      address: form.address,
      notes: form.notes.trim() || undefined,
      // Les lignes vides sont écartées à l'enregistrement, pas pendant la saisie :
      // supprimer une ligne sous les doigts de l'utilisateur serait hostile.
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
      if (invoice) {
        const result = await updateInvoiceAction(invoice.id, draft);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        router.push(`/factures/${invoice.id}?maj=1`);
        return;
      }

      const result = await createInvoiceAction(draft, { send });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      // Le drapeau déclenche la fenêtre de confirmation sur la page de détail,
      // une fois la facture réellement en base.
      router.push(`/factures/${result.data.id}?cree=1${send ? '&envoye=1' : ''}`);
    });
  }

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label-caps">{isEditing ? 'Modification' : 'Nouvelle facture'}</p>
          <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
            {isEditing ? invoice?.number ?? 'Brouillon' : 'Créer une facture'}
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
              {pending ? 'Enregistrement…' : 'Envoyer la facture'}
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
              <CardTitle>Détails de la facture</CardTitle>
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
                label="Numéro de facture"
                hint="Attribué automatiquement à l’envoi. Un brouillon n’en consomme pas, ce qui évite les trous dans la séquence."
              >
                {(props) => (
                  <Input
                    {...props}
                    readOnly
                    numeric
                    value={invoice?.number ?? 'Attribué à l’envoi'}
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
                <Field label="Date d’échéance" required error={errors.dueDate}>
                  {(props) => (
                    <DatePicker
                      {...props}
                      today={today}
                      value={form.dueDate}
                      // Une échéance antérieure à l'émission n'a pas de sens :
                      // on l'empêche plutôt que de la refuser après coup.
                      min={form.issueDate}
                      invalid={Boolean(errors.dueDate)}
                      onChange={(dueDate) => {
                        setDueTouched(true);
                        patch({ dueDate });
                      }}
                    />
                  )}
                </Field>
              </div>

              <Field label="Adresse de facturation">
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
                <CardTitle>Lignes de facture</CardTitle>
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
              <Field label="Mention affichée en bas de la facture">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={3}
                    value={form.notes}
                    placeholder="Conditions de règlement, coordonnées bancaires, remerciements…"
                    onChange={(event) => {
                      setNotesTouched(true);
                      patch({ notes: event.target.value });
                    }}
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
                number={invoice?.number ?? null}
                client={selectedClient}
                address={form.address}
                issueDate={form.issueDate}
                dueDate={form.dueDate}
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
