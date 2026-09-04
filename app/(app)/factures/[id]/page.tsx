import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InvoiceDetail } from '@/components/invoices/invoice-detail';
import { NotFoundCard } from '@/components/documents/not-found-card';
import { getClients, getInvoiceView, requireSession } from '@/lib/db/queries';

export const metadata: Metadata = { title: 'Détail de la facture' };

export default async function FactureDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const invoice = await getInvoiceView(session.companyId, params.id);

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
  const client = clients.find((candidate) => candidate.id === invoice.clientId);

  // La fenêtre de confirmation de création lit un paramètre d'URL :
  // `useSearchParams` impose une frontière Suspense.
  return (
    <Suspense fallback={null}>
      <InvoiceDetail invoice={invoice} client={client} />
    </Suspense>
  );
}
