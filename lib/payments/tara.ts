import { z } from 'zod';

/**
 * Tara (Dikalo) — création d'un lien de paiement.
 *
 * `POST https://www.dikalo.co/api/tara/paymentlinks` rend six liens pour un
 * même règlement : lien général, carte, WhatsApp, SMS, Telegram, Dikalo.
 * Au Cameroun, cette variété compte autant que le paiement lui-même — tout le
 * monde n'a pas la même application installée.
 *
 * ⚠️ **Appel SERVEUR uniquement.** La clé transite dans le corps de la
 * requête : la poser dans un composant client la publierait à tout visiteur.
 * Elle n'est donc jamais préfixée `NEXT_PUBLIC_`.
 *
 * ⚠️ **Ce module ne décide rien.** Il fabrique un lien ; il ne constate aucun
 * paiement et n'accorde aucune formule. L'activation reste le fait du webhook
 * — manuelle tant que son contenu n'est pas documenté.
 */

const ENDPOINT = 'https://www.dikalo.co/api/tara/paymentlinks';

/**
 * ⚠️ **Les liens sont validés SCHÉMA PAR SCHÉMA, et c'est indispensable.**
 * Ils viennent d'une API tierce et finissent dans un `href`. Un
 * `javascript:...` renvoyé par un serveur compromis — ou par une réponse
 * détournée — s'exécuterait au clic. Seuls `https:` et les schémas de
 * messagerie attendus sont acceptés ; tout le reste est écarté en silence.
 */
const SCHEMAS_AUTORISES = ['https:', 'sms:', 'tg:', 'whatsapp:'];

function lienSur(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null;
  const brut = valeur.trim();
  if (!brut) return null;
  try {
    const url = new URL(brut);
    return SCHEMAS_AUTORISES.includes(url.protocol) ? brut : null;
  } catch {
    // `sms:+237...?body=...` est une URL valide au sens de `new URL`.
    // Ce qui échoue ici n'est pas une URL du tout : on l'écarte.
    return null;
  }
}

const reponseSchema = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
  generalLink: z.unknown().optional(),
  cardLink: z.unknown().optional(),
  whatsappLink: z.unknown().optional(),
  smsLink: z.unknown().optional(),
  telegramLink: z.unknown().optional(),
  dikaloLink: z.unknown().optional(),
});

/** Les liens retenus, dans l'ordre où ils seront proposés à l'écran. */
export interface PaymentLinks {
  general: string | null;
  card: string | null;
  whatsapp: string | null;
  sms: string | null;
  telegram: string | null;
  dikalo: string | null;
}

export function hasAnyLink(links: PaymentLinks | null): boolean {
  return links !== null && Object.values(links).some((lien) => lien !== null);
}

export interface TaraConfig {
  apiKey: string;
  businessId: string;
}

/**
 * Configuration, ou `null` si le prestataire n'est pas branché.
 *
 * Fonction et non constante : lue à l'exécution, donc poser les variables sur
 * Vercel suffit — pas de recompilation. Tant qu'elle rend `null`, la commande
 * se passe sans lien et l'écran retombe sur le règlement manuel.
 */
export function taraConfig(): TaraConfig | null {
  const apiKey = (process.env.TARA_API_KEY ?? '').trim();
  const businessId = (process.env.TARA_BUSINESS_ID ?? '').trim();
  return apiKey && businessId ? { apiKey, businessId } : null;
}

export interface CreateLinkInput {
  /** Notre référence de commande. Elle sert de `productId` : unique par construction. */
  reference: string;
  name: string;
  description: string;
  /** Entier de francs. Le FCFA n'a pas de centimes. */
  price: number;
  returnUrl: string;
  webhookUrl: string;
}

export type CreateLinkResult =
  | { ok: true; links: PaymentLinks }
  | { ok: false; reason: string };

/**
 * Crée le lien de paiement d'une commande.
 *
 * ⚠️ **Un échec ici ne doit jamais faire échouer la commande.** Elle existe
 * déjà en base avec sa référence ; refuser maintenant laisserait l'utilisateur
 * devant une erreur alors que le règlement manuel reste possible. D'où un
 * résultat, jamais une exception.
 */
export async function createPaymentLink(
  config: TaraConfig,
  input: CreateLinkInput,
): Promise<CreateLinkResult> {
  let reponse: Response;

  try {
    reponse = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: config.apiKey,
        businessId: config.businessId,
        productId: input.reference,
        productName: input.name,
        productPrice: input.price,
        productDescription: input.description,
        returnUrl: input.returnUrl,
        webHookUrl: input.webhookUrl,
      }),
      // Un prestataire lent ne doit pas bloquer la Server Action : mieux vaut
      // une commande sans lien qu'un écran figé.
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'injoignable' };
  }

  if (!reponse.ok) return { ok: false, reason: `http-${reponse.status}` };

  let brut: unknown;
  try {
    brut = await reponse.json();
  } catch {
    return { ok: false, reason: 'reponse-illisible' };
  }

  const parsed = reponseSchema.safeParse(brut);
  if (!parsed.success) return { ok: false, reason: 'reponse-inattendue' };

  const corps = parsed.data;
  if (corps.status && corps.status.toLowerCase() !== 'success') {
    return { ok: false, reason: corps.message ?? corps.status };
  }

  const links: PaymentLinks = {
    general: lienSur(corps.generalLink),
    card: lienSur(corps.cardLink),
    whatsapp: lienSur(corps.whatsappLink),
    sms: lienSur(corps.smsLink),
    telegram: lienSur(corps.telegramLink),
    dikalo: lienSur(corps.dikaloLink),
  };

  // Une réponse « success » sans aucun lien exploitable n'est pas un succès :
  // l'écran n'aurait rien à proposer.
  if (!hasAnyLink(links)) return { ok: false, reason: 'aucun-lien-exploitable' };

  return { ok: true, links };
}

/**
 * Relit des liens stockés en base.
 *
 * ⚠️ **Revalidés au passage.** Ils ont déjà été filtrés à l'écriture, mais une
 * donnée relue reste une donnée d'entrée : la valider une seconde fois coûte
 * trois lignes et protège d'un contenu posé autrement.
 */
export function readStoredLinks(valeur: unknown): PaymentLinks | null {
  if (!valeur || typeof valeur !== 'object') return null;
  const brut = valeur as Record<string, unknown>;
  const links: PaymentLinks = {
    general: lienSur(brut.general),
    card: lienSur(brut.card),
    whatsapp: lienSur(brut.whatsapp),
    sms: lienSur(brut.sms),
    telegram: lienSur(brut.telegram),
    dikalo: lienSur(brut.dikalo),
  };
  return hasAnyLink(links) ? links : null;
}
