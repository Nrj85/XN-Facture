import type { InvoiceView } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { jourPourNom, toCsv, type Colonne } from '@/lib/csv';

/**
 * Export comptable des factures d'UNE entreprise.
 *
 * C'est la fonction qui sépare réellement **Entreprise** de **Pro** — jusqu'au
 * 21 oct. 2026 les deux formules étaient **fonctionnellement identiques**, et
 * la carte à 15 000 FCFA vendait « Export comptable » sans aucune
 * implémentation. On ne retire pas la promesse, on la livre.
 *
 * ⚠️ **NE PAS CONFONDRE AVEC `lib/admin/company-export.ts`.** Celui-là est
 * transversal — toutes les entreprises de la plateforme — et réservé aux
 * administrateurs, pour la prospection. Celui-ci porte les factures d'une
 * seule entreprise, et c'est SON titulaire qui le télécharge, pour son
 * comptable. Deux publics, deux fichiers. Ils partagent la mécanique CSV
 * (`lib/csv.ts`) et rien d'autre.
 */

/**
 * ⚠️ **LES BROUILLONS SONT EXCLUS, LES ANNULÉES NON — et ce n'est pas un
 * détail de confort.**
 *
 * Un brouillon n'a pas de numéro : ce n'est pas une pièce comptable, c'est une
 * intention. En revanche une facture **annulée garde son numéro**, et la
 * séquence `FAC-AAAA-NNNN` doit être continue : l'omettre creuserait un trou
 * que le comptable lirait comme une facture manquante — exactement le soupçon
 * qu'une comptabilité doit éviter. Elle figure donc, avec son statut en clair.
 */
export function isAccountable(invoice: InvoiceView): boolean {
  /*
    ⚠️ **LES DEUX CONDITIONS SONT NÉCESSAIRES, et ne tester que le numéro
    était un VRAI DÉFAUT — corrigé le 23 oct. 2026.**

    « Un brouillon n'a pas de numéro » est faux dès qu'on repasse une facture
    émise en brouillon : `setInvoiceStatusAction` n'attribue un numéro que dans
    l'autre sens (`status !== 'draft' && number === null`) et **conserve celui
    qui existe** — à dessein, pour que le document retrouve sa place dans la
    séquence s'il est réémis.

    Conséquence du filtre d'origine : une facture repassée en brouillon partait
    **dans le fichier du comptable, étiquetée « Brouillon »** — précisément ce
    que le commentaire ci-dessus jure d'éviter. Le statut STOCKÉ est donc le
    juge, et le numéro ne sert plus qu'à écarter ce qui n'a jamais été émis.
  */
  return invoice.status !== 'draft' && invoice.number !== null;
}

/**
 * ⚠️ **ON EXPORTE LE STATUT STOCKÉ, PAS LE STATUT AFFICHÉ.**
 *
 * `deriveStatus` replie `partially_paid` sur « Envoyée » — dette assumée et
 * documentée du projet, défendable à l'écran où ce qui compte est le reste dû.
 * **Pour un comptable, c'est faux** : une facture à moitié soldée n'est pas
 * une facture simplement envoyée. Le fichier dit donc la vérité de la base.
 *
 * Symétriquement « en retard » n'y figure pas : c'est un statut DÉRIVÉ d'une
 * date, jamais stocké, et il changerait tout seul entre deux exports du même
 * exercice. L'échéance est dans sa propre colonne, le comptable en tire ce
 * qu'il veut.
 */
const STATUTS: Record<string, string> = {
  sent: 'Émise',
  partially_paid: 'Partiellement payée',
  paid: 'Payée',
  cancelled: 'Annulée',
  draft: 'Brouillon',
};

/**
 * ⚠️ **LES MONTANTS SORTENT EN ENTIERS DE FRANCS, SANS ESPACE NI SYMBOLE.**
 * `formatMoney` produit « 1 192 500 FCFA » avec une espace fine insécable
 * (U+202F) : lisible à l'écran, **inutilisable dans un tableur**, qui y verrait
 * du texte et refuserait d'additionner. Le FCFA n'ayant pas de centimes, un
 * entier nu est exact et directement sommable.
 */
const COLONNES: Colonne<InvoiceView>[] = [
  { titre: 'Numéro', lire: (f) => f.number ?? '' },
  { titre: 'Date d’émission', lire: (f) => formatDate(f.issueDate) },
  { titre: 'Date d’échéance', lire: (f) => formatDate(f.dueDate) },
  { titre: 'Client', lire: (f) => f.clientName },
  { titre: 'Statut', lire: (f) => STATUTS[f.status] ?? f.status },
  { titre: 'Montant HT', lire: (f) => f.subtotal },
  // Le taux est gelé sur le document : une entreprise qui change de taux ne
  // réécrit pas ses pièces déjà remises. La virgule décimale est celle du
  // tableur français.
  { titre: 'Taux TVA (%)', lire: (f) => (f.vatExempt ? '' : String(f.vatRate).replace('.', ',')) },
  { titre: 'Montant TVA', lire: (f) => (f.vatExempt ? 0 : f.vatAmount) },
  { titre: 'Total TTC', lire: (f) => f.total },
  { titre: 'Encaissé', lire: (f) => f.amountPaid },
  { titre: 'Reste dû', lire: (f) => f.balanceDue },
  { titre: 'Devise', lire: () => 'XAF' },
  // ⚠️ La colonne qui évite une question au comptable : un total sans ligne de
  // TVA peut être une erreur de saisie ou un régime. Ici, c'est écrit.
  { titre: 'Régime TVA', lire: (f) => (f.vatExempt ? 'Non applicable' : 'Assujetti') },
];

/** Les factures exportables, de la plus ancienne à la plus récente. */
export function accountingRows(invoices: InvoiceView[]): InvoiceView[] {
  return invoices
    .filter(isAccountable)
    .slice()
    // Ordre chronologique : c'est celui d'un journal comptable, et il rend la
    // continuité de la numérotation lisible d'un coup d'œil.
    .sort(
      (a, b) =>
        a.issueDate.localeCompare(b.issueDate) || (a.number ?? '').localeCompare(b.number ?? ''),
    );
}

export function toAccountingCsv(invoices: InvoiceView[]): string {
  return toCsv(COLONNES, accountingRows(invoices));
}

/** `xn-facture-comptabilite-atelier-nkolo-2026-10-21.csv` */
export function accountingFilename(companyName: string, now = new Date()): string {
  const base = companyName
    .normalize('NFD')
    // Les diacritiques tombent, le reste devient des tirets : un nom de fichier
    // qui traverse Windows, macOS et une pièce jointe sans surprise.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `xn-facture-comptabilite-${base || 'entreprise'}-${jourPourNom(now)}.csv`;
}
