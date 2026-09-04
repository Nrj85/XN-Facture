import type { Metadata } from 'next';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { NotFoundCard } from '@/components/documents/not-found-card';
import { getClients, getInvoiceView, requireSession } from '@/lib/db/queries';
import { today } from '@/lib/today';

export const metadata: Metadata = { title: 'Modifier la facture' };

export default async function ModifierFacturePage({ params }: { params: { id: string } }) {
  const session = await requireSession();

  const [invoice, clients] = await Promise.all([
    getInvoiceView(session.companyId, params.id),
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

  return <InvoiceForm clients={clients} today={today()} invoice={invoice} />;
}
