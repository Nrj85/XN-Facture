import type { Metadata } from 'next';
import { AdminView } from '@/components/admin/admin-view';
import {
  getAdminAccounts,
  getAdminActivity,
  getAdminOverview,
  getMarketingOptOutCount,
  requireAdmin,
} from '@/lib/db/admin-queries';

export const metadata: Metadata = { title: 'Espace administrateur' };

/**
 * Espace administrateur de plateforme.
 *
 * `requireAdmin()` écarte les non-administrateurs avant toute lecture. Ce
 * contrôle est **doublé** par la base : même si cette garde sautait, les
 * politiques `*_admin_select` de la migration 0004 ne rendraient que les
 * lignes de l'entreprise de l'appelant. Le pire cas est un écran vide, jamais
 * une fuite — c'est la même discipline que partout ailleurs dans le projet :
 * le refus vient de la base, pas de l'interface.
 */
export default async function AdminPage() {
  const admin = await requireAdmin();

  // Les quatre lectures sont indépendantes : les lancer en parallèle évite
  // d'additionner quatre allers-retours vers Dublin.
  const [overview, accounts, activity, desabonnes] = await Promise.all([
    getAdminOverview(),
    getAdminAccounts(),
    getAdminActivity(60),
    getMarketingOptOutCount(),
  ]);

  return (
    <AdminView
      summary={overview.summary}
      companies={overview.companies}
      accounts={accounts}
      activity={activity}
      optedOut={desabonnes}
      adminEmail={admin.email}
    />
  );
}
