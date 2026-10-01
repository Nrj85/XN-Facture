import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TestimonialsEditor } from '@/components/admin/testimonials-editor';
import { requireAdmin } from '@/lib/db/admin-queries';
import { getAllTestimonials } from '@/lib/db/testimonials';

export const metadata: Metadata = { title: 'Témoignages' };

/**
 * Édition des témoignages de la page d'accueil.
 *
 * ⚠️ **C'EST LE SEUL ÉCRAN D'ÉCRITURE DE L'ESPACE D'ADMINISTRATION**, et cela
 * rouvre une décision verrouillée (§8 : l'espace est en lecture seule). La
 * portée est volontairement étroite : la migration 0016 n'accorde l'écriture
 * que sur `site_testimonials`, une table de **contenu éditorial**. Aucune
 * autre table n'a reçu de politique d'écriture, et `platform_admins`,
 * `subscriptions`, `subscription_orders` et `activity_log` restent
 * inaccessibles en écriture depuis l'interface.
 *
 * ⚠️ **`requireAdmin()` est appelé par la coquille `(admin)/layout.tsx`.** On
 * le rappelle ici parce qu'une page ne doit pas dépendre d'un contrôle qui vit
 * ailleurs : si cette page était un jour déplacée hors du groupe, elle
 * resterait gardée. La RLS reste la barrière réelle.
 */
export default async function AdminTemoignagesPage() {
  await requireAdmin();
  const temoignages = await getAllTestimonials();

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <Link
          href="/admin"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] -ml-2 px-2 text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:bg-sand hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Espace administrateur
        </Link>
        <p className="label-caps mt-2">Page d’accueil</p>
        <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
          Témoignages
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Ce que vos visiteurs lisent sur la page d’accueil. Les modifications apparaissent en
          ligne dès l’enregistrement.
        </p>
      </header>

      <TestimonialsEditor initial={temoignages} />
    </div>
  );
}
