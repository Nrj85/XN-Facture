import type { Metadata } from 'next';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { getClients, requireSession } from '@/lib/db/queries';
import { today } from '@/lib/today';

export const metadata: Metadata = { title: 'Créer une facture' };

export default async function NouvelleFacturePage() {
  const session = await requireSession();
  const clients = await getClients(session.companyId);

  return <InvoiceForm clients={clients} today={today()} />;
}
