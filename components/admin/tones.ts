/**
 * Les quatre tons de pastille de l'espace administrateur.
 *
 * ⚠️ **ILS RÉEMPLOIENT LES TRIOS DE STATUT DU §6.2, ET N'EN INVENTENT AUCUN.**
 * `status-paid`, `status-sent`, `status-draft` et `status-overdue` sont déjà
 * mesurés entre 6:1 et 7:1 sur leur fond. Un jeu de couleurs propre au
 * back-office aurait divergé du produit au bout de deux écrans — et il aurait
 * fallu remesurer chaque contraste.
 *
 * ⚠️ **CE FICHIER EXISTE PARCE QUE DEUX CARTES S'EN SERVENT** : le badge
 * d'action du journal (`activity-journal.tsx`) et le badge « Confirmé » de la
 * carte des comptes (`admin-view.tsx`). Quand le journal est parti dans son
 * propre composant le 24 oct. 2026, la table s'est retrouvée appelée des deux
 * côtés : la recopier aurait garanti qu'un jour l'un des deux change de teinte
 * sans l'autre, sur le même écran.
 *
 * ⚠️ **CE N'EST PAS UN CONCURRENT DE `ui/status-badge.tsx`**, qui reste la
 * seule façon d'afficher le statut d'une FACTURE ou d'un DEVIS. Ici il s'agit
 * d'une action de journal et d'un booléen de confirmation — ni l'un ni l'autre
 * n'est un statut de document.
 */
export const TONS = {
  neutre: 'bg-status-draft-bg text-status-draft',
  vert: 'bg-status-paid-bg text-status-paid',
  ambre: 'bg-status-sent-bg text-status-sent',
  rouge: 'bg-status-overdue-bg text-status-overdue',
} as const;

export type Ton = keyof typeof TONS;
