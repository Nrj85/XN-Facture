import { AppShell } from '@/components/layout/app-shell';
import { CompanyProvider } from '@/lib/company-context';
import { requireSession } from '@/lib/db/queries';

/**
 * Coquille applicative.
 *
 * `requireSession` redirige vers la connexion s'il n'y a pas de session, et
 * vers /bienvenue s'il n'y a pas d'entreprise. Le middleware fait déjà le
 * premier contrôle, mais s'y fier seul serait imprudent : lui seul ne garantit
 * rien sur ce que la page lit ensuite.
 *
 * L'entreprise est chargée UNE fois ici et distribuée par contexte. Les
 * données métier, elles, sont lues par chaque page — inutile de charger les
 * factures pour afficher la page des clients.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <CompanyProvider
      company={session.company}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AppShell>{children}</AppShell>
    </CompanyProvider>
  );
}
