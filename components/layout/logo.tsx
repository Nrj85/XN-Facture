import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Marque XN-Facture.
 *
 * **`href` rend le logo cliquable.** Sans lui, il reste un simple `<span>` :
 * un logo qui ne mène nulle part ne doit pas se comporter comme un lien — pas
 * de curseur main, pas de survol, pas d'entrée dans la navigation au clavier.
 *
 * La destination dépend de l'endroit, et c'est l'appelant qui la connaît :
 * `/` depuis les écrans d'authentification, où l'on veut pouvoir revenir au
 * site vitrine ; `/dashboard` depuis l'intérieur de l'application, où repasser
 * par la page d'accueil publique n'aurait aucun sens.
 */
export function Logo({
  className,
  href,
  label = 'XN-Facture — accueil',
}: {
  className?: string;
  /** Destination du clic. Omis, le logo reste décoratif. */
  href?: string;
  /** Libellé annoncé aux lecteurs d'écran quand le logo est un lien. */
  label?: string;
}) {
  const contenu = (
    <>
      <span
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand-bright',
          // `type-display` (Archivo) et non la police de texte : c'est la
          // graisse du logo, et la seule des deux qui lui ressemble.
          'type-display text-[13px] font-extrabold leading-none tracking-tight',
          // Le carré pivote légèrement au survol : c'est l'indice qui dit que
          // le logo est cliquable, sans ajouter ni soulignement ni bouton.
          href &&
            'transition-transform duration-200 ease-out group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:transform-none',
        )}
        aria-hidden
      >
        {/*
          ⚠️ **DEUX LETTRES, DEUX COULEURS — c'est le logo, pas une décoration.**
          La tuile portait « XN » en blanc sur `brand`. Le logo réel oppose un X
          sombre à un N clair sur l'orange vif : c'est ce contraste interne qui
          le rend reconnaissable à 32 px, et le reproduire tient en deux `span`.

          ⚠️ **Le fond est `brand-bright`, la couleur EXACTE du logo (#F23005),
          et non `brand`.** Le §6.2 interdit `brand-bright` sous du texte blanc
          parce qu'il échoue au seuil de 4,5:1 — mais **WCAG 1.4.3 exempte
          explicitement les logotypes** de ce seuil. La règle vaut pour du texte
          qui doit être lu ; ici l'ensemble est `aria-hidden`, le nom accessible
          vient de l'`aria-label` du lien, et la fidélité de la marque prime.
          **Ne pas généraliser : c'est l'exception du logo, pas une levée de la
          règle.**
        */}
        <span className="text-ink">
          X<span className="text-surface">N</span>
        </span>
      </span>
      <span
        className={cn(
          'type-display text-[15px] leading-none text-ink',
          href && 'transition-colors duration-150 group-hover:text-brand-hover',
        )}
      >
        Facture
      </span>
    </>
  );

  if (!href) {
    return <span className={cn('flex items-center gap-2.5', className)}>{contenu}</span>;
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn('group flex items-center gap-2.5 rounded-[10px]', className)}
    >
      {contenu}
    </Link>
  );
}
