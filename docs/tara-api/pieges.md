# Pièges et contradictions de la doc

Ce fichier recense les endroits où **les sources du repo se contredisent** ou ne documentent rien. C'est volontairement brut : ce sont les points sur lesquels une intégration « logique » se casse en production.

## 1. Authentification : body, header, ou les deux ?

| Source | Mécanisme |
| --- | --- |
| Toutes les pages de doc + page développeur | `apiKey` dans le **body**, aucun header d'auth |
| SDK (`packages/react-sdk/src/client.ts:55,65`) | `Authorization: Bearer <apiKey>` **en plus** du `apiKey` dans le body |

Rien ne dit lequel le serveur exige réellement. `x-api-key` n'apparaît nulle part dans le repo.

**→ Envoie les deux.** C'est ce que fait le SDK officiel, donc c'est le comportement le mieux testé, et ça reste correct si le serveur n'en lit qu'un.

## 2. `status` : quatre vocabulaires pour la même idée

| Endpoint | Valeurs vues |
| --- | --- |
| `/mobilepay`, `/cmmobile`, `/payout/create` | `SUCCESS` / `FAILURE` |
| `/transactions/status` | `SUCCESS` / `FAILURE` / `PENDING` |
| `/transactionlist` | `PENDING` / `PAID` |
| SDK `TransactionStatus` | `SUCCESS` / `PENDING` / **`FAILED`** |
| SDK réponse payment link | `SUCCESS` / `FAILED` |
| Doc payment link | `success` (minuscules) |

**→ `FAILURE` vs `FAILED` et `PAID` vs `SUCCESS` désignent le même état selon l'endpoint.** Normalise côté application (`.toUpperCase()`, mapping explicite, fallback sur l'inconnu) — ne compare pas à une liste fermée.

## 3. Réponse de `/paymentlinks` : trois formats

Requête identique, réponses documentées différentes selon la source : `{status, message, whatsappLink, telegramLink, dikaloLink, generalLink, cardLink, smsLink}` (doc) vs `{message: "API_ORDER_SUCESSFULL", status, paymentUrl}` (page développeur) vs `{status, paymentLink, reference}` (SDK). Détail dans [endpoints.md](endpoints.md#paymentlinks).

**→ Lis l'URL de paiement en cascade :** `generalLink ?? paymentUrl ?? paymentLink`.

## 4. `paymentMethod` du payout : enum instable

- Badges UI : `PAYPAL`, `BANK_WIRE_TRANSFER`, `MOBILE_MONEY`, `TARA_BUSINESS`, `TARA_PERSON`
- Note `receiverId` : parle de `TARA_BOT` là où les badges disent `TARA_PERSON`
- Exemple de la doc : `MTN_MOBILE_MONEY`, absent des badges

**→ Ne fige pas cette liste en union TypeScript fermée** sans l'avoir validée contre l'API.

## 5. Formats de numéro incohérents entre endpoints

`2376xxxxxxxx` (avec indicatif) pour `/mobilepay`, `/payout`, `/useridentity`, `/mobilemoneypayout` — mais `6xxxxxxxx` (sans) pour `/cmmobile`. Détail dans [mobile-money.md](mobile-money.md#format-du-numéro-de-téléphone).

## 6. `authUrl` (Wave) est une chaîne JSON

`JSON.parse(authUrl).url`, pas `authUrl.url` (voir `src/app/components/PayCollection.tsx:529`). Détail et helper dans [endpoints.md](endpoints.md#mobilepay).

## 7. `amount` est une string dans les webhooks

`"amount": "100"` — dans **les trois** payloads de webhook. Un `amount: number` dans ton type TS te fera passer à côté (`"100" < 200` est `false` en JS). Parse explicitement.

## 8. Le webhook Mobile Money ne porte ni `productId` ni `amount`

Payload C (7 champs) : impossible de réconcilier une commande depuis le webhook seul. Voir [webhooks.md](webhooks.md#c-mobile-money--7-champs-ni-productid-ni-amount).

## 9. Signature de webhook : secret annoncé, spec absente

Un webhook secret existe côté dashboard et la doc évoque des signatures HMAC, mais **aucun header, algorithme ou chaîne canonique n'est publié**. Ne code pas une vérification inventée. Contournement fiable : rappeler `/transactions/status`. Voir [webhooks.md](webhooks.md#vérifier-lauthenticité--ce-quon-sait-et-ce-quon-ne-sait-pas).

## 10. Ni idempotence, ni retry

Aucun `Idempotency-Key`, aucun champ de déduplication, aucun retry automatique des webhooks. **Le double traitement est à ta charge** : clé unique sur `paymentId`, handler idempotent.

## 11. Réponses non documentées

`/resend-webhook` et `/mobilemoneypayout` n'ont **aucune réponse succès documentée**. Observe-les en réel avant d'écrire le parsing, et prévois un type tolérant.

## 12. Endpoints morts ou dépréciés

- `POST /api/tara/order` → **`410 Gone`**. Remplacé par `/paymentlinks`.
- `/cmmobile` → **dépréciée depuis le 1er janvier 2026**, disponibilité plus garantie. Migrer vers `/mobilepay`.

## 13. `GET` mentionné, `POST` seul spécifié

`/transactionlist`, `/paid/transactionlist` et `/transactions/status` sont étiquetés `GET/POST` (et « Recommended method: GET or POST »), mais **seule la forme POST avec body est documentée**. Aucun paramètre de query n'est spécifié — reste en `POST`.

## 14. Pas de sandbox séparée

Un seul host pour tout. Le couple de clés `productionApiKey` / `sandboxApiKey` existe bien, mais **aucune URL sandbox n'est documentée** : le mode sandbox est configuré côté serveur par business (numéros de test MTN/Orange passés à la création des clés). Les exemples de la doc utilisent d'ailleurs la clé de **production**.

---

# Checklist avant mise en production

- [ ] Clé lue depuis une variable d'environnement, **jamais** dans du code client (elle autorise des payouts).
- [ ] `Content-Type: application/json` + `apiKey` dans le body **et** `Authorization: Bearer`.
- [ ] Test de `data.status`, pas seulement `res.ok` (HTTP 200 peut porter `FAILURE`).
- [ ] Timeout explicite sur chaque appel (le code du repo utilise 60 s) — pas de retry aveugle.
- [ ] Format du numéro adapté à l'endpoint (`2376xxxxxxxx` ou `6xxxxxxxx`).
- [ ] Montants en entiers, devise du pays.
- [ ] Le code d'encaissement lit `generalLink ?? paymentUrl ?? paymentLink`.
- [ ] Le cas Wave (`network: "wave"`) redirige bien vers `JSON.parse(authUrl).url`.
- [ ] Handler de webhook : réponse `2xx` immédiate, traitement asynchrone.
- [ ] Déduplication sur `paymentId` (contrainte d'unicité en base).
- [ ] `amount` des webhooks parsé depuis une string.
- [ ] Handler tolérant aux trois formes de payload (champs optionnels).
- [ ] Confirmation du paiement via `/transactions/status` avant de créditer.
- [ ] Demandé la spec de signature webhook à l'équipe Tara (ou mesure compensatoire en place).
- [ ] Aucune nouvelle dépendance à `/cmmobile` ni à `/api/tara/order`.
- [ ] Accès à `/mobilemoneypayout` confirmé par écrit si utilisé.
