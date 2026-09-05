'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Search } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { IconButton } from '@/components/ui/icon-button';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '@/lib/nav';
import { useCompany } from '@/lib/company-context';
import { signOut } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors duration-150',
        active
          ? 'bg-surface font-semibold text-ink shadow-card'
          : 'font-medium text-ink-2 hover:bg-sand-deep hover:text-ink',
      )}
    >
      <Icon
        className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-brand-bright' : 'text-ink-3')}
        strokeWidth={active ? 2.2 : 1.9}
        aria-hidden
      />
      {item.label}
    </Link>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { company, user } = useCompany();

  return (
    <div className="flex h-full flex-col bg-sand">
      <div className="px-4 pb-3 pt-5">
        {/* Depuis l'intérieur de l'application, le logo ramène au tableau de
            bord — pas au site vitrine, qui n'a plus rien à dire à quelqu'un
            de déjà connecté. */}
        <Logo href="/dashboard" label="XN-Facture — tableau de bord" />
      </div>

      <div className="px-4 pb-4">
        {/* La recherche mène à la liste des factures avec le terme appliqué.
            Un champ qui n'aboutit nulle part serait un contrôle mort. */}
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get('q');
            const query = typeof value === 'string' ? value.trim() : '';
            router.push(query ? `/factures?q=${encodeURIComponent(query)}` : '/factures');
            onNavigate?.();
          }}
        >
          <label className="relative block">
            <span className="sr-only">Rechercher une facture ou un client</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <input
              name="q"
              type="search"
              placeholder="Rechercher"
              className="h-9 w-full rounded-[10px] border border-line bg-surface pl-9 pr-3 text-[13px] text-ink transition-colors duration-150 placeholder:text-ink-3 hover:border-line-strong"
            />
          </label>
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Navigation principale">
        <p className="label-caps px-3 pb-2 pt-1">Menu</p>
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-0.5 px-3 py-3">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-3">
          {/* `brand` sur `brand-soft` ne donne que 4,11:1 : le texte passe en
              `brand-hover`, conformément au tableau des couleurs. */}
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand-hover"
            aria-hidden
          >
            {user.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">
              {user.displayName}
            </span>
            <span className="block truncate text-[11.5px] text-ink-3">{company.name}</span>
          </span>
          {/* La déconnexion est une Server Action : un `<form>` la rend
              utilisable même sans JavaScript. */}
          <form action={signOut}>
            <IconButton
              type="submit"
              icon={LogOut}
              label="Se déconnecter"
              className="shrink-0"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
