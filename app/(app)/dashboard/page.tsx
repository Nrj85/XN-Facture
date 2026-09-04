import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { getInvoiceViews, requireSession } from '@/lib/db/queries';
import { today } from '@/lib/today';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default async function DashboardPage() {
  const session = await requireSession();
  const views = await getInvoiceViews(session.companyId);

  return <DashboardView views={views} today={today()} />;
}
