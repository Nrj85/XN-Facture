import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  FileCheck,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/factures', label: 'Factures', icon: FileText },
  { href: '/devis', label: 'Devis', icon: FileCheck },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/paiements', label: 'Paiements', icon: Wallet },
  { href: '/rapports', label: 'Rapports', icon: BarChart3 },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/aide', label: 'Aide et support', icon: LifeBuoy },
  { href: '/parametres', label: 'Paramètres', icon: Settings },
];

/** Libellés de fil d'Ariane par segment de route. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  factures: 'Factures',
  devis: 'Devis',
  clients: 'Clients',
  paiements: 'Paiements',
  rapports: 'Rapports',
  parametres: 'Paramètres',
  aide: 'Aide et support',
  nouvelle: 'Nouvelle facture',
  nouveau: 'Nouveau devis',
  modifier: 'Modifier',
};
