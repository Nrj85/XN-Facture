'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { useCompany } from '@/lib/company-context';
import {
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from '@/lib/actions/clients';
import type { Client, InvoiceView } from '@/lib/types';

interface FormState {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}

const EMPTY: FormState = { name: '', contactName: '', email: '', phone: '', address: '', city: '' };

function toForm(client: Client): FormState {
  return {
    name: client.name,
    contactName: client.contactName ?? '',
    email: client.email,
    phone: client.phone,
    address: client.address ?? '',
    city: client.city,
  };
}

/**
 * Clients et factures arrivent en props depuis le Server Component : ils sont
 * lus en base à chaque rendu de page, plus dans un store partagé.
 */
export function ClientList({ clients, views }: { clients: Client[]; views: InvoiceView[] }) {
  const { formatMoney } = useCompany();

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Nombre de factures rattachées, calculé sur les vues déjà chargées. */
  const countInvoicesForClient = (clientId: string) =>
    views.filter((view) => view.clientId === clientId).length;

  /** Encours par client : c'est l'information qui justifie d'ouvrir cette page. */
  const outstandingByClient = useMemo(() => {
    const totals = new Map<string, number>();
    for (const view of views) {
      if (view.displayStatus === 'sent' || view.displayStatus === 'overdue') {
        totals.set(view.clientId, (totals.get(view.clientId) ?? 0) + view.balanceDue);
      }
    }
    return totals;
  }, [views]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(needle) ||
        client.email.toLowerCase().includes(needle) ||
        client.city.toLowerCase().includes(needle),
    );
  }, [clients, query]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm(toForm(client));
    setErrors({});
    setFormOpen(true);
  }

  function submit() {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'Le nom est obligatoire.';
    if (!form.email.trim()) next.email = 'L’email est obligatoire.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Format d’email invalide.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || undefined,
      city: form.city.trim(),
    };

    startTransition(async () => {
      const result = editing
        ? await updateClientAction(editing.id, payload)
        : await createClientAction(payload);

      if (!result.ok) {
        // L'erreur serveur est rattachée au champ le plus probable — le nom —
        // plutôt qu'affichée hors du formulaire, où elle serait perdue de vue.
        setErrors({ name: result.error });
        return;
      }
      setFormOpen(false);
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);

    startTransition(async () => {
      const result = await deleteClientAction(target.id);
      // La suppression est refusée si le client porte des documents : on
      // affiche la raison plutôt que d'échouer en silence. La base la
      // refuserait aussi (`on delete restrict`), mais sans phrase utilisable.
      if (!result.ok) setRefusal(result.error);
    });
  }

  const patch = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }));

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label-caps">Carnet d’adresses</p>
          <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">Clients</h1>
          <p className="mt-2 text-sm text-ink-2">
            {clients.length} client{clients.length > 1 ? 's' : ''} enregistré
            {clients.length > 1 ? 's' : ''}.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter un client
        </Button>
      </header>

      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <CardTitle>Tous les clients</CardTitle>
          <label className="relative sm:ml-auto sm:w-64">
            <span className="sr-only">Rechercher un client</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, email ou ville"
              className="pl-9"
            />
          </label>
        </CardHeader>

        {results.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query ? 'Aucun résultat' : 'Aucun client'}
            description={
              query
                ? 'Aucun client ne correspond à cette recherche.'
                : 'Ajoutez un client pour pouvoir lui adresser des factures.'
            }
            action={
              query ? (
                <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Effacer la recherche
                </Button>
              ) : (
                <Button size="sm" onClick={openCreate}>
                  Ajouter un client
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-[13.5px]">
                <caption className="sr-only">Liste des clients</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Client</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Contact</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Téléphone</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-left">Ville</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Encours</th>
                    <th scope="col" className="label-caps px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((client) => {
                    const outstanding = outstandingByClient.get(client.id) ?? 0;
                    const invoiceCount = countInvoicesForClient(client.id);
                    return (
                      <tr key={client.id} className="border-b border-line last:border-0 hover:bg-paper">
                        <td className="px-5 py-3.5">
                          <span className="block font-semibold text-ink">{client.name}</span>
                          <span className="mt-0.5 block text-[11.5px] text-ink-3">
                            {invoiceCount} facture{invoiceCount > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-ink-2">
                          <span className="block">{client.contactName ?? '—'}</span>
                          <span className="mt-0.5 block text-[11.5px] text-ink-3">{client.email}</span>
                        </td>
                        <td className="tabular whitespace-nowrap px-5 py-3.5 text-ink-2">
                          {client.phone || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-ink-2">{client.city}</td>
                        <td className="tabular whitespace-nowrap px-5 py-3.5 text-right font-semibold text-ink">
                          {outstanding > 0 ? formatMoney(outstanding) : <span className="text-ink-3">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(client)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition-[background-color,color,transform] duration-150 ease-out hover:bg-sand hover:text-ink active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Modifier {client.name}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setToDelete(client)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition-[background-color,color,transform] duration-150 ease-out hover:bg-status-overdue-bg hover:text-status-overdue active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Supprimer {client.name}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {results.map((client) => {
                const outstanding = outstandingByClient.get(client.id) ?? 0;
                return (
                  <li key={client.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">{client.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-ink-3">{client.email}</p>
                        <p className="tabular mt-0.5 text-[12px] text-ink-3">{client.phone}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(client)}
                          className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-sand hover:text-ink"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Modifier {client.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(client)}
                          className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-status-overdue-bg hover:text-status-overdue"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Supprimer {client.name}</span>
                        </button>
                      </div>
                    </div>
                    {outstanding > 0 && (
                      <p className="tabular mt-2 text-[12.5px] text-ink-2">
                        Encours <span className="font-semibold text-ink">{formatMoney(outstanding)}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le client' : 'Ajouter un client'}
        description={editing ? editing.name : 'Ces informations apparaîtront sur ses factures.'}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={submit} disabled={pending} className="gap-1.5">
              {pending && (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {pending ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter le client'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nom ou raison sociale" required error={errors.name}>
            {(props) => (
              <Input
                {...props}
                value={form.name}
                invalid={Boolean(errors.name)}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="Sotrabat Sarl"
              />
            )}
          </Field>

          <Field label="Personne à contacter">
            {(props) => (
              <Input
                {...props}
                value={form.contactName}
                onChange={(event) => patch({ contactName: event.target.value })}
                placeholder="Alice Ngo Bat"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" required error={errors.email}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={form.email}
                  invalid={Boolean(errors.email)}
                  onChange={(event) => patch({ email: event.target.value })}
                  placeholder="contact@exemple.cm"
                />
              )}
            </Field>
            <Field label="Téléphone">
              {(props) => (
                <Input
                  {...props}
                  numeric
                  type="tel"
                  value={form.phone}
                  onChange={(event) => patch({ phone: event.target.value })}
                  placeholder="+237 6 99 00 00 00"
                />
              )}
            </Field>
          </div>

          <Field label="Adresse">
            {(props) => (
              <Input
                {...props}
                value={form.address}
                onChange={(event) => patch({ address: event.target.value })}
                placeholder="Zone industrielle Bassa, BP 1204"
              />
            )}
          </Field>

          <Field label="Ville">
            {(props) => (
              <Input
                {...props}
                value={form.city}
                onChange={(event) => patch({ city: event.target.value })}
                placeholder="Douala"
              />
            )}
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Supprimer ce client ?"
        description={`${toDelete?.name ?? ''} sera retiré de votre carnet d’adresses. Cette action est irréversible.`}
      />

      <Dialog
        open={refusal !== null}
        onClose={() => setRefusal(null)}
        title="Suppression impossible"
        description={refusal ?? ''}
        footer={
          <Button size="sm" onClick={() => setRefusal(null)}>
            J’ai compris
          </Button>
        }
      />
    </div>
  );
}
