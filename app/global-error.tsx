'use client';

import { useEffect } from 'react';

/**
 * Frontière de DERNIER RECOURS — elle ne se déclenche que si la coquille
 * racine elle-même a échoué.
 *
 * ⚠️ **ELLE REMPLACE `<html>` ET `<body>`, ce n'est pas une option.** Quand
 * `app/layout.tsx` tombe, rien n'a été rendu : ce fichier est le document
 * entier. Omettre ces deux balises donne une page vide.
 *
 * ⚠️ **AUCUN IMPORT DU PROJET ICI, ET C'EST DÉLIBÉRÉ — deux raisons.**
 *
 * 1. **La feuille de styles n'est pas garantie.** `globals.css` et les polices
 *    sont chargées par la coquille racine, celle-là même qui vient d'échouer :
 *    une classe Tailwind ne peindrait peut-être rien. D'où des styles en
 *    ligne, seule exception admise à la règle « aucune valeur en dur » du
 *    §6.1 — elle vise les composants, pas le filet qui les remplace quand
 *    tout est tombé.
 * 2. **La landing est pesée à l'octet.** Importer `ErrorScreen` et `Button`
 *    les ferait entrer dans le graphe de la page d'accueil, qui tient à
 *    1,86 ko de JS par décision documentée (§2). Un filet d'erreur ne doit
 *    pas coûter de la bande passante à chaque prospect sur un réseau lent.
 *
 * Les couleurs sont celles du §6.2, recopiées — c'est le quatrième endroit où
 * elles le sont, après `tailwind.config.ts`, `marketing.css` et
 * `invoice-document.tsx`. **Si la rampe de marque bouge, ce fichier aussi.**
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erreur fatale rendue à l’utilisateur :', error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#FBF8F3',
          color: '#1B1815',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <main style={{ maxWidth: 520, width: '100%' }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#5C544A',
            }}
          >
            XN-Facture
          </p>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, lineHeight: 1.1 }}>
            Le site n’a pas pu s’afficher
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 14, color: '#5C544A', lineHeight: 1.6 }}>
            Quelque chose a échoué de notre côté. Ce n’est pas une erreur de votre part, et{' '}
            <strong style={{ color: '#1B1815' }}>aucune de vos données n’est perdue</strong>.
          </p>

          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: '#FFFFFF',
              border: '1px solid #E8E1D4',
              borderRadius: 14,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: '#5C544A', lineHeight: 1.6 }}>
              Si cette page était ouverte depuis un moment, elle travaillait sans doute avec une
              version périmée du site.{' '}
              <strong style={{ color: '#1B1815' }}>La recharger suffit alors.</strong>
            </p>
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {/*
                `location.reload()` d'abord : c'est le seul qui retélécharge le
                code, donc le seul qui répare un onglet resté ouvert à travers
                un déploiement. `reset()` rejoue le rendu avec le JavaScript
                déjà en mémoire — il ne peut rien contre ce cas-là.
              */}
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  minHeight: 36,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid transparent',
                  background: '#E32D05',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Recharger la page
              </button>
              <button
                type="button"
                onClick={reset}
                style={{
                  minHeight: 36,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid #E8E1D4',
                  background: '#FFFFFF',
                  color: '#1B1815',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Réessayer sans recharger
              </button>
            </div>
          </div>

          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 12.5, color: '#7A7064' }}>
              Si cela recommence, communiquez-nous cette référence :{' '}
              <span style={{ fontWeight: 600, color: '#5C544A' }}>{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
