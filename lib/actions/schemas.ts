import { z } from 'zod';

/**
 * Validation des charges qui franchissent la frontière serveur.
 *
 * Une Server Action est une route HTTP : le navigateur peut lui envoyer
 * n'importe quoi, pas seulement ce que le formulaire produit. Les contraintes
 * CHECK de la base constituent une seconde ligne de défense, mais elles rendent
 * des messages du type « violates check constraint invoice_items_qty_milli_check »
 * — inexploitables par l'utilisateur. Ces schémas produisent des phrases
 * françaises et attrapent l'erreur plus tôt.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ.');

/** Montant en francs entiers. Aucun centime, aucun flottant. */
const franc = z
  .number()
  .finite('Montant invalide.')
  .min(0, 'Un montant ne peut pas être négatif.')
  .max(Number.MAX_SAFE_INTEGER, 'Montant hors plage.');

export const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, 'Chaque ligne doit porter une désignation.'),
  quantity: z
    .number()
    .finite('Quantité invalide.')
    .gt(0, 'La quantité doit être supérieure à zéro.'),
  unitPrice: franc,
});

const documentBase = {
  clientId: z.string().uuid('Client invalide.'),
  issueDate: isoDate,
  address: z.string().default(''),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, 'Ajoutez au moins une ligne.'),
};

export const invoiceDraftSchema = z
  .object({ ...documentBase, dueDate: isoDate })
  .refine((draft) => draft.dueDate >= draft.issueDate, {
    message: 'L’échéance ne peut pas précéder la date d’émission.',
    path: ['dueDate'],
  });

export const quoteDraftSchema = z
  .object({ ...documentBase, validUntil: isoDate })
  .refine((draft) => draft.validUntil >= draft.issueDate, {
    message: 'La date de validité ne peut pas précéder la date d’émission.',
    path: ['validUntil'],
  });

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.'),
  contactName: z.string().optional(),
  email: z.string().trim().email('Format d’email invalide.').or(z.literal('')),
  phone: z.string().default(''),
  address: z.string().optional(),
  city: z.string().default(''),
});

export const companySchema = z.object({
  name: z.string().trim().min(1, 'Le nom commercial est obligatoire.'),
  legalName: z.string().trim().min(1, 'La raison sociale est obligatoire.'),
  niu: z.string().default(''),
  rccm: z.string().default(''),
  address: z.string().default(''),
  city: z.string().default(''),
  country: z.string().default('Cameroun'),
  phone: z.string().default(''),
  email: z.string().trim().email('Format d’email invalide.').or(z.literal('')),
  logoDataUrl: z.string().optional(),
  currency: z.enum(['XAF', 'XOF']),
  vatRate: z.number().min(0, 'Taux attendu entre 0 et 100.').max(100, 'Taux attendu entre 0 et 100.'),
  paymentTermsDays: z
    .number()
    .int('Délai attendu en jours entiers.')
    .min(0)
    .max(365, 'Délai attendu entre 0 et 365 jours.'),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{2,10}$/, 'De 2 à 10 caractères : majuscules, chiffres ou tiret.'),
  defaultNotes: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  momoMtn: z.string().optional(),
  momoOrange: z.string().optional(),
});

export const paymentSchema = z.object({
  amount: franc.refine((value) => value > 0, 'Saisissez un montant supérieur à zéro.'),
});

/** Premier message d'erreur, en français, prêt à afficher. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Données invalides.';
}
