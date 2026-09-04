import type { Metadata } from 'next';
import { QuoteForm } from '@/components/quotes/quote-form';
import { NotFoundCard } from '@/components/documents/not-found-card';
import { getClients, getQuoteView, requireSession } from '@/lib/db/queries';
import { today } from '@/lib/today';

export const metadata: Metadata = { title: 'Modifier le devis' };

export default async function ModifierDevisPage({ params }: { params: { id: string } }) {
  const session = await requireSession();

  const [quote, clients] = await Promise.all([
    getQuoteView(session.companyId, params.id),
    getClients(session.companyId),
  ]);

  if (!quote) {
    return (
      <NotFoundCard
        title="Devis introuvable"
        description="Impossible de modifier un devis qui n'existe plus."
        href="/devis"
        actionLabel="Retour aux devis"
      />
    );
  }

  return <QuoteForm clients={clients} today={today()} quote={quote} />;
}
