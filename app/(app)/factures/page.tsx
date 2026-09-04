import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InvoiceList } from '@/components/invoices/invoice-list';
import { getInvoiceViews, requireSession } from '@/lib/db/queries';

export const metadata: Metadata = { title: 'Factures' };

export default async function FacturesPage() {
  const session = await requireSession();
  const views = await getInvoiceViews(session.companyId);

  // La liste lit `?q=` pour reprendre la recherche de la barre latérale :
  // `useSearchParams` impose une frontière Suspense.
  return (
    <Suspense fallback={null}>
      <InvoiceList views={views} />
    </Suspense>
  );
}
