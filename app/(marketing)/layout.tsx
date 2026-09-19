import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { BackToTop } from '@/components/marketing/back-to-top';
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
      {/*
        Cible du retour en haut. `tabIndex={-1}` la rend focalisable par le
        code sans l'insérer dans l'ordre de tabulation : sans elle, le focus
        resterait après le clic sur un bouton devenu invisible, et l'on
        repartirait du bas de la page au clavier. Elle est de hauteur nulle et
        ne déplace rien.
      */}
      <div id="haut" tabIndex={-1} />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      {/*
        Posé dans la COQUILLE, donc présent sur la landing ET sur les trois
        pages légales — qui sont de longs textes où le besoin est le même.
      */}
      <BackToTop />
    </div>
  );
}
