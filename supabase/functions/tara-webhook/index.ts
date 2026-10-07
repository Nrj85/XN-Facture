/**
 * Notification de paiement Tara — Edge Function Supabase (Deno).
 *
 * ⚠️ **CE FICHIER N'EST PAS DU CODE NEXT, ET NE TOURNE PAS SUR VERCEL.** Il est
 * exclu de `tsconfig.json` : il s'exécute sur Deno, avec des globales (`Deno`,
 * `serve`) qui n'existent pas dans l'application.
 *
 * ⚠️ **POURQUOI ICI PLUTÔT QUE DANS `app/api/` — la règle du projet.** Une
 * notification n'a **aucune session**, et doit pourtant écrire `subscriptions`,
 * qui n'a **aucune politique d'écriture**. Il faut donc `service_role`, et
 * « Déploiement » interdit de le poser sur Vercel : ce serait une clé qui
 * contourne la RLS, sur un serveur web public. Une Edge Function la détient
 * dans **son propre** environnement, que Vercel ne voit pas.
 *
 * ⚠️ **TROIS GARDES, ET AUCUNE N'EST LA SIGNATURE.** Tara ne publie ni en-tête,
 * ni algorithme, ni chaîne canonique — en inventer une donnerait une fausse
 * assurance. À la place :
 *
 *   1. un **segment secret** dans l'URL, comparé en temps constant ;
 *   2. **on ne croit PAS la notification** : elle n'est qu'un signal. L'état
 *      réel est relu par `POST /transactions/status`, avec NOTRE clé — donc une
 *      réponse qu'un tiers ne peut pas fabriquer ;
 *   3. l'**idempotence** tient sur `unique (provider, provider_reference)` dans
 *      `subscription_payments`. Tara ne garantit aucune unicité et ne rejoue
 *      rien automatiquement : un même message peut arriver deux fois.
 *
 * ⚠️ **L’API TARA NE VALIDE PAS LA CLÉ — mesuré le 7 oct. 2026.** Elle
 * vérifie seulement que `apiKey` est NON VIDE ; le `businessId` est le seul
 * verrou réel. **C’est donc LUI le secret**, et il se pose en « Sensitive »
 * au même titre que la clé.
 *
 * ⚠️ **CORRECTION D’UNE ALERTE SURÉVALUÉE, le même jour.** Ce commentaire a
 * d’abord annoncé une faille exploitable : créer un lien à 100 FCFA portant
 * notre référence de commande, le régler, et voir Entreprise s’activer.
 * **Ce chemin ne fonctionne pas**, et la raison tient en une ligne de la
 * documentation : **`webHookUrl` est fourni à l’INITIATION du paiement,
 * transaction par transaction.** Le lien d’un tiers porte donc SON adresse de
 * notification, pas la nôtre : nous ne sommes jamais prévenus, et rien ne
 * s’active. Atteindre cette fonction exige le secret de 43 caractères de
 * l’URL, que personne d’autre n’a.
 *
 * **Ce qui reste vrai, et que les deux gardes ci-dessous traitent :**
 *
 *   - le montant n’était comparé à RIEN. Nos propres liens sont tarifés par
 *     `priceFor()` côté serveur, donc cohérents — mais une activation qui ne
 *     regarde pas ce qui a été encaissé n’a aucun filet le jour où le secret
 *     fuite, où Tara change de comportement, ou sur un règlement partiel ;
 *   - **le STATUT de la commande n’était pas regardé** : le lien d’une
 *     commande ANNULÉE reste payable, et sa notification activait la formule.
 *     Celui-là était un vrai défaut, sans aucune condition préalable.
 *
 * ⚠️ **`/transactions/status` NE REND AUCUN MONTANT** — vérifié dans la
 * référence de l’API : `{ productId, status, message }`, rien d’autre. Le seul
 * montant disponible est celui de la notification, et **la charge Mobile Money
 * n’en porte aucun**. D’où la règle retenue : un montant présent et INFÉRIEUR
 * au prix fait REFUSER ; un montant absent laisse passer, parce que la
 * notification est arrivée sur notre URL secrète, donc sur un lien que NOUS
 * avons tarifé. Refuser le canal Mobile Money — le plus courant au Cameroun —
 * rendrait l’activation automatique inutile là où elle sert le plus.
 *
 * ⚠️ **DÉPLOIEMENT — `verify_jwt` DOIT ÊTRE DÉSACTIVÉ.** Par défaut Supabase
 * exige un JWT sur une Edge Function : Tara n'en a aucun, et toutes les
 * notifications seraient refusées en 401 **sans que rien ne le signale** chez
 * nous. C'est le piège principal de cette fonction.
 *
 * **Le réglage vit dans `supabase/config.toml`**, pas dans un drapeau :
 *
 *     [functions.tara-webhook]
 *     verify_jwt = false
 *
 * ⚠️ **ET CE N'EST PAS ÉQUIVALENT À `--no-verify-jwt`.** Le drapeau doit être
 * retapé à CHAQUE déploiement : un seul `supabase functions deploy` lancé sans
 * lui remet la vérification, et la panne est silencieuse. Le fichier est
 * versionné, donc le réglage survit à qui déploie et depuis où.
 *
 * Variables attendues dans l'environnement de la fonction :
 * `TARA_API_KEY`, `TARA_BUSINESS_ID`, `TARA_WEBHOOK_SECRET`.
 * `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies par Supabase.
 */

