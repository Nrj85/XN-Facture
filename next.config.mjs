import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,

  /**
   * Racine de la trace de fichiers, **figée** sur le dossier du projet.
   *
   * ⚠️ **Next 15 la DEVINE en remontant les dossiers à la recherche d'un
   * fichier de verrouillage**, et prévient quand il en trouve plusieurs :
   *
   *     Warning: Next.js inferred your workspace root, but it may not be correct.
   *
   * Constaté le 25 sept. 2026 : un `package-lock.json` traînait dans le dossier
   * personnel de l'utilisateur, hors du projet. La trace est restée juste cette
   * fois — 30 polices, vérifié — mais elle reposait sur une supposition.
   *
   * Or `outputFileTracingIncludes` ci-dessous résout ses chemins **à partir de
   * cette racine** : une racine mal devinée ferait manquer les polices de
   * pdfkit, et les PDF retomberaient en 500 sur Vercel sans que rien ne le
   * signale au build. On ne laisse pas une supposition décider de cela.
   */
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),

  /**
   * ⚠️ **SANS CECI, LES DEUX ROUTES PDF RÉPONDENT 500 SOUS NEXT 15.**
   *
   * Erreur exacte, relevée sur le serveur de production local :
   *
   *     Minified React error #31 — object with keys
   *     {$$typeof, type, key, ref, props}
   *
   * C'est-à-dire : « un objet n'est pas un enfant React valide », alors que
   * l'objet EST un élément React. Le `$$typeof` ne correspondait pas, parce
   * que deux React différents étaient en jeu — non pas deux installations
   * (`npm ls react` n'en montre qu'une, dédupliquée) mais **deux variantes du
   * même paquet** : le bundler de Next 15 résout `react` et
   * `react/jsx-runtime` vers leur build `react-server` à l'intérieur d'un
   * gestionnaire de route, et `@react-pdf/renderer` n'attend pas celui-là.
   *
   * Le déclarer externe le sort du bundle : il est chargé par la résolution
   * Node ordinaire, avec le React que le reste du paquet utilise.
   *
   * ⚠️ **Le build RÉUSSISSAIT** — c'est une panne d'exécution, invisible à la
   * compilation. Le contrôle qui la révèle est un appel réel à
   * `/api/factures/<id>/pdf`, à rejouer après toute montée de version de Next.
   */
  serverExternalPackages: ['@react-pdf/renderer'],

  /**
   * **Sans ceci, les PDF échouent en production et nulle part ailleurs.**
   *
   * Erreur exacte, relevée sur la fonction déployée :
   *
   *     Cannot find module
   *     '/var/task/node_modules/pdfkit/js/standard-fonts/Helvetica.cjs'
   *
   * `pdfkit` charge les polices de base par un **sous-chemin d'import de
   * paquet** — `require('#standard-fonts/Helvetica')`, résolu à l'exécution
   * via le champ `imports` de son `package.json`. L'analyse statique de Next
   * ne peut pas suivre cette indirection : les 29 fichiers du dossier étaient
   * absents de la trace, donc du bundle déployé.
   *
   * En local rien ne paraissait, puisque `node_modules` est présent en
   * entier : symptôme exact, 200 en développement et 500 sur Vercel, sur la
   * même facture et le même code.
   *
   * `js/data/**` est inclus par surcroît : ce dossier porte le profil couleur
   * et les métriques `.afm`, lus eux aussi par des chemins calculés.
   *
   * ⚠️ **CE RÉGLAGE A QUITTÉ `experimental` À LA MONTÉE EN NEXT 15.** Laissé
   * sous `experimental`, il aurait été **ignoré en silence** : le build aurait
   * réussi, et les PDF seraient retombés en 500 sur Vercel — exactement la
   * panne d'origine, sans le moindre avertissement pour la relier à la montée
   * de version. **Contrôle après tout changement de version de Next :** la
   * trace doit compter 30 fichiers, voir la commande en section 2 de CLAUDE.md.
   */
  outputFileTracingIncludes: {
    '/api/factures/[id]/pdf': [
      './node_modules/pdfkit/js/standard-fonts/**',
      './node_modules/pdfkit/js/data/**',
    ],
    '/api/devis/[id]/pdf': [
      './node_modules/pdfkit/js/standard-fonts/**',
      './node_modules/pdfkit/js/data/**',
    ],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  /**
   * L'ancienne adresse `xn-facture.vercel.app` renvoie vers le domaine propre.
   *
   * Vercel continue de servir l'application sur les deux : un favori, un
   * onglet resté ouvert ou un lien partagé avant la migration gardait donc
   * l'ancienne adresse sous les yeux de l'utilisateur, indéfiniment. Vercel ne
   * sait pas rediriger son propre sous-domaine `.vercel.app` depuis
   * l'interface — d'où cette règle, portée par le code.
   *
   * ⚠️ **`permanent: false` (307) est délibéré.** Un 308 serait mis en cache
   * par le navigateur de façon durable : le jour où le domaine propre pose un
   * problème, `xn-facture.vercel.app` ne redonnerait plus accès à
   * l'application pour qui l'a visitée une fois. Le filet de secours doit
   * rester praticable. Le référencement n'en souffre pas, l'adresse `.vercel.app`
   * n'étant pas l'adresse de marque.
   *
   * ⚠️ **`/api/` est exclu**, pour la même raison qui l'exclut du middleware :
   * `fetch` suit les redirections sans broncher, et le cookie de session est
   * posé sur l'ANCIEN domaine — une route PDF redirigée vers le nouveau
   * répondrait 401, et le bouton enregistrerait cette erreur sous le nom du
   * document. Les routes d'API refusent, elles ne redirigent pas.
   *
   * Les adresses de déploiement de prévisualisation
   * (`xn-facture-git-<branche>-<compte>.vercel.app`) portent un hôte différent
   * et ne correspondent donc pas : elles restent accessibles.
   */
  async redirects() {
    return [
      {
        source: '/:chemin((?!api/).*)',
        has: [{ type: 'host', value: 'xn-facture.vercel.app' }],
        destination: 'https://www.xn-facture.com/:chemin',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
