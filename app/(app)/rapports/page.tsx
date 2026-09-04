import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/layout/page-placeholder';

export const metadata: Metadata = { title: 'Rapports' };

export default function RapportsPage() {
  return (
    <PagePlaceholder
      title="Rapports"
      description="Chiffre d'affaires, TVA collectée et recouvrement sur la période de votre choix."
    />
  );
}
