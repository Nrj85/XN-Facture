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

          {/* ⚠️ **Le badge s'efface sous `sm`, et il ne manque à personne.**
              Le titre de la page, juste dessous, annonce déjà « PLATEFORME /
              ESPACE ADMINISTRATEUR » : sur un téléphone, cette pastille ne
              faisait que répéter l'information en occupant la place dont le
              retour vers l'entreprise a besoin. */}
          <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-hover sm:inline-flex">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Plateforme
          </span>

          <div className="ml-auto flex items-center gap-3">
            {/* Un administrateur peut aussi avoir une entreprise. S'il n'en a
                pas, ce lien le mènera à /bienvenue — ce qui est exactement la
                bonne réponse : il lui manque une entreprise.

                ⚠️ **IL ÉTAIT `hidden sm:inline-flex`, donc ABSENT SUR
                TÉLÉPHONE** — remonté par l'utilisateur le 25 sept. 2026 : « je
                n'ai pas le moyen de revenir à mon compte entreprise, je peux
                juste me déconnecter ». L'aller (application → `/admin`) passe
                par le tiroir de navigation et fonctionnait déjà ; c'est le
                RETOUR qui n'existait pas, et la seule sortie était la
                déconnexion. Il est désormais visible à toutes les largeurs.

                ⚠️ **`whitespace-nowrap` est nécessaire** : sans lui le libellé
                se coupe en deux lignes sur les écrans les plus étroits et
                déforme la barre.

                ⚠️ **`min-h-9` : il mesurait 32 px, sous le plancher de 36 px
                du §6.5.** Le défaut passait inaperçu tant qu'il n'existait
                qu'à la souris ; devenu le contrôle principal du téléphone, il
                devait tenir la règle que le projet s'impose. */}
            <Link
              href="/dashboard"
              className="inline-flex min-h-9 items-center whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:bg-sand hover:text-ink"
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
