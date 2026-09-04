import type { Metadata } from 'next';
import { QuoteForm } from '@/components/quotes/quote-form';
import { getClients, requireSession } from '@/lib/db/queries';
import { today } from '@/lib/today';

export const metadata: Metadata = { title: 'Créer un devis' };

export default async function NouveauDevisPage() {
  const session = await requireSession();
  const clients = await getClients(session.companyId);

  return <QuoteForm clients={clients} today={today()} />;
}
