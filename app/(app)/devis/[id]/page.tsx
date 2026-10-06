import { Suspense } from 'react';
import type { Metadata } from 'next';
import { QuoteDetail } from '@/components/quotes/quote-detail';
import { NotFoundCard } from '@/components/documents/not-found-card';
import { getClients, getQuoteView, requireSession } from '@/lib/db/queries';
import { letterheadIfUsed } from '@/lib/db/letterhead';

export const metadata: Metadata = { title: 'Détail du devis' };

export default async function DevisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ⚠️ Next 15 : `params` et `searchParams` sont des PROMESSES.
  const { id } = await params;
  const session = await requireSession();
  const quote = await getQuoteView(session.companyId, id);

  if (!quote) {
    return (
      <NotFoundCard
        title="Devis introuvable"
        description="Ce devis a peut-être été supprimé, ou le lien est incorrect."
        href="/devis"
        actionLabel="Retour aux devis"
      />
    );
  }

  const clients = await getClients(session.companyId);

  // L'image du papier a en-tete, lue UNIQUEMENT si l'entreprise est en mode
  // << en-tete televerse >>. L'apercu doit montrer le document tel qu'il sera
  // imprime : sans elle, il afficherait une page blanche la ou le PDF dessine
  // l'en-tete, et la personne croirait que la fonction ne marche pas.
  const letterhead = await letterheadIfUsed(session.companyId, session.company.letterheadMode);
  const client = clients.find((candidate) => candidate.id === quote.clientId);

  return (
    <Suspense fallback={null}>
      <QuoteDetail quote={quote} client={client} letterheadDataUrl={letterhead} />
    </Suspense>
  );
}
