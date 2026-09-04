import type { Company } from '@/lib/types';

/**
 * Charge utile envoyée à la route de génération PDF.
 *
 * Elle est volontairement AUTOSUFFISANTE : en phase 2 les factures vivent dans
 * le `localStorage` du navigateur, le serveur n'a aucun moyen de les relire. En
 * phase 3, cette même route deviendra un `GET /api/factures/[id]/pdf` qui lira
 * la facture en base et vérifiera les droits — le document PDF lui-même, lui, ne
 * changera pas.
 */
export interface PdfLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PdfPayload {
  /**
   * Nature du document. Un devis et une facture partagent la même mise en page
   * — mêmes lignes, mêmes totaux — et ne diffèrent que par leur titre, le
   * libellé de leur seconde date et la présence du bloc de règlement. Deux
   * gabarits séparés auraient divergé dès le premier changement.
   */
  docType?: 'invoice' | 'quote';
  number: string | null;
  statusLabel: string;
  isDraft: boolean;
  issueDate: string;
  /** Échéance de règlement pour une facture, fin de validité pour un devis. */
  dueDate: string;
  client: { name: string; email: string; address: string };
  company: Company;
  lines: PdfLine[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
}

/**
 * Validation de forme côté serveur.
 *
 * La charge vient du client : on ne lui fait pas confiance. Il ne s'agit pas
 * encore de sécurité — sans authentification il n'y a rien à protéger — mais
 * d'éviter qu'une charge malformée ne fasse tomber la route en 500.
 */
export function isPdfPayload(value: unknown): value is PdfPayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;

  const numbers = ['subtotal', 'vatRate', 'vatAmount', 'total', 'amountPaid', 'balanceDue'];
  if (!numbers.every((key) => typeof p[key] === 'number' && Number.isFinite(p[key]))) return false;

  if (typeof p.issueDate !== 'string' || typeof p.dueDate !== 'string') return false;
  if (p.docType !== undefined && p.docType !== 'invoice' && p.docType !== 'quote') return false;
  if (typeof p.company !== 'object' || p.company === null) return false;
  if (typeof p.client !== 'object' || p.client === null) return false;
  if (!Array.isArray(p.lines)) return false;

  return p.lines.every((line) => {
    if (typeof line !== 'object' || line === null) return false;
    const l = line as Record<string, unknown>;
    return (
      typeof l.description === 'string' &&
      typeof l.quantity === 'number' &&
      typeof l.unitPrice === 'number' &&
      typeof l.total === 'number'
    );
  });
}

/**
 * Nom de fichier proposé au téléchargement.
 *
 * La signature ne demande que ce qu'elle utilise — le nom du client, pas tout
 * son bloc — pour être appelable depuis une vue sans fabriquer une charge PDF
 * complète juste pour obtenir un nom.
 */
export function pdfFileName(payload: {
  number: string | null;
  client: { name: string };
  docType?: 'invoice' | 'quote';
}): string {
  // Un document sans numéro se nomme par sa nature et son destinataire : deux
  // fichiers « sans-numero.pdf » dans un dossier de téléchargements ne se
  // distinguent plus.
  const fallback = payload.docType === 'quote' ? 'Devis' : 'Brouillon';
  const base = payload.number ?? `${fallback}-${payload.client.name}`;
  // Un nom de fichier ne doit contenir ni séparateur de chemin ni caractère
  // interdit sous Windows.
  return `${base.replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`;
}
