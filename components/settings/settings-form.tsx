'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LogoUploader } from '@/components/settings/logo-uploader';
import { useCompany } from '@/lib/company-context';
import { updateCompanyAction } from '@/lib/actions/company';
import type { Company } from '@/lib/types';
import type { Currency } from '@/lib/money';

type Errors = Partial<Record<keyof Company, string>>;

const CURRENCIES = [
  { value: 'XAF', label: 'Franc CFA — BEAC (XAF)', hint: 'Cameroun, Gabon, Tchad, Congo, RCA, Guinée équatoriale' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)', hint: 'Sénégal, Côte d’Ivoire, Mali, Bénin, Burkina, Niger, Togo' },
];

/** Champ numérique tolérant la virgule décimale, comme on la tape en français. */
function parseRate(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function SettingsForm({ issuedCount }: { issuedCount: number }) {
  const { company } = useCompany();

  const [form, setForm] = useState<Company>(company);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  // Champs texte des nombres : on ne convertit qu'à l'enregistrement, sinon on
  // se bat avec le curseur pendant la frappe.
  const [vatText, setVatText] = useState(String(company.vatRate).replace('.', ','));
  const [termsText, setTermsText] = useState(String(company.paymentTermsDays));

  // Après enregistrement, `revalidatePath` renvoie une entreprise fraîche
  // depuis le serveur : on réaligne le formulaire dessus, sans quoi le
  // marqueur « modifié » resterait allumé sur des valeurs déjà écrites.
  useEffect(() => {
    setForm(company);
    setVatText(String(company.vatRate).replace('.', ','));
    setTermsText(String(company.paymentTermsDays));
  }, [company]);

  const dirty = useMemo(
    () =>
      JSON.stringify(form) !== JSON.stringify(company) ||
      parseRate(vatText) !== company.vatRate ||
      Number(termsText) !== company.paymentTermsDays,
    [form, company, vatText, termsText],
  );

  const patch = (changes: Partial<Company>) => {
    setForm((current) => ({ ...current, ...changes }));
    setSaved(false);
  };

  function validate(): Errors {
    const next: Errors = {};
    if (!form.name.trim()) next.name = 'Le nom commercial est obligatoire.';
    if (!form.legalName.trim()) next.legalName = 'La raison sociale est obligatoire.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Format d’email invalide.';
    }

    const vat = parseRate(vatText);
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      next.vatRate = 'Taux attendu entre 0 et 100.';
    }

    const terms = Number(termsText);
    if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
      next.paymentTermsDays = 'Délai attendu entre 0 et 365 jours.';
    }

    if (!/^[A-Z0-9-]{2,10}$/.test(form.invoicePrefix.trim().toUpperCase())) {
      next.invoicePrefix = 'De 2 à 10 caractères : lettres majuscules, chiffres ou tiret.';
    }
    return next;
  }

  function save() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // La validation locale reste : elle rend la main immédiatement, sans
    // aller-retour réseau. Le serveur revalide de son côté — la vérification
    // côté client est un confort, jamais une garantie.
    startTransition(async () => {
      const result = await updateCompanyAction({
        ...form,
        name: form.name.trim(),
        legalName: form.legalName.trim(),
        email: form.email.trim(),
        invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
        vatRate: parseRate(vatText),
        paymentTermsDays: Number(termsText),
      });

      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setServerError(undefined);
      setSaved(true);
    });
  }

  function reset() {
    setForm(company);
    setVatText(String(company.vatRate).replace('.', ','));
    setTermsText(String(company.paymentTermsDays));
    setErrors({});
    setServerError(undefined);
    setSaved(false);
  }

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label-caps">Configuration</p>
          <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">Paramètres</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-2">
            Ces informations apparaissent sur chaque facture émise. Les mentions légales sont
            obligatoires au Cameroun et dans la zone CEMAC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {saved && !dirty && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-status-paid">
              <Check className="h-4 w-4" aria-hidden />
              Enregistré
            </span>
          )}
          {dirty && (
            <Button variant="secondary" onClick={reset} disabled={pending}>
              Annuler
            </Button>
          )}
          <Button onClick={save} disabled={!dirty || pending} className="gap-2">
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            )}
            {pending ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </Button>
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

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Identité</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Le nom commercial s’affiche dans l’application, la raison sociale sur les factures.
            </p>
          </div>
        </CardHeader>
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom commercial" required error={errors.name}>
              {(props) => (
                <Input
                  {...props}
                  value={form.name}
                  invalid={Boolean(errors.name)}
                  onChange={(event) => patch({ name: event.target.value })}
                />
              )}
            </Field>
            <Field label="Raison sociale" required error={errors.legalName}>
              {(props) => (
                <Input
                  {...props}
                  value={form.legalName}
                  invalid={Boolean(errors.legalName)}
                  onChange={(event) => patch({ legalName: event.target.value })}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="NIU — numéro d’identifiant unique"
              hint="Délivré par la DGI. Mention obligatoire sur la facture."
            >
              {(props) => (
                <Input
                  {...props}
                  numeric
                  value={form.niu}
                  placeholder="M071812345678X"
                  onChange={(event) => patch({ niu: event.target.value })}
                />
              )}
            </Field>
            <Field label="RCCM" hint="Registre du commerce et du crédit mobilier.">
              {(props) => (
                <Input
                  {...props}
                  numeric
                  value={form.rccm}
                  placeholder="RC/YAO/2019/B/1204"
                  onChange={(event) => patch({ rccm: event.target.value })}
                />
              )}
            </Field>
          </div>

          <Field label="Logo">
            {() => (
              <LogoUploader
                value={form.logoDataUrl}
                onChange={(logoDataUrl) => patch({ logoDataUrl })}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
        </CardHeader>
        <div className="space-y-4 p-5">
          <Field label="Adresse">
            {(props) => (
              <Input
                {...props}
                value={form.address}
                onChange={(event) => patch({ address: event.target.value })}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ville">
              {(props) => (
                <Input
                  {...props}
                  value={form.city}
                  onChange={(event) => patch({ city: event.target.value })}
                />
              )}
            </Field>
            <Field label="Pays">
              {(props) => (
                <Input
                  {...props}
                  value={form.country}
                  onChange={(event) => patch({ country: event.target.value })}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone">
              {(props) => (
                <Input
                  {...props}
                  numeric
                  type="tel"
                  value={form.phone}
                  onChange={(event) => patch({ phone: event.target.value })}
                />
              )}
            </Field>
            <Field label="Email" error={errors.email}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={form.email}
                  invalid={Boolean(errors.email)}
                  onChange={(event) => patch({ email: event.target.value })}
                />
              )}
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Facturation</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              S’applique aux nouvelles factures. Les factures déjà émises conservent leur taux.
            </p>
          </div>
        </CardHeader>
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Devise" hint="Les deux francs CFA sont sans centimes.">
              {(props) => (
                <Combobox
                  {...props}
                  value={form.currency}
                  onChange={(currency) => patch({ currency: currency as Currency })}
                  options={CURRENCIES}
                />
              )}
            </Field>
            <Field
              label="Taux de TVA (%)"
              error={errors.vatRate}
              hint="19,25 % au Cameroun : 17,5 % de TVA plus 10 % de centimes additionnels communaux."
            >
              {(props) => (
                <Input
                  {...props}
                  numeric
                  inputMode="decimal"
                  value={vatText}
                  invalid={Boolean(errors.vatRate)}
                  onChange={(event) => {
                    setVatText(event.target.value);
                    setSaved(false);
                  }}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Délai de règlement (jours)" error={errors.paymentTermsDays}>
              {(props) => (
                <Input
                  {...props}
                  numeric
                  inputMode="numeric"
                  value={termsText}
                  invalid={Boolean(errors.paymentTermsDays)}
                  onChange={(event) => {
                    setTermsText(event.target.value);
                    setSaved(false);
                  }}
                />
              )}
            </Field>
            <Field
              label="Préfixe de numérotation"
              error={errors.invoicePrefix}
              hint={
                issuedCount > 0
                  ? `Ne s’applique qu’aux prochaines factures : les ${issuedCount} déjà numérotées gardent leur numéro.`
                  : 'Exemple : FAC donne FAC-2026-0001.'
              }
            >
              {(props) => (
                <Input
                  {...props}
                  numeric
                  value={form.invoicePrefix}
                  invalid={Boolean(errors.invoicePrefix)}
                  onChange={(event) => patch({ invoicePrefix: event.target.value.toUpperCase() })}
                />
              )}
            </Field>
          </div>

          <Field
            label="Mention par défaut"
            hint="Pré-remplit le pied de chaque nouvelle facture."
          >
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={form.defaultNotes ?? ''}
                onChange={(event) => patch({ defaultNotes: event.target.value })}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Encaissement</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Les coordonnées que vos clients utiliseront pour vous régler.
            </p>
          </div>
        </CardHeader>
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banque">
              {(props) => (
                <Input
                  {...props}
                  value={form.bankName ?? ''}
                  onChange={(event) => patch({ bankName: event.target.value })}
                />
              )}
            </Field>
            <Field label="Numéro de compte">
              {(props) => (
                <Input
                  {...props}
                  numeric
                  value={form.bankAccount ?? ''}
                  onChange={(event) => patch({ bankAccount: event.target.value })}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="MTN Mobile Money">
              {(props) => (
                <Input
                  {...props}
                  numeric
                  type="tel"
                  value={form.momoMtn ?? ''}
                  placeholder="+237 6 …"
                  onChange={(event) => patch({ momoMtn: event.target.value })}
                />
              )}
            </Field>
            <Field label="Orange Money">
              {(props) => (
                <Input
                  {...props}
                  numeric
                  type="tel"
                  value={form.momoOrange ?? ''}
                  placeholder="+237 6 …"
                  onChange={(event) => patch({ momoOrange: event.target.value })}
                />
              )}
            </Field>
          </div>
        </div>
      </Card>
    </div>
  );
}
