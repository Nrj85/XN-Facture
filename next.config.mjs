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
     * `pdfkit` lit les métriques des polices de base — `Helvetica.afm` et ses
     * treize voisines — dans `node_modules/pdfkit/js/data/`, par un chemin
     * calculé à l'exécution. L'analyse statique de Next ne peut pas le voir :
     * la trace du build n'embarquait que le profil couleur `.icc` du même
     * dossier, et pas un seul `.afm`. La fonction déployée se retrouvait donc
     * sans la police que le document réclame, et `renderToBuffer` levait.
     *
     * En local rien ne paraissait, puisque `node_modules` est présent en
     * entier : symptôme exact, 200 en développement et 500 sur Vercel, sur la
     * même facture et le même code.
     */
    outputFileTracingIncludes: {
      '/api/factures/[id]/pdf': ['./node_modules/pdfkit/js/data/**'],
      '/api/devis/[id]/pdf': ['./node_modules/pdfkit/js/data/**'],
    },
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
