import type { Metadata } from 'next';
import { ClientList } from '@/components/clients/client-list';
import { getClients, getInvoiceViews, requireSession } from '@/lib/db/queries';

export const metadata: Metadata = { title: 'Clients' };

export default async function ClientsPage() {
  const session = await requireSession();

  // Les deux lectures sont indépendantes : les enchaîner ferait deux
  // aller-retours là où un seul suffit.
  const [clients, views] = await Promise.all([
    getClients(session.companyId),
    getInvoiceViews(session.companyId),
  ]);

  return <ClientList clients={clients} views={views} />;
}
