import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { IconButton } from '@/components/ui/icon-button';
import { signOut } from '@/lib/actions/auth';
import { requireAdmin } from '@/lib/db/admin-queries';

/**
 * Coquille de l'espace administrateur.
 *
 * **Elle est séparée de la coquille applicative, et il le fallait.**
 * `app/(app)/layout.tsx` appelle `requireSession()`, qui renvoie vers
 * `/bienvenue` tout compte sans entreprise — or **un administrateur de
 * plateforme n'appartient pas nécessairement à une entreprise**. Placé dans ce
 * groupe, l'espace d'administration était inaccessible à l'administrateur
 * lui-même : constaté en conditions réelles, la connexion aboutissait sur
 * `/bienvenue`.
 *
 * Cette coquille n'exige donc qu'une chose : être administrateur. Elle
 * n'affiche ni barre latérale ni navigation d'entreprise, ce qui dit aussi
 * qu'on a changé de contexte — on n'est plus dans « son » application.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo href="/admin" label="XN-Facture — espace administrateur" />

          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-hover">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Plateforme
          </span>

          <div className="ml-auto flex items-center gap-3">
            {/* Un administrateur peut aussi avoir une entreprise. S'il n'en a
                pas, ce lien le mènera à /bienvenue — ce qui est exactement la
                bonne réponse : il lui manque une entreprise. */}
            <Link
              href="/dashboard"
              className="hidden rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:bg-sand hover:text-ink sm:inline-flex"
            >
              Mon entreprise
            </Link>

            <span className="hidden text-[12.5px] text-ink-3 md:inline">{admin.email}</span>

            <form action={signOut}>
              <IconButton icon={LogOut} label="Se déconnecter" type="submit" />
            </form>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
