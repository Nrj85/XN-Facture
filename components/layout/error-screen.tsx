'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Écran d'erreur serveur — **le seul de tout le projet**.
 *
 * ⚠️ **AVANT LE 23 oct. 2026, LE DÉPÔT N'AVAIT AUCUNE FRONTIÈRE D'ERREUR.**
 * Ni `global-error`, ni le moindre `error.tsx` : toute exception d'un
 * composant serveur ou d'une Server Action livrait à l'utilisateur la page
 * brute de Next —
 *
 *     « Application error: a server-side exception has occurred
 *       while loading www.xn-facture.com. Digest: 4166884167 »
 *
 * — en anglais, sans dire quoi faire, et **sans aucun moyen d'en sortir**.
 * C'est exactement le cul-de-sac que le projet s'interdit ailleurs : « un
 * refus qui n'ouvre aucun chemin est un cul-de-sac » (§2, fenêtre de plafond).
 * Signalé par l'utilisateur le 23 oct. 2026, à l'enregistrement et à la
 * déconnexion.
 *
 * ⚠️ **CET ÉCRAN NE RÉPARE AUCUNE PANNE — il la rend LISIBLE et RÉCUPÉRABLE.**
 * Ne pas le lire comme un correctif de la cause : c'est un filet, et il faut
 * continuer à chercher pourquoi la page a levé.
 *
 * ⚠️ **DEUX BOUTONS, ET CE N'EST PAS UN DOUBLON.** Ils ne font pas la même
 * chose, et c'est le premier qui sauve le cas le plus courant :
 *
 * - « Recharger la page » fait un vrai `location.reload()` : il **retélécharge
 *   le code**. C'est le seul qui répare un onglet resté ouvert à travers un
 *   déploiement — celui-là envoie des identifiants de Server Action qui
 *   n'existent plus dans le build servi. **Mesuré en production le
 *   23 oct. 2026** : un identifiant d'action périmé rend 404 par le chemin
 *   JavaScript et **500 par le chemin progressif**, là où l'identifiant valide
 *   rend 303.
 * - « Réessayer sans recharger » appelle le `reset()` de Next : il **re-rend
 *   le segment** avec le JavaScript DÉJÀ chargé. Il suffit pour une panne
 *   passagère (base injoignable une seconde, fonction froide) et ne peut rien
 *   contre un onglet périmé — d'où sa place en second.
 *
 * ⚠️ **LE `digest` EST AFFICHÉ, et il le faut.** C'est la seule chose qui
 * relie l'écran de l'utilisateur à la ligne du journal serveur : sans lui, une
 * capture d'écran ne permet de retrouver aucune trace. Il ne divulgue rien —
 * c'est une empreinte, jamais le message, qui lui reste en anglais et côté
 * serveur (même discipline que `translateAuthError` et `AdminRead<T>`).
 */
export function ErrorScreen({
  error,
  reset,
  contexte,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Ce que la personne était en train de faire, pour situer l'écran. */
  contexte: string;
}) {
  useEffect(() => {
    // Le motif technique part au JOURNAL, jamais à l'écran : il arriverait en
    // anglais, avec sa pile. Même règle que `AdminRead<T>` (§2).
    console.error('Erreur rendue à l’utilisateur :', error);
  }, [error]);

  return (
    <div className="animate-fade-in mx-auto flex w-full max-w-[560px] flex-col items-start gap-5 px-4 py-10 sm:px-6">
      <header>
        <p className="label-caps">{contexte}</p>
        <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
          Cette page n’a pas pu s’afficher
        </h1>
        <p className="mt-3 text-sm text-ink-2">
          Quelque chose a échoué de notre côté — ce n’est pas une erreur de votre part, et{' '}
          <strong className="font-semibold text-ink">aucune de vos données n’est perdue</strong>.
        </p>
      </header>

      <div className="w-full rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <p className="text-sm text-ink-2">
          Si cette page était ouverte depuis un moment, elle travaillait sans doute avec une
          version périmée du site.{' '}
          <strong className="font-semibold text-ink">La recharger suffit alors</strong> — c’est le
          premier geste à tenter.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button type="button" onClick={() => window.location.reload()}>
            Recharger la page
          </Button>
          {/*
            `reset()` ne retélécharge rien : il rejoue le rendu avec le code
            déjà en mémoire. Proposé en SECOND, donc — il ne peut rien contre
            un onglet périmé.
          */}
          <Button type="button" variant="secondary" onClick={reset}>
            Réessayer sans recharger
          </Button>
        </div>
      </div>

      {error.digest ? (
        <p className="text-[12.5px] text-ink-3">
          Si cela recommence, communiquez-nous cette référence :{' '}
          <span className="tabular font-semibold text-ink-2">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
