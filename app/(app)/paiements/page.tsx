import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/layout/page-placeholder';

export const metadata: Metadata = { title: 'Paiements' };

export default function PaiementsPage() {
  return (
    <PagePlaceholder
      title="Paiements"
      description="Encaissements par espèces, virement, MTN MoMo, Orange Money ou chèque."
    />
  );
}
