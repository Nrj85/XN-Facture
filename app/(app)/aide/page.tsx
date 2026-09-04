import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/layout/page-placeholder';

export const metadata: Metadata = { title: 'Aide et support' };

export default function AidePage() {
  return (
    <PagePlaceholder
      title="Aide et support"
      description="Guides d'utilisation et contact direct avec l'équipe."
    />
  );
}
