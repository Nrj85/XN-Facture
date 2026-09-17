'use client';

import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePdfDownload } from '@/lib/pdf/use-pdf-download';

/**
 * Télécharge la liste des entreprises inscrites, pour les campagnes de
 * prospection.
 *
 * ⚠️ **Il réemploie `usePdfDownload`, qui n'a rien de spécifique au PDF** : le
 * crochet appelle une route, contrôle la réponse, remet un blob sous un nom de
 * fichier imposé, et rapporte l'erreur. En écrire un second pour le CSV aurait
 * dupliqué le garde-fou du corps vide et la gestion d'erreur — un doublon est
 * un bug. Seul son NOM ment un peu ; il est consigné comme dette dans
 * CLAUDE.md.
 *
 * ⚠️ **Passer par `fetch` plutôt qu'une simple ancre est délibéré.** Une balise
 * `<a download>` qui reçoit un 403 enregistre le message d'erreur JSON dans un
 * fichier `.csv` : l'administrateur croit tenir son export et n'ouvre la
 * surprise que dans son tableur. Ici un refus s'affiche à l'écran.
 *
 * C'est une LECTURE. L'espace d'administration reste en lecture seule : ce
 * bouton n'écrit rien, et la base ne le lui permettrait pas.
 */
export function ExportCompaniesButton() {
  const { download, busy, error } = usePdfDownload();

  // Pas de `ml-auto` sur le conteneur : c'est le champ de recherche voisin qui
  // le porte. Deux marges automatiques dans la même rangée flex se partagent
  // l'espace libre et écarteraient les deux contrôles l'un de l'autre.
  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => {
          // Le nom définitif vient du serveur, qui date le fichier ; celui-ci
          // n'est qu'un repli si l'en-tête se perdait en route.
          void download('/api/admin/entreprises/export', 'xn-facture-entreprises.csv');
        }}
      >
        {busy ? (
          <Loader2 size={15} strokeWidth={2.2} className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <Download size={15} strokeWidth={2.2} aria-hidden />
        )}
        {/*
          « tout » n'est pas une fioriture : le bouton voisine avec un champ de
          recherche, et sans ce mot on croirait exporter le résultat du filtre.
        */}
        {busy ? 'Préparation…' : 'Exporter tout (CSV)'}
      </Button>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-3 py-2 text-[12.5px] font-medium text-status-overdue"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
