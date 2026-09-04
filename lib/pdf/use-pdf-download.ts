'use client';

import { useCallback, useState } from 'react';

/**
 * Télécharge un document PDF produit par le serveur.
 *
 * En phase 2, le navigateur POSTait la facture entière : le serveur n'avait
 * aucun moyen de la relire, puisqu'elle vivait dans `localStorage`. Ce n'est
 * plus le cas — la route lit désormais la base et vérifie les droits, donc un
 * simple `GET` par identifiant suffit. La conséquence n'est pas cosmétique :
 * un document ne peut plus être fabriqué pour une facture qui ne vous
 * appartient pas.
 */
export function usePdfDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Renvoie le message d'erreur, ou `null` si tout s'est bien passé. */
  const download = useCallback(async (url: string, filename: string): Promise<string | null> => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? 'Le serveur n’a pas pu produire le document.');
      }

      const blob = await response.blob();

      // `response.ok` est vrai jusqu'à 299, donc aussi pour un 204 sans corps.
      // Sans ce contrôle, une réponse vidée en chemin ferait enregistrer un PDF
      // de zéro octet **sans aucun message** : l'utilisateur ne découvrirait le
      // problème qu'en ouvrant le fichier devant son client. Observé pour de
      // vrai — Chromium détourne les réponses `application/pdf` vers son
      // gestionnaire de téléchargement et rend un 204 vide à `fetch`.
      if (blob.size === 0) {
        throw new Error('Le document reçu est vide. Réessayez dans un instant.');
      }

      const objectUrl = URL.createObjectURL(blob);

      // Ancre éphémère : c'est le seul moyen d'imposer un nom de fichier depuis
      // un blob, y compris sur les navigateurs mobiles.
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Libéré au tour suivant : révoquer immédiatement annulerait le
      // téléchargement sur certains navigateurs.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
      return null;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Téléchargement impossible.';
      setError(message);
      return message;
    } finally {
      setBusy(false);
    }
  }, []);

  return { download, busy, error };
}
