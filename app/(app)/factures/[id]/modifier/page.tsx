import type { Metadata } from 'next';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { NotFoundCard } from '@/components/documents/not-found-card';
import { getClients, getInvoiceView, requireSession } from '@/lib/db/queries';
import { today } from '@/lib/today';
import { letterheadIfUsed } from '@/lib/db/letterhead';

export const metadata: Metadata = { title: 'Modifier la facture' };

export default async function ModifierFacturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ⚠️ Next 15 : `params` et `searchParams` sont des PROMESSES.
  const { id } = await params;
  const session = await requireSession();

  // L'image du papier a en-tete, lue UNIQUEMENT si l'entreprise est en mode
  // << en-tete televerse >>. L'apercu doit montrer le document tel qu'il sera
  // imprime : sans elle, il afficherait une page blanche la ou le PDF dessine
  // l'en-tete, et la personne croirait que la fonction ne marche pas.
  const letterhead = await letterheadIfUsed(session.companyId, session.company.letterheadMode);

  const [invoice, clients] = await Promise.all([
    getInvoiceView(session.companyId, id),
    getClients(session.companyId),
  ]);

  if (!invoice) {
    return (
      <NotFoundCard
        title="Facture introuvable"
        description="Impossible de modifier une facture qui n'existe plus."
        href="/factures"
        actionLabel="Retour aux factures"
      />
    );
  }

  return <InvoiceForm clients={clients} today={today()} invoice={invoice} letterheadDataUrl={letterhead} />;
}
