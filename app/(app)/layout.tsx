import { AppShell } from '@/components/layout/app-shell';
import { PlanLimitProvider } from '@/components/subscription/plan-limit';
import { CompanyProvider } from '@/lib/company-context';
import { LocaleProvider } from '@/lib/i18n/context';
import { getLocale } from '@/lib/i18n';
import { requireSession } from '@/lib/db/queries';
import { isPlatformAdmin } from '@/lib/db/admin-queries';

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
  // La langue est résolue ICI, une seule fois, comme l'entreprise. Chaque
  // composant client la reprend par contexte plutôt que de relire le cookie.
  const locale = getLocale();
  // Résolu par la BASE, pas déduit du profil : `is_platform_admin()` interroge
  // la table qui fait autorité, et c'est la même fonction qui garde les
  // politiques RLS. Un seul verdict, pour l'affichage comme pour les données.
  const admin = await isPlatformAdmin();

  return (
    <LocaleProvider locale={locale}>
      <CompanyProvider
        company={session.company}
        user={{ displayName: session.displayName, email: session.email }}
      >
        {/*
          `lang` est posé ICI et non sur <html>. La racine est partagée avec la
          landing publique, qui est STATIQUE et française : y lire le cookie
          rendrait toute la page dynamique. `lang` sur un conteneur est du HTML
          parfaitement valide, et c'est ce qui évite qu'un lecteur d'écran
          prononce de l'anglais avec la phonétique française.
        */}
        <div lang={locale}>
          {/*
            La fenêtre de plafond de formule est montée ICI, en un seul
            exemplaire : quatre écrans peuvent la déclencher, et quatre copies
            auraient divergé au premier ajustement de texte.
          */}
          <PlanLimitProvider>
            <AppShell isAdmin={admin}>{children}</AppShell>
          </PlanLimitProvider>
        </div>
      </CompanyProvider>
    </LocaleProvider>
  );
}
