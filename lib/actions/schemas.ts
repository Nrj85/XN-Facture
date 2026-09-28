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

/**
 * Logo de l'entreprise — **une image en ligne, jamais une adresse.**
 *
 * ⚠️ **CE CHAMP ÉTAIT UN `z.string()` NU, ET C'ÉTAIT UN SSRF.** Trouvé le
 * 26 sept. 2026 en relisant la sécurité de l'application, pas signalé par un
 * outil. La valeur part telle quelle dans `<Image src={company.logoDataUrl} />`
 * (`lib/pdf/invoice-document.tsx`), et **`@react-pdf` accepte une URL distante :
 * il va la chercher depuis le serveur.**
 *
 * Le chemin d'attaque tenait en quatre gestes, tous ouverts à n'importe qui
 * puisque l'inscription est publique : créer un compte, créer son entreprise,
 * envoyer `logoDataUrl = 'http://169.254.169.254/…'` **directement à la Server
 * Action** — le redimensionnement du navigateur rasterise tout en PNG, mais
 * rien n'obligeait à passer par lui — puis télécharger sa propre facture. La
 * fonction Vercel émettait la requête. Requête aveugle (l'image ne se décode
 * pas), mais une requête sortante forgée depuis notre infrastructure reste un
 * SSRF : elle sonde un réseau interne et atteint ce qui n'est joignable que de
 * l'intérieur.
 *
 * ⚠️ **UNE LISTE BLANCHE DE SCHÉMAS NE SUFFIRAIT PAS ICI.** Le filtre
 * `lienSur()` de `lib/payments/tara.ts` autorise plusieurs schémas parce qu'un
 * lien de paiement doit pouvoir ouvrir WhatsApp ou un SMS. Ce champ-ci n'a
 * qu'un seul usage légitime : une image que **nous** avons encodée. Tout ce qui
 * n'est pas `data:` est refusé — pas de `http:`, pas de `https:`, pas de
 * `file:`. On n'énumère pas ce qui est interdit, on énumère ce qui est permis.
 *
 * ⚠️ **`image/svg+xml` EST EXCLU, délibérément.** Un SVG est un document : il
 * porte du script, et il finit dans un `<img>` de l'aperçu comme dans le PDF.
 * Le téléverseur n'en produit jamais — il repasse tout par un canvas et rend du
 * PNG — mais la validation ne doit pas dépendre du bon comportement du client.
 * **Vérifié avant de poser ce filtre : le seul logo présent en base est un
 * `data:image/png;base64,` de 3 758 caractères, il passe.** Le contrôle
 * comptait : refuser un logo déjà enregistré aurait bloqué l'enregistrement des
 * paramètres de cette entreprise sans rapport apparent avec le logo.
 *
 * Le plafond borne ce qu'un appel direct peut faire écrire en base. Le
 * téléverseur produit ~4 ko pour un logo réel ; 512 ko laisse passer le pire
 * cas d'un PNG 256 × 256 non compressible (~360 ko en base64) et arrête le
 * reste.
 */
const MAX_LOGO_CARACTERES = 512 * 1024;

const logoDataUrlSchema = z
  .string()
  .max(MAX_LOGO_CARACTERES, 'Logo trop lourd. Réimportez-le depuis les paramètres.')
  .regex(
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    'Logo invalide : seule une image importée depuis vos paramètres est acceptée.',
  )
  .or(z.literal(''))
  .optional();

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
  logoDataUrl: logoDataUrlSchema,
  currency: z.enum(['XAF', 'XOF']),
  vatRate: z.number().min(0, 'Taux attendu entre 0 et 100.').max(100, 'Taux attendu entre 0 et 100.'),
  vatRegistered: z.boolean(),
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
