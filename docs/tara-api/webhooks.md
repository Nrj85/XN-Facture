# Webhooks

Tara envoie un `POST` sur le `webHookUrl` que tu fournis **au moment de l'initiation du paiement** (chaque endpoint d'encaissement prend ce champ). L'URL **doit être en HTTPS**.

## Trois payloads différents — et aucun champ `event`

Il n'existe **pas** de champ ni de header identifiant le type d'événement. Le seul discriminant est `status`, et trois formes de payload circulent selon l'origine du paiement. Écris un handler **tolérant** : ne suppose pas que `phoneNumber`, `productId` ou `amount` soient présents.

### A. Encaissement (collects) — 9 champs

```json
{
  "businessId": "sSf40EL07F",
  "paymentId": "2551754489",
  "productId": "6RrUfsvd8g5ktHP4xG",
  "amount": "100",
  "collectionId": "27731",
  "phoneNumber": "611111111",
  "creationDate": "2025-07-02T14:13:53.888+02:00",
  "changeDate": "2025-07-02T14:13:53.088+02:00",
  "status": "SUCCESS"
}
```

| Champ | Note |
| --- | --- |
| `businessId` | Ton business ID. |
| `paymentId` | ID du paiement — **clé de déduplication**. |
| `productId` | ID du produit (le même que celui envoyé à l'initiation). |
| `amount` | Montant payé en FCFA — **string, pas un nombre**. |
| `collectionId` | ID du collecteur utilisé. |
| `phoneNumber` | Numéro utilisé pour payer. |
| `creationDate` / `changeDate` | Création / dernière mise à jour du statut. |
| `status` | `SUCCESS` / `FAILURE`. |

### B. Paiement par carte — 8 champs, **pas de `phoneNumber`**

```json
{
  "businessId": "sSf40EL07F",
  "status": "SUCCESS",
  "amount": "95300",
  "paymentId": "2551754489",
  "productId": "6RrUfsvd8g5ktHP4xG",
  "collectionId": "27731",
  "creationDate": "2025-07-02T14:13:53.888+02:00",
  "changeDate": "2025-07-02T14:13:53.088+02:00"
}
```

### C. Mobile Money — 7 champs, **ni `productId` ni `amount`**

```json
{
  "businessId": "your-businessId",
  "paymentId": "awerSxlerxrfrt-6",
  "collectionId": "456641929164",
  "phoneNumber": "696717597",
  "creationDate": "2025-07-24T15:28:53.678+02:00",
  "changeDate": "2025-07-24T15:28:53.678+02:00",
  "status": "SUCCESS"
}
```

> ⚠️ **Sans `productId` ni `amount` dans le payload C, tu ne peux pas réconcilier le montant depuis le webhook seul.** Si ton flux l'exige, conserve le `productId` → montant côté serveur au moment de l'initiation, et rappelle `/transactions/status` pour confirmer.

## Retry et fiabilité

- **Tara ne retente jamais automatiquement** un webhook échoué. C'est explicite dans la doc : en cas d'échec, il faut relancer manuellement depuis l'onglet « Webhook » du dashboard, ou via l'API.
- **Aucun mécanisme d'idempotence n'existe** (aucun `Idempotency-Key`, aucun champ de déduplication — vérifié dans tout le repo). Un même webhook peut donc arriver plusieurs fois, notamment après un renvoi manuel.

**Implémentation recommandée :**

1. Réponds `2xx` **immédiatement**, puis traite en asynchrone. Un handler lent fait échouer la livraison.
2. Déduplique sur `paymentId` (clé unique en base), pas sur `productId`.
3. Rends le handler tolérant : champs optionnels, `amount` en string à parser, `status` comparé sans supposer la casse.
4. Ne fais pas confiance au webhook pour créditer un compte : **confirme avec `POST /transactions/status`** en rappelant le `productId`.

## Renvoyer un webhook

```bash
curl -X POST https://www.dklo.co/api/tara/resend-webhook \
  -H "Content-Type: application/json" \
  -d '{ "apiKey": "<clé>", "businessId": "<businessId>", "productId": "prod_12345" }'
```

Utile quand ton endpoint était indisponible. Aucune forme de réponse n'est documentée.

## Vérifier l'authenticité — ce qu'on sait et ce qu'on ne sait pas

**Ce qui est établi :** le dashboard permet de générer un **webhook secret** (« Generate new webhook secret », affiché une seule fois pendant 30 s), et les textes produit annoncent des « signatures HMAC pour vérifier l'authenticité des données ».

**Ce qui n'est documenté nulle part :** le **nom du header**, l'**algorithme**, la **chaîne canonique signée**, et les règles anti-rejeu (timestamp/tolérance). Aucun exemple de code de vérification n'existe dans le repo.

**Donc : n'invente pas un header type `X-Tara-Signature` et ne code pas une vérification HMAC « au cas où » — elle échouerait en production.** Deux options sûres :

1. Demander la spec de signature à l'équipe Tara (contact technique), puis l'implémenter.
2. En attendant, vérifier chaque notification en rappelant `POST /transactions/status` avec le `productId`, et n'accepter que `status: "SUCCESS"` — c'est un appel authentifié de ton côté, donc non falsifiable par un tiers.

Complète : restreins le handler aux requêtes provenant de Tara (liste d'IP ou secret partagé dans l'URL du webhook) le temps d'obtenir la spec.
