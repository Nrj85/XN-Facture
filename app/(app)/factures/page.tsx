import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InvoiceList } from '@/components/invoices/invoice-list';
import { getInvoiceViews, getSubscription, requireSession } from '@/lib/db/queries';
import { effectivePlan, planAllowsAccountingExport } from '@/lib/plans';
import { today } from '@/lib/today';

export const metadata: Metadata = { title: 'Factures' };

export default async function FacturesPage() {
  const session = await requireSession();
  const [views, abonnement] = await Promise.all([
    getInvoiceViews(session.companyId),
    getSubscription(session.companyId),
  ]);

  // ⚠️ **LA FORMULE EFFECTIVE, jamais le `plan` brut.** Un abonnement
  // Entreprise payé mais expiré vaut Découverte : lui laisser le bouton
  // d'export reviendrait à ne jamais faire expirer la seule fonction qui
  // sépare Entreprise de Pro. La route refait de toute façon ce contrôle —
  // ceci ne décide que de l'affichage.
  const formule = effectivePlan(abonnement.plan, abonnement.expiresAt, today());

  // La liste lit `?q=` pour reprendre la recherche de la barre latérale :
  // `useSearchParams` impose une frontière Suspense.
  return (
    <Suspense fallback={null}>
      <InvoiceList views={views} accountingAllowed={planAllowsAccountingExport(formule)} />
    </Suspense>
  );
}
