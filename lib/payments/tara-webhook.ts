/**
 * Notifications de paiement Tara — décodage, et vérification auprès de Tara.
 *
 * ⚠️ **ON NE CROIT JAMAIS LA NOTIFICATION. C'est le principe de ce fichier.**
 * Tara engendre bien un « webhook secret » et sa documentation parle de
 * signatures HMAC, mais **ni le nom de l'en-tête, ni l'algorithme, ni la chaîne
 * canonique ne sont publiés**. Écrire une vérification HMAC devinée ne
 * protégerait rien et donnerait une fausse assurance — pire que rien.
 *
 * La notification ne sert donc que de **signal** : elle dit « va regarder ».
 * C'est `verifierPaiement()` qui tranche, par un appel sortant authentifié avec
 * notre clé. Un tiers qui découvrirait l'URL du webhook ne gagne alors rien :
 * il peut nous faire regarder, pas nous faire conclure.
 */

const BASE = 'https://www.dklo.co/api/tara';

/**
 * Ce qu'on retient d'une notification.
 *
 * ⚠️ **TROIS FORMES DE CHARGE CIRCULENT, et AUCUN champ ne dit laquelle.**
 * Seul `status` est commun. Encaissement : 9 champs. Carte : 8, **sans
 * `phoneNumber`**. Mobile Money : 7, **sans `productId` NI `amount`**.
 * D'où des champs optionnels partout, et surtout : ne jamais supposer que
 * `productId` est là.
 */
export type NotificationTara = {
  /** Clé de DÉDUPLICATION. Présente dans les trois formes. */
  paymentId: string;
  /** Notre référence de commande — **absente en Mobile Money**. */
  productId: string | null;
  /**
   * Montant **en entier de FCFA**.
   *
   * ⚠️ **Tara l'envoie en CHAÎNE** (`"100"`, jamais `100`), et il est **absent
   * de la forme Mobile Money**. Le concaténer au lieu de l'additionner serait
   * une faute sur de l'argent : on le convertit ici, une fois.
   */
  amount: number | null;
  /** `SUCCESS` ou `FAILURE` — le seul discriminant des trois formes. */
  statut: 'SUCCESS' | 'FAILURE' | 'AUTRE';
};

/** Une chaîne non vide, ou `null`. Tout le reste du module en dépend. */
function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur.trim() : null;
}

/**
 * Décode une notification, sans rien supposer de sa forme.
 *
 * Rend `null` si `paymentId` manque : sans lui, on ne peut ni dédupliquer ni
 * tracer, donc il n'y a rien à faire de l'événement.
 */
export function lireNotification(corps: unknown): NotificationTara | null {
  if (!corps || typeof corps !== 'object') return null;
  const brut = corps as Record<string, unknown>;

  const paymentId = texte(brut.paymentId);
  if (!paymentId) return null;

  // ⚠️ Comparé SANS tenir compte de la casse : la documentation montre
  // `SUCCESS` en capitales, mais rien ne garantit que ce soit stable, et une
  // comparaison stricte ferait silencieusement échouer une activation.
  const s = texte(brut.status)?.toUpperCase();

  /*
    `amount` arrive en CHAÎNE chez Tara. On accepte malgré tout un nombre :
    le jour où leur format changerait, le refuser enregistrerait `null` au
    journal sur un paiement parfaitement réel — une perte sèche, et silencieuse.

    ⚠️ **Rien d'autre n'est toléré.** Un `NaN` ou un décimal qui remonterait
    jusqu'à un montant stocké serait une faute sur de l'argent, et le FCFA n'a
    pas de centimes (§5). Un montant nul ou négatif n'est pas un encaissement.
  */
  let amount: number | null = null;
  const brutMontant =
    typeof brut.amount === 'number' ? String(brut.amount) : texte(brut.amount);
  if (brutMontant !== null && /^[0-9]+$/.test(brutMontant)) {
    const n = Number(brutMontant);
    if (Number.isSafeInteger(n) && n > 0) amount = n;
  }

  return {
    paymentId,
    productId: texte(brut.productId),
    amount,
    statut: s === 'SUCCESS' ? 'SUCCESS' : s === 'FAILURE' ? 'FAILURE' : 'AUTRE',
  };
}

export type EtatPaiement =
  | { ok: true; statut: 'SUCCESS' | 'FAILURE' | 'PENDING' }
  | { ok: false; reason: string };

/**
 * L'état réel d'un paiement, demandé à Tara.
 *
 * ⚠️ **C'EST LE SEUL AVIS QUI COMPTE.** Il remplace la signature manquante :
 * l'appel part de chez nous, authentifié par notre clé, donc sa réponse n'est
 * pas falsifiable par celui qui a posté la notification.
 *
 * ⚠️ **Seule la forme `POST` avec un corps est spécifiée.** La documentation
 * mentionne `GET` ici ou là — ne pas inventer de variante en chaîne de requête.
 */
export async function verifierPaiement(
  config: { apiKey: string; businessId: string },
  productId: string,
): Promise<EtatPaiement> {
  let reponse: Response;
  try {
    reponse = await fetch(`${BASE}/transactions/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Même raison que dans `tara.ts` : la documentation ne montre que le
        // corps, le SDK officiel ajoute l'en-tête, rien ne tranche.
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        apiKey: config.apiKey,
        businessId: config.businessId,
        productId,
      }),
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

  // ⚠️ Un HTTP 200 peut transporter un échec : Tara le dit dans le corps.
  // Observé en direct sans clé : `{"status":"ERROR","message":"API_KEY_IS_NULL"}`.
  const statut = texte((brut as Record<string, unknown>)?.status)?.toUpperCase();
  if (statut === 'SUCCESS' || statut === 'FAILURE' || statut === 'PENDING') {
    return { ok: true, statut };
  }
  return { ok: false, reason: `refus-${statut ?? 'sans-statut'}` };
}
