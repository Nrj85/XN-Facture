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
};

export default nextConfig;