const TARA_BASE = 'https://www.dklo.co/api/tara';

/**
 * Prix attendus — ⚠️ **DUPLICATION SUBIE DE `lib/plans.ts`, comme le
 * décodeur.** Deno ne peut pas importer le module de l’application, et
 * `subscription_orders` ne porte **aucun montant** : délibérément, puisque
 * `start_subscription_order()` est appelable par tout client authentifié et
 * qu'un montant en paramètre permettrait de se commander Pro à 1 FCFA.
 *
 * ⚠️ **TOUT CHANGEMENT DE TARIF DOIT ÊTRE REPORTÉ ICI.** La source reste
 * `lib/plans.ts` ; cette table n’est qu’un garde-fou. Si elle diverge vers le
 * BAS, on accepte un paiement insuffisant ; vers le HAUT, on refuse un
 * paiement légitime — et le second cas se voit (le client se plaint), pas le
 * premier.
 */
const PRIX: Record<string, { monthly: number; yearly: number }> = {
  pro: { monthly: 5000, yearly: 50000 },
  business: { monthly: 15000, yearly: 150000 },
};

/** Le prix attendu, ou `null` pour une formule sans tarif connu. */
function prixAttendu(plan: string, periode: string): number | null {
  const tarif = PRIX[plan];
  if (!tarif) return null;
  return periode === 'yearly' ? tarif.yearly : tarif.monthly;
}

const env = (nom: string): string => (globalThis as never as { Deno: { env: { get(k: string): string | undefined } } }).Deno.env.get(nom) ?? '';

/**
 * Comparaison à **temps constant**.
 *
 * ⚠️ Un `===` sur un secret s'arrête au premier caractère différent : le temps
 * de réponse révèle alors combien de caractères sont bons, et le secret se
 * devine octet par octet. Le coût ici est nul, l'omission ne se voit pas.
 */
