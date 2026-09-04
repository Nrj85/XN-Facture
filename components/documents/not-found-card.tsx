import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Document introuvable.
 *
 * Composant serveur : la recherche se fait désormais en base, dans la page, et
 * non plus dans un store côté navigateur. Le retour est un vrai `<Link>` —
 * clic milieu, ouverture dans un onglet, menu contextuel restent possibles.
 */
export function NotFoundCard({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="animate-fade-in">
      <Card>
        <EmptyState
          icon={FileQuestion}
          title={title}
          description={description}
          action={
            <Link href={href} className={buttonClasses({ size: 'sm' })}>
              {actionLabel}
            </Link>
          }
        />
      </Card>
    </div>
  );
}
