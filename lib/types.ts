import type { IsoDate } from '@/lib/format';
import type { Currency } from '@/lib/money';

/**
 * Statuts stockés. `overdue` n'en fait volontairement PAS partie : il se déduit
 * de la date d'échéance (voir `deriveStatus`). Le stocker imposerait un cron
 * nocturne sur toute la base, avec dérive garantie entre deux passages.
 */
export type StoredStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'cancelled';

/** Statut affiché, calculé à la volée. */
export type DisplayStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  email: string;
  phone: string;
  address?: string;
  city: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  /** Peut être fractionnaire (2,5 heures). */
  quantity: number;
  /** Prix unitaire en francs entiers. */
  unitPrice: number;
}

/**
 * Facture telle que stockée.
 *
 * Les totaux n'y figurent PAS : ils se déduisent des lignes via `computeTotals`.
 * Stocker un total à côté de ses lignes, c'est se garantir qu'un jour les deux
 * ne concorderont plus.
 */
export interface Invoice {
  id: string;
  /** `null` tant que la facture est un brouillon : les brouillons ne consomment
   *  pas de numéro, ce qui évite les trous dans la séquence. */
  number: string | null;
  clientId: string;
  issueDate: IsoDate;
  dueDate: IsoDate;
  items: InvoiceItem[];
  /** Taux de TVA appliqué à la facture entière, en pourcentage (19.25). */
  vatRate: number;
  /** Adresse de facturation, figée sur la facture au moment de son émission. */
  address: string;
  notes?: string;
  /** Somme des encaissements, en francs entiers. */
  amountPaid: number;
  status: StoredStatus;
  createdAt: string;
}

/** Une facture augmentée de tout ce qui se calcule. */
export interface InvoiceView extends Invoice {
  clientName: string;
  displayStatus: DisplayStatus;
  subtotal: number;
  vatAmount: number;
  /** Montant TTC. */
  total: number;
  balanceDue: number;
  /** Jours restants avant échéance ; négatif si dépassée. */
  daysToDue: number;
}

/**
 * Paramètres de l'entreprise émettrice.
 *
 * Les mentions légales (NIU, RCCM, régime) ne sont pas décoratives : elles sont
 * obligatoires sur une facture au Cameroun et dans la plupart des pays CEMAC.
 */
export interface Company {
  name: string;
  legalName: string;
  niu: string;
  rccm: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  /** Logo encodé en data URL, redimensionné avant stockage. */
  logoDataUrl?: string;
  currency: Currency;
  /** Taux appliqué aux NOUVELLES factures. Les factures existantes gardent le leur. */
  vatRate: number;
  paymentTermsDays: number;
  invoicePrefix: string;
  defaultNotes?: string;
  bankName?: string;
  bankAccount?: string;
  momoMtn?: string;
  momoOrange?: string;
}

/**
 * Statuts stockés d'un devis.
 *
 * « Expiré » n'en fait pas partie, pour la même raison que « en retard » est
 * absent des statuts de facture : il se déduit de la date de validité. Un devis
 * envoyé devient caduc tout seul au passage de sa date, sans traitement de fond.
 */
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused';

/** Statut affiché d'un devis, calculé à la volée. */
export type QuoteDisplayStatus = QuoteStatus | 'expired' | 'converted';

/**
 * Devis (ou facture proforma).
 *
 * Volontairement proche de `Invoice` — mêmes lignes, même TVA — pour que la
 * conversion en facture soit une recopie et non une traduction. Deux différences
 * de fond : un devis n'a pas d'échéance de paiement mais une durée de validité,
 * et il n'encaisse rien.
 */
export interface Quote {
  id: string;
  /** `null` tant que le devis est un brouillon, comme pour une facture. */
  number: string | null;
  clientId: string;
  issueDate: IsoDate;
  /** Dernier jour de validité de l'offre. */
  validUntil: IsoDate;
  items: InvoiceItem[];
  vatRate: number;
  address: string;
  notes?: string;
  status: QuoteStatus;
  /**
   * Renseigné dès que le devis a produit une facture. C'est ce qui empêche de
   * le convertir deux fois — et donc de facturer deux fois la même prestation.
   */
  invoiceId?: string;
  createdAt: string;
}

/** Un devis augmenté de tout ce qui se calcule. */
export interface QuoteView extends Quote {
  clientName: string;
  displayStatus: QuoteDisplayStatus;
  subtotal: number;
  vatAmount: number;
  total: number;
  /** Jours de validité restants ; négatif si l'offre a expiré. */
  daysToExpiry: number;
}
