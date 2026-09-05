import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import './marketing.css';

/**
 * Coquille des pages publiques.
 *
 * La classe `marketing` porte tous les jetons CSS : chaque module descend
 * d'elle, donc aucun n'a besoin de redéfinir une couleur. C'est aussi ce qui
 * confine la landing — l'application, elle, continue de vivre sur les classes
 * Tailwind, sans que les deux se marchent dessus.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
