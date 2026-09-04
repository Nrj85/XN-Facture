import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '@/app/globals.css';

/**
 * Polices auto-hébergées plutôt que récupérées depuis Google au moment du build.
 * `next/font/google` doit joindre fonts.googleapis.com à chaque build à froid ;
 * l'échec de cette requête ne casse pas la compilation mais fait silencieusement
 * retomber la page sur les polices système. Les fichiers versionnés rendent le
 * build hermétique et le rendu identique partout.
 */

// Grotesque lourd pour les titres en capitales, repris du style des captures.
const display = localFont({
  src: './fonts/archivo-latin.woff2',
  variable: '--font-display',
  weight: '400 800',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

// Inter porte l'interface et surtout les chiffres : c'est la seule des deux à
// offrir des chiffres tabulaires, indispensables pour aligner des colonnes de
// montants.
const sans = localFont({
  src: './fonts/inter-latin.woff2',
  variable: '--font-sans',
  weight: '400 700',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: {
    default: 'XN-Facture',
    template: '%s · XN-Facture',
  },
  description:
    'Facturation simple pour les entrepreneurs africains : devis, factures, TVA et suivi des encaissements en FCFA.',
};

export const viewport: Viewport = {
  themeColor: '#FBF8F3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
