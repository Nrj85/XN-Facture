'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu, Plus } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { SEGMENT_KEYS } from '@/lib/nav';
import { useT } from '@/lib/i18n/context';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * Fil d'Ariane construit à partir de l'URL.
 *
 * Les segments dynamiques (l'identifiant dans `/factures/i12`) sont écartés :
 * afficher un identifiant technique à l'utilisateur n'a aucun sens, et le titre
 * de la page porte déjà le numéro de la facture.
 */
function useCrumbs(pathname: string, t: Dictionary) {
  const segments = pathname.split('/').filter(Boolean);
  return segments
    .map((segment, index) => {
      const key = SEGMENT_KEYS[segment];
      return {
        label: key ? t.nav[key] : undefined,
        href: `/${segments.slice(0, index + 1).join('/')}`,
      };
    })
    .filter((crumb): crumb is { label: string; href: string } => Boolean(crumb.label))
    .map((crumb, index, all) => ({ ...crumb, last: index === all.length - 1 }));
}

/**
 * L'action principale suit la section consultée.
 *
 * Sur les devis, proposer « Nouvelle facture » enverrait vers le mauvais
 * document ; et dupliquer un bouton dans l'en-tête de page mettrait deux
 * boutons orange à quarante pixels l'un de l'autre, ce qui se lit comme un
 * défaut de mise en page plutôt que comme un choix.
 */
function primaryAction(pathname: string, t: Dictionary) {
  if (pathname.startsWith('/devis')) {
    return { href: '/devis/nouveau', long: t.nav.newQuote, short: t.nav.quoteShort };
  }
  return { href: '/factures/nouvelle', long: t.nav.newInvoice, short: t.nav.invoiceShort };
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const t = useT();
  const crumbs = useCrumbs(pathname, t);
  const action = primaryAction(pathname, t);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-ink-2 transition-[background-color,color,transform] duration-150 ease-out hover:bg-sand hover:text-ink active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
          <span className="sr-only">{t.nav.openMenu}</span>
        </button>

        <div className="lg:hidden">
          <Logo href="/dashboard" label={t.nav.logoToDashboard} />
        </div>

        <nav aria-label={t.nav.breadcrumb} className="hidden min-w-0 flex-1 lg:block">
          <ol className="flex items-center gap-1.5 text-[13px]">
            {crumbs.map((crumb) => (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {crumb.last ? (
                  <span className="font-semibold text-ink">{crumb.label}</span>
                ) : (
                  <>
                    <Link href={crumb.href} className="text-ink-3 hover:text-ink">
                      {crumb.label}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                  </>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href={action.href} className={buttonClasses({ size: 'sm' })}>
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{action.long}</span>
            <span className="sm:hidden">{action.short}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
