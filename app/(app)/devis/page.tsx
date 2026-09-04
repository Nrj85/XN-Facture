import { Suspense } from 'react';
import type { Metadata } from 'next';
import { QuoteList } from '@/components/quotes/quote-list';
import { getQuoteViews, requireSession } from '@/lib/db/queries';

export const metadata: Metadata = { title: 'Devis' };

export default async function DevisPage() {
  const session = await requireSession();
  const quoteViews = await getQuoteViews(session.companyId);

  return (
    <Suspense fallback={null}>
      <QuoteList quoteViews={quoteViews} />
    </Suspense>
  );
}
