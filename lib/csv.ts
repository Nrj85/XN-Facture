/**
 * Mécanique CSV commune — **un seul exemplaire dans tout le projet**.
 *
 * Elle vivait privée dans `lib/admin/company-export.ts`. L'export comptable
 * (21 oct. 2026) en avait besoin à l'identique : la recopier aurait garanti
 * qu'un jour l'un des deux fichiers s'ouvre proprement dans Excel et pas
 * l'autre, ou pire, qu'un seul des deux reste protégé contre l'injection de
 * formules. **Un doublon est un bug** (§6.1).
 *
 * Rien n'a changé dans le comportement : les trois réglages ci-dessous sont
 * repris à l'identique, avec le raisonnement qui les a choisis.
 */

/** Une colonne : son intitulé, et comment la lire sur une ligne. */
export interface Colonne<T> {
  titre: string;
  lire: (ligne: T) => string | number | null | undefined;
}

/**
 * Neutralise une cellule qui serait interprétée comme une formule.
 *
 * ⚠️ **C'est une protection, pas une coquetterie.** Les noms d'entreprise, de
 * client et les libellés de ligne sont saisis par les utilisateurs. Excel et
 * LibreOffice évaluent toute cellule commençant par `=`, `+`, `-` ou `@` :
 * quelqu'un qui nomme son entreprise `=HYPERLINK("http://...","Cliquez")` — ou
 * pire — attaquerait la machine de celui qui ouvre l'export. Le préfixe
 * apostrophe force le tableur à lire du texte. Les tabulations et retours
 * chariot de tête servent le même contournement, d'où leur présence ici.
 *
 * Effet de bord assumé : un numéro de téléphone en `+237…` reçoit aussi
 * l'apostrophe, que le tableur masque.
 */
function neutraliser(valeur: string): string {
  return /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
}

/** Échappe une cellule : guillemets doublés, champ encadré si besoin. */
export function cellule(valeur: string | number | null | undefined): string {
  const texte = neutraliser(String(valeur ?? ''));
  return /[";\r\n]/.test(texte) || texte !== texte.trim()
    ? `"${texte.replace(/"/g, '""')}"`
    : texte;
}

/**
 * Compose le fichier.
 *
 * ⚠️ **Trois détails décident si le fichier s'ouvre proprement dans Excel** —
 * et les trois ont été choisis, pas subis :
 *
 * - **Le séparateur est le point-virgule.** Excel en configuration française
 *   attend `;` ; avec une virgule il empile tout dans une seule colonne et
 *   impose un assistant d'importation.
 * - **Le fichier commence par une marque d'ordre d'octets (BOM).** Sans elle,
 *   Excel lit l'UTF-8 comme du latin-1 : « Douala » passe encore, « Échéance »
 *   et « Société » deviennent illisibles.
 * - **Les fins de ligne sont en CRLF**, comme le veut la spécification CSV.
 *
 * ⚠️ **Piège de test :** `response.text()` **supprime la marque d'ordre
 * d'octets** en décodant. Un contrôle qui vérifie `charCodeAt(0) === 0xFEFF`
 * sur ce texte échoue donc sur un fichier parfaitement correct. Lire les
 * octets bruts par `arrayBuffer()` et y chercher `EF BB BF`.
 */
export function toCsv<T>(colonnes: Colonne<T>[], rows: T[]): string {
  const lignes = [
    colonnes.map((c) => cellule(c.titre)).join(';'),
    ...rows.map((r) => colonnes.map((c) => cellule(c.lire(r))).join(';')),
  ];
  return `﻿${lignes.join('\r\n')}\r\n`;
}

/** Date du jour en `AAAA-MM-JJ`, fuseau de l'entreprise — pour nommer un fichier. */
export function jourPourNom(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Africa/Douala',
  }).format(now);
}
