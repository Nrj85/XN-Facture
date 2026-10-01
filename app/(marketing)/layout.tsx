import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { BackToTop } from '@/components/marketing/back-to-top';
import { getPublishedTestimonials } from '@/lib/db/testimonials';
import './marketing.css';

/**
 * Coquille des pages publiques.
 *
 * La classe `marketing` porte tous les jetons CSS : chaque module descend
 * d'elle, donc aucun n'a besoin de redéfinir une couleur. C'est aussi ce qui
 * confine la landing — l'application, elle, continue de vivre sur les classes
 * Tailwind, sans que les deux se marchent dessus.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  /*
    ⚠️ **LE LIEN « Témoignages » DE L'EN-TÊTE DOIT SUIVRE L'EXISTENCE DE LA
    SECTION.** Depuis que les témoignages viennent de la base, la section
    disparaît quand aucun n'est publié — et le lien d'ancre de l'en-tête
    pointerait alors vers un `#temoignages` inexistant : un clic sans effet,
    c'est-à-dire le contrôle mort du §6.1, sur la page la plus vue du site.

    La lecture est faite ICI plutôt que dans l'en-tête parce que celui-ci est un
    composant CLIENT : lui faire interroger le DOM après montage ferait
    clignoter le lien, et lui faire porter la requête le rendrait dynamique.
    Cette coquille est statique, donc la requête a lieu au build et à la
    régénération, pas à chaque visite.
  */
  const temoignagesPublies = (await getPublishedTestimonials()).length > 0;

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
      <SiteHeader temoignages={temoignagesPublies} />
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
