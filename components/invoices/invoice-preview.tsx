'use client';

import type { InvoiceTotals } from '@/lib/invoice-calc';
import { formatDate } from '@/lib/format';
import { formatAmount, formatQuantity } from '@/lib/money';
import { useCompany } from '@/lib/company-context';
import type { Client } from '@/lib/types';

export interface PreviewLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Aperçu de la facture — le document tel que le client le recevra.
 *
 * Composant purement présentationnel : il ne calcule rien, il reçoit les totaux
 * déjà produits par `computeTotals`. C'est ce qui garantit que l'aperçu et la
 * facture enregistrée ne peuvent pas afficher deux montants différents.
 */
export function InvoicePreview({
  variant = 'invoice',
  number,
  client,
  address,
  issueDate,
  dueDate,
  lines,
  totals,
  notes,
}: {
  /**
   * Un devis et une facture sont le même document à trois libellés près. Un
   * second composant d'aperçu aurait divergé du premier au bout de deux
   * modifications, et l'aperçu n'aurait plus montré le document réel.
   */
  variant?: 'invoice' | 'quote';
  number: string | null;
  client: Client | undefined;
  address: string;
  issueDate: string;
  /** Échéance de règlement pour une facture, fin de validité pour un devis. */
  dueDate: string;
  lines: PreviewLine[];
  totals: InvoiceTotals;
  notes?: string;
}) {
  const { company, formatMoney } = useCompany();
  const isQuote = variant === 'quote';
  return (
    <article className="relative isolate overflow-hidden rounded-[10px] border border-line bg-surface p-5 shadow-card sm:p-6">
      {/* Filigrane — même opacité et même cadrage que le PDF (`invoice-document.tsx`).
          L'aperçu prétend montrer « le document tel que le client le recevra » :
          s'il omettait le filigrane, il mentirait. `pointer-events-none` pour
          qu'il n'intercepte aucun clic, `aria-hidden` parce qu'il n'apporte
          rien à qui écoute la page. */}
      {/* **Deux règles d'empilement se combinent ici, et l'une sans l'autre ne
          marche pas.**

          1. `-z-10` : un élément POSITIONNÉ peint au-dessus du contenu statique
             qui le suit, même à `z-index: 0`. Il faut un indice négatif pour
             passer dessous.
          2. `isolate` sur la carte : sans contexte d'empilement, un enfant à
             indice négatif passe derrière le fond du PARENT — donc sous le
             `bg-surface` blanc, invisible. `isolation: isolate` fait de la
             carte un contexte, et l'ordre de peinture devient alors : fond de
             la carte, puis les indices négatifs, puis le contenu.

          Constaté pour de vrai : sans `isolate`, la capture de la carte avec et
          sans filigrane rendait deux images d'empreinte identique. */}
      {company.logoDataUrl && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-[0.07]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={company.logoDataUrl} alt="" className="h-[62%] w-[62%] object-contain" />
        </span>
      )}

      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="type-display text-[22px] leading-none text-ink">
            {isQuote ? 'Devis' : 'Facture'}
          </h3>
          <p className="mt-2 text-[11.5px] text-ink-3">
            Numéro{' '}
            <span className="tabular font-semibold text-ink-2">
              {number ?? 'attribué à l’envoi'}
            </span>
          </p>
        </div>
        {company.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoDataUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-[9px] object-contain"
          />
        ) : (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-brand text-[12px] font-extrabold text-white"
            aria-hidden
          >
            {company.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </header>

      <div className="mt-5 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-2">
        <div className="bg-surface p-3.5">
          <p className="label-caps">Émetteur</p>
          <p className="mt-1.5 text-[12.5px] font-semibold text-ink">{company.legalName}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-2">
            {company.address}
            <br />
            {company.city}, {company.country}
            <br />
            NIU {company.niu}
          </p>
        </div>
        <div className="bg-surface p-3.5">
          <p className="label-caps">{isQuote ? 'Destinataire' : 'Facturé à'}</p>
          <p className="mt-1.5 text-[12.5px] font-semibold text-ink">
            {client?.name ?? 'Aucun client sélectionné'}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-2">
            {client?.email}
            {address && (
              <>
                <br />
                {address}
              </>
            )}
          </p>
        </div>
        <div className="bg-surface p-3.5">
          <p className="label-caps">Date d’émission</p>
          <p className="tabular mt-1.5 text-[12.5px] font-semibold text-ink">
            {formatDate(issueDate)}
          </p>
        </div>
        <div className="bg-surface p-3.5">
          <p className="label-caps">{isQuote ? 'Valable jusqu’au' : 'Échéance'}</p>
          <p className="tabular mt-1.5 text-[12.5px] font-semibold text-ink">
            {formatDate(dueDate)}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <caption className="sr-only">Détail des prestations facturées</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="label-caps py-2 text-left">Désignation</th>
              <th scope="col" className="label-caps py-2 text-right">Qté</th>
              <th scope="col" className="label-caps py-2 text-right">P.U.</th>
              <th scope="col" className="label-caps py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-[12px] text-ink-3">
                  Aucune ligne pour le moment.
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 text-ink">
                    {line.description || <span className="text-ink-3">Sans désignation</span>}
                  </td>
                  <td className="tabular py-2.5 text-right text-ink-2">
                    {formatQuantity(line.quantity)}
                  </td>
                  <td className="tabular py-2.5 text-right text-ink-2">
                    {formatAmount(line.unitPrice)}
                  </td>
                  <td className="tabular py-2.5 text-right font-semibold text-ink">
                    {formatAmount(line.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-[240px] space-y-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[12px] text-ink-2">Sous-total HT</dt>
            <dd className="tabular text-[12.5px] font-medium text-ink">
              {formatMoney(totals.subtotal)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[12px] text-ink-2">
              TVA {totals.vatRate.toString().replace('.', ',')} %
            </dt>
            <dd className="tabular text-[12.5px] font-medium text-ink">
              {formatMoney(totals.vatAmount)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
            <dt className="text-[12.5px] font-semibold text-ink">Total TTC</dt>
            <dd className="tabular text-[15px] font-bold tracking-[-0.02em] text-ink">
              {formatMoney(totals.total)}
            </dd>
          </div>
        </dl>
      </div>

      {notes && (
        <p className="mt-5 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-2">
          {notes}
        </p>
      )}

      {/* Coordonnées de règlement : sans ce bloc, les champs correspondants des
          paramètres seraient saisis sans jamais rien produire. Absentes d'un
          devis : rien n'est encore dû, inviter à payer serait une erreur. */}
      {!isQuote &&
        (company.bankName || company.bankAccount || company.momoMtn || company.momoOrange) && (
        <div className="mt-5 rounded-[10px] border border-line bg-paper p-3.5">
          <p className="label-caps">Règlement</p>
          <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-[11.5px] sm:grid-cols-2">
            {company.bankName && (
              <div className="flex gap-1.5">
                <dt className="text-ink-3">Banque</dt>
                <dd className="font-medium text-ink-2">{company.bankName}</dd>
              </div>
            )}
            {company.bankAccount && (
              <div className="flex gap-1.5">
                <dt className="text-ink-3">Compte</dt>
                <dd className="tabular font-medium text-ink-2">{company.bankAccount}</dd>
              </div>
            )}
            {company.momoMtn && (
              <div className="flex gap-1.5">
                <dt className="text-ink-3">MTN MoMo</dt>
                <dd className="tabular font-medium text-ink-2">{company.momoMtn}</dd>
              </div>
            )}
            {company.momoOrange && (
              <div className="flex gap-1.5">
                <dt className="text-ink-3">Orange Money</dt>
                <dd className="tabular font-medium text-ink-2">{company.momoOrange}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <p className="mt-4 text-[11px] text-ink-3">
        {isQuote
          ? `Offre valable jusqu’au ${formatDate(dueDate)}`
          : `Règlement à ${company.paymentTermsDays} jours`}{' '}
        · {company.legalName} · RCCM {company.rccm}
      </p>
    </article>
  );
}