function memeSecret(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const texte = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

/**
 * Décodage des **trois** formes de charge.
 *
 * ⚠️ Aucun champ `event` ne les distingue, seul `status` varie. La forme Mobile
 * Money ne porte **ni `productId` ni `amount`** — or `productId` EST notre
 * référence de commande. Sur ce canal, la notification seule ne rapproche
 * aucune commande : on rend `null`, jamais un `0` qui se confondrait avec un
 * montant.
 *
 * ⚠️ **Ce décodage est le jumeau de `lib/payments/tara-webhook.ts`**, qui est
 * éprouvé par 28 contrôles. Deno ne peut pas importer le module de
 * l'application : la duplication est subie, pas choisie. **Toute correction
 * faite à l'un doit être reportée à l'autre.**
 */
function lireNotification(corps: unknown) {
  if (!corps || typeof corps !== 'object') return null;
  const brut = corps as Record<string, unknown>;

  const paymentId = texte(brut.paymentId);
  if (!paymentId) return null;

  let amount: number | null = null;
  const brutMontant = typeof brut.amount === 'number' ? String(brut.amount) : texte(brut.amount);
  if (brutMontant !== null && /^[0-9]+$/.test(brutMontant)) {
    const n = Number(brutMontant);
    if (Number.isSafeInteger(n) && n > 0) amount = n;
  }

  const s = texte(brut.status)?.toUpperCase();
  return {
    paymentId,
    productId: texte(brut.productId),
    amount,
    statut: s === 'SUCCESS' ? 'SUCCESS' : s === 'FAILURE' ? 'FAILURE' : 'AUTRE',
  };
}

/** L'état réel du paiement, demandé à Tara. Le SEUL avis qui compte. */
async function verifierPaiement(productId: string): Promise<string | null> {
  const apiKey = env('TARA_API_KEY');
  const businessId = env('TARA_BUSINESS_ID');
  if (!apiKey || !businessId) return null;

  try {
    const r = await fetch(`${TARA_BASE}/transactions/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ apiKey, businessId, productId }),
      signal: AbortSignal.timeout(15000),
    });
    // ⚠️ HTTP 200 ne veut pas dire succès : Tara annonce l'échec dans le CORPS
    // (`{"status":"ERROR","message":"API_KEY_IS_NULL"}`, observé en direct).
    if (!r.ok) return null;
    const corps = (await r.json()) as { status?: unknown };
    const s = texte(corps?.status)?.toUpperCase();
    return s === 'SUCCESS' || s === 'FAILURE' || s === 'PENDING' ? s : null;
  } catch {
    return null;
  }
}

// --- Accès à la base, en `service_role` --------------------------------------
async function rest(chemin: string, options: RequestInit = {}) {
  const cle = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL')}/rest/v1${chemin}`, {
    ...options,
    headers: {
      apikey: cle,
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}

/**
 * Nouvelle échéance.
 *
 * ⚠️ **ON PROLONGE DEPUIS L'ÉCHÉANCE EN COURS, pas depuis aujourd'hui.**
 * Quelqu'un qui renouvelle une semaine avant le terme perdrait sinon cette
 * semaine — il paierait pour se faire retirer du temps. On part donc de la plus
 * tardive des deux dates.
 *
 * ⚠️ **La date est calculée en `Africa/Douala`**, comme `lib/today.ts`. En UTC,
 * un paiement reçu le soir à Douala daterait du lendemain.
 */
function nouvelleEcheance(actuelle: string | null, periode: string): string {
  const aujourdhui = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Douala' }),
  );
  const depart =
    actuelle && new Date(actuelle) > aujourdhui ? new Date(actuelle) : aujourdhui;

  const fin = new Date(depart);
  if (periode === 'yearly') fin.setFullYear(fin.getFullYear() + 1);
  else fin.setMonth(fin.getMonth() + 1);
  return fin.toISOString().slice(0, 10);
}

export default async function handler(requete: Request): Promise<Response> {
  // ⚠️ **ON RÉPOND TOUJOURS 200 À TARA, même sur refus.** Ils ne retentent
  // jamais : un 4xx ne provoquerait aucun renvoi, il perdrait seulement
  // l'événement. Le détail du refus reste dans le journal de la fonction.
  const ok = (quoi: string) =>
    new Response(JSON.stringify({ recu: true, resultat: quoi }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  if (requete.method !== 'POST') return ok('methode-ignoree');

  // --- Garde 1 : le segment secret de l'URL ---------------------------------
  const attendu = env('TARA_WEBHOOK_SECRET');
  const url = new URL(requete.url);
  const fourni = url.searchParams.get('s') ?? url.pathname.split('/').pop() ?? '';
  // Un secret court ne protège rien — même plancher que `webhookSecret()`.
  if (attendu.length < 24 || !memeSecret(fourni, attendu)) {
    console.warn('tara-webhook : secret refuse');
    return ok('refuse');
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return ok('corps-illisible');
  }

  const note = lireNotification(corps);
  if (!note) {
    console.warn('tara-webhook : charge non decodable');
    return ok('charge-non-decodable');
  }

  // ⚠️ Sans `productId`, aucune commande ne peut être rapprochée — c'est la
  // forme Mobile Money. On le JOURNALISE plutôt que de deviner : un paiement
  // reçu qu'on ne sait pas rattacher doit se voir, pas disparaître.
  if (!note.productId) {
    console.warn(`tara-webhook : paiement ${note.paymentId} SANS productId — a rapprocher a la main`);
    return ok('sans-reference');
  }

  // --- Garde 2 : on ne croit pas la notification ----------------------------
  const etat = await verifierPaiement(note.productId);
  if (etat !== 'SUCCESS') {
    console.warn(`tara-webhook : ${note.productId} verifie -> ${etat ?? 'indisponible'}`);
    return ok(`non-confirme-${etat ?? 'indisponible'}`);
  }

  // --- La commande correspondante -------------------------------------------
  const rc = await rest(
    `/subscription_orders?reference=eq.${encodeURIComponent(note.productId)}&select=id,company_id,plan,period,status`,
  );
  const commandes = (await rc.json()) as Array<{
    id: string;
    company_id: string;
    plan: string;
    period: string;
    status: string;
  }>;
  const commande = commandes?.[0];
  if (!commande) {
    console.warn(`tara-webhook : aucune commande pour ${note.productId}`);
    return ok('commande-introuvable');
  }

  // --- La commande doit être EN ATTENTE --------------------------------------
  // ⚠️ Le lien de paiement d’une commande ANNULÉE reste payable chez Tara :
  // rien, de leur côté, ne le désactive. Sans ce contrôle, régler un vieux lien
  // activait la formule de la commande abandonnée. Une commande déjà « paid »
  // est écartée ici aussi — le doublon serait de toute façon arrêté par
  // l’unicité ci-dessous, mais autant le dire au bon endroit.
  if (commande.status !== 'pending') {
    console.warn(
      `tara-webhook : commande ${note.productId} en etat ${commande.status} — ignoree`,
    );
    return ok(`commande-${commande.status}`);
  }

  // --- Le montant encaissé ---------------------------------------------------
  // ⚠️ **ON NE REFUSE QUE CE QU’ON PEUT PROUVER INSUFFISANT.** La charge Mobile
  // Money ne porte aucun `amount`, et `/transactions/status` n’en rend aucun :
  // exiger un montant vérifié fermerait le canal le plus courant au Cameroun.
  // Un montant ABSENT passe donc — la notification est arrivée sur notre URL
  // secrète, donc sur un lien que nous avons nous-mêmes tarifé. Un montant
  // PRÉSENT et inférieur au prix est en revanche un désaccord qu’on ne doit pas
  // avaler en silence.
  const montantAttendu = prixAttendu(commande.plan, commande.period);
  if (montantAttendu !== null && note.amount !== null && note.amount < montantAttendu) {
    console.error(
      `tara-webhook : ${note.productId} encaisse ${note.amount} pour ${commande.plan}/${commande.period}` +
        ` qui vaut ${montantAttendu} — ACTIVATION REFUSEE, a traiter a la main`,
    );
    return ok('montant-insuffisant');
  }

  // --- Garde 3 : l'idempotence, portée par la BASE ---------------------------
  // ⚠️ `unique (provider, provider_reference)` refuse le doublon. On ÉCRIT le
  // paiement d'abord : si l'insertion est refusée, le message a déjà été traité
  // et on s'arrête là. L'ordre inverse — activer puis journaliser — prolongerait
  // l'abonnement une fois par renvoi.
  const paiement = await rest('/subscription_payments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      company_id: commande.company_id,
      provider: 'tara',
      provider_reference: note.paymentId,
      amount: note.amount,
      plan: commande.plan,
      period: commande.period,
    }),
  });
  if (paiement.status === 409) {
    console.log(`tara-webhook : ${note.paymentId} deja traite`);
    return ok('deja-traite');
  }
  if (!paiement.ok) {
    console.error(`tara-webhook : ecriture du paiement refusee (${paiement.status})`);
    return ok('paiement-non-journalise');
  }

  // --- Activation ------------------------------------------------------------
  const ra = await rest(
    `/subscriptions?company_id=eq.${commande.company_id}&select=expires_at`,
  );
  const abos = (await ra.json()) as Array<{ expires_at: string | null }>;
  const echeance = nouvelleEcheance(abos?.[0]?.expires_at ?? null, commande.period);

  await rest(`/subscriptions?company_id=eq.${commande.company_id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      plan: commande.plan,
      expires_at: echeance,
      // Un paiement vaut reprise : qui règle veut manifestement continuer.
      renewal_declined: false,
    }),
  });

  await rest(`/subscription_orders?id=eq.${commande.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'paid' }),
  });

  console.log(`tara-webhook : ${commande.plan} active jusqu au ${echeance} (${note.productId})`);
  return ok('active');
}
