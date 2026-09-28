import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Politique de sécurité du contenu — ajoutée le 26 sept. 2026.
 *
 * Quatre en-têtes étaient servis, celui-ci manquait. Il est le seul qui borne ce
 * que la page peut charger et où elle peut envoyer ce qu'elle contient.
 *
 * ⚠️ **ELLE EST SERRÉE PARCE QUE L'APPLICATION NE CHARGE RIEN DE L'EXTÉRIEUR, et
 * cela a été vérifié avant d'écrire la règle** : aucune ressource distante dans
 * les composants ni dans le CSS, polices auto-hébergées (`next/font/local`),
 * icônes `lucide` embarquées, logo Google tracé en SVG en ligne, et **aucun
 * trafic navigateur → Supabase** (`lib/supabase/client.ts` n'est importé nulle
 * part, tout passe par le serveur). `default-src 'self'` n'est donc pas un pari.
 *
 * ⚠️ **`'unsafe-inline'` SUR `script-src` EST UN COMPROMIS ASSUMÉ, ET IL FAUT LE
 * DIRE : cette politique ne bloque PAS un script injecté en ligne.** Next
 * insère la charge RSC dans des `<script>` en ligne dont le contenu change à
 * chaque page : les autoriser demande soit un `nonce`, soit `'unsafe-inline'`.
 * Les empreintes ne sont pas praticables.
 *
 * Le `nonce` a été écarté, et voici pourquoi : Next le lit dans l'en-tête de la
 * REQUÊTE, ce qui **rend la page dynamique**. Or `/` et les trois pages légales
 * sont STATIQUES par décision documentée (la landing fait 1,81 ko, c'est la
 * première page que voit un prospect sur un réseau lent), et une page
 * prérendue ne peut pas porter un `nonce` engendré à la requête : ses scripts
 * seraient bloqués et la page cesserait de fonctionner. Il aurait fallu deux
 * politiques et une liste de chemins à garder en accord avec la sortie de
 * `npm run build` — le genre d'accord qui se défait en silence.
 *
 * **Ce que la politique bloque malgré tout, et qui n'est pas rien** : le
 * chargement d'un script depuis un domaine tiers, `<object>` et `<embed>`,
 * l'affichage du site dans une iframe, la réécriture des URL relatives par un
 * `<base>`, et **l'envoi d'un formulaire vers un autre domaine** — c'est-à-dire
 * l'exfiltration, l'étape qui transforme une injection en vol de données.
 *
 * **Ce qui protège réellement de l'injection en ligne reste le code** : React
 * échappe tout ce qu'il affiche, et **le dépôt ne contient aucun
 * `dangerouslySetInnerHTML` ni aucun `innerHTML`** — vérifié. Les deux sorties
 * où une chaîne d'utilisateur devient une URL sont filtrées à part : les liens
 * de paiement par schéma (`lib/payments/tara.ts`) et le logo par format
 * (`logoDataUrlSchema`). **Si l'un de ces trois faits cesse d'être vrai, cette
 * politique ne rattrapera pas la faute** — c'est le moment de passer au `nonce`
 * et d'accepter la landing dynamique.
 *
 * ⚠️ **`frame-ancestors` ne remplace pas `X-Frame-Options`, il le double.** Les
 * deux restent : le second couvre les navigateurs qui ignorent le premier.
 *
 * ⚠️ **`Strict-Transport-Security` N'EST PAS POSÉ ICI, délibérément.** Vercel le
 * sert déjà (`max-age=63072000`). Y ajouter `includeSubDomains` forcerait HTTPS
 * sur **tous** les sous-domaines de `xn-facture.com`, dont `mail.` et
 * `webmail.` restés chez LWS : une messagerie servie en HTTP deviendrait
 * inaccessible, et le symptôme n'apparaîtrait pas sur le site.
 */
/**
 * ⚠️ **`'unsafe-eval'` EN DÉVELOPPEMENT SEULEMENT, et il est indispensable.**
 * Le rechargement à chaud de Next évalue le code par `eval` : sans cette
 * exception, `npm run dev` s'arrête sur `EvalError` et l'écran reste blanc. La
 * panne serait déroutante — la politique est écrite pour la production, et
 * c'est en développement qu'elle se manifesterait d'abord.
 *
 * `NODE_ENV` vaut `production` pendant `npm run build`, donc le fichier
 * déployé ne porte jamais cette exception. **Vérifié sur l'en-tête réellement
 * servi.**
 */
const enDeveloppement = process.env.NODE_ENV !== 'production';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDeveloppement ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // `data:` porte le logo de l'entreprise (validé par ailleurs) ; `blob:` sert
  // aux aperçus produits dans le navigateur.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Les Server Actions postent vers notre propre origine. Le sous-domaine
  // Supabase est admis par prudence : il est notre propre dorsale, et s'il
  // devenait un jour appelé depuis le navigateur, l'absence de cette ligne se
  // manifesterait par une panne silencieuse chez l'utilisateur.
  "connect-src 'self' https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
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
