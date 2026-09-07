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
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * Navigation.
 *
 * Les entrées portent une **clé de dictionnaire**, pas un libellé. C'est ce
 * qui permet à la barre latérale de changer de langue sans que ce fichier ait
 * à connaître les deux traductions — et `keyof` fait échouer la compilation si
 * une clé disparaît du dictionnaire.
 */
export type NavKey = keyof Dictionary['nav'];

export interface NavItem {
  href: string;
  key: NavKey;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/factures', key: 'invoices', icon: FileText },
  { href: '/devis', key: 'quotes', icon: FileCheck },
  { href: '/clients', key: 'clients', icon: Users },
  { href: '/paiements', key: 'payments', icon: Wallet },
  { href: '/rapports', key: 'reports', icon: BarChart3 },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/aide', key: 'help', icon: LifeBuoy },
  { href: '/parametres', key: 'settings', icon: Settings },
];

/**
 * Fil d'Ariane : segment de route → clé de dictionnaire.
 *
 * **Les routes restent en français** (`/factures`, `/devis`) même quand
 * l'interface passe en anglais. Traduire les URL casserait tous les liens déjà
 * partagés, et le document lui-même reste un document français.
 */
export const SEGMENT_KEYS: Record<string, NavKey> = {
  dashboard: 'dashboard',
  factures: 'invoices',
  devis: 'quotes',
  clients: 'clients',
  paiements: 'payments',
  rapports: 'reports',
  parametres: 'settings',
  aide: 'help',
  nouvelle: 'newInvoice',
  nouveau: 'newQuote',
  modifier: 'edit',
};
