/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,

  experimental: {
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
