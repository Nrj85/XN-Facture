import type { Metadata } from 'next';
import { QuoteForm } from '@/components/quotes/quote-form';
import { NotFoundCard } from '@/components/documents/not-found-card';
import { getClients, getQuoteView, requireSession } from '@/lib/db/queries';
import { today } from '@/lib/today';
import { letterheadIfUsed } from '@/lib/db/letterhead';

export const metadata: Metadata = { title: 'Modifier le devis' };

export default async function ModifierDevisPage({
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

  const [quote, clients] = await Promise.all([
    getQuoteView(session.companyId, id),
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

  return <QuoteForm clients={clients} today={today()} quote={quote} letterheadDataUrl={letterhead} />;
}
