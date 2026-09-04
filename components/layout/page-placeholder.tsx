import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Écran d'attente pour les routes qui seront construites aux étapes suivantes.
 * Il indique où on en est plutôt que d'afficher une page vide — et il permet de
 * parcourir toute la navigation pendant la revue du design.
 */
export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="animate-fade-in">
      <h1 className="type-display text-[26px] leading-none sm:text-[32px]">{title}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-2">{description}</p>

      <Card className="mt-6 p-8 text-center">
        <p className="text-[15px] font-semibold text-ink">Cette page arrive à l&apos;étape suivante</p>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] text-ink-2">
          Le tableau de bord fixe la direction visuelle. Une fois validée, elle sera appliquée
          à cet écran comme aux autres.
        </p>
        <Link
          href="/dashboard"
          className="group mt-5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft hover:text-brand-hover"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5 motion-reduce:transform-none"
            aria-hidden
          />
          Retour au tableau de bord
        </Link>
      </Card>
    </div>
  );
}
