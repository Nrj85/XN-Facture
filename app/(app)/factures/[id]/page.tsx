import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InvoiceDetail } from '@/components/invoices/invoice-detail';
import { NotFoundCard } from '@/components/documents/not-found-card';
import { getClients, getInvoiceView, requireSession } from '@/lib/db/queries';
import { letterheadIfUsed } from '@/lib/db/letterhead';

export const metadata: Metadata = { title: 'Détail de la facture' };

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ⚠️ Next 15 : `params` et `searchParams` sont des PROMESSES.
  const { id } = await params;
  const session = await requireSession();
  const invoice = await getInvoiceView(session.companyId, id);

  if (!invoice) {
    return (
      <NotFoundCard
        title="Facture introuvable"
        description="Cette facture a peut-être été supprimée, ou le lien est incorrect."
        href="/factures"
        actionLabel="Retour aux factures"
      />
    );
  }

  const clients = await getClients(session.companyId);

  // L'image du papier a en-tete, lue UNIQUEMENT si l'entreprise est en mode
  // << en-tete televerse >>. L'apercu doit montrer le document tel qu'il sera
  // imprime : sans elle, il afficherait une page blanche la ou le PDF dessine
  // l'en-tete, et la personne croirait que la fonction ne marche pas.
  const letterhead = await letterheadIfUsed(session.companyId, session.company.letterheadMode);
  const client = clients.find((candidate) => candidate.id === invoice.clientId);

  // La fenêtre de confirmation de création lit un paramètre d'URL :
  // `useSearchParams` impose une frontière Suspense.
  return (
    <Suspense fallback={null}>
      <InvoiceDetail invoice={invoice} client={client} letterheadDataUrl={letterhead} />
    </Suspense>
  );
}
