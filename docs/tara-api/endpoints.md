# Contrat des endpoints

Base URL : `https://www.dklo.co/api/tara` — tous les endpoints sont en `POST`, `Content-Type: application/json`, avec `apiKey` + `businessId` dans le body (voir [SKILL.md](../SKILL.md#authentification)).

En plus des champs listés, **chaque** requête porte `apiKey` et `businessId`.

---

## /paymentlinks

Génère un lien de paiement à partager (Tara, Mobile Money, Visa, Mastercard, Wave, PayPal…).

### Requête

| Champ | Type | Requis | Note |
| --- | --- | --- | --- |
| `productId` | string | oui | Identifiant unique du produit. |
| `productName` | string | oui | Nom du produit ou service. |
| `productPrice` | number | oui | Prix en FCFA, **entier**. |
| `productDescription` | string | oui | Description du produit. |
| `webHookUrl` | string | oui | URL HTTPS notifiée du statut de paiement. |
| `productPictureUrl` | string | non | URL de l'image du produit. |
| `returnUrl` | string | non | URL de redirection après paiement. |

```json
{
  "apiKey": "your-api-key",
  "businessId": "business-123",
  "productId": "product-456",
  "productName": "Product name",
  "productPrice": 100,
  "productDescription": "Product description",
  "productPictureUrl": "https://example.com/img.jpg",
  "returnUrl": "https://example.com/return",
  "webHookUrl": "https://example.com/webhook"
}
```

### Réponse — ⚠️ trois formats circulent

Aucune source unique ne fait foi. La doc détaillée, la page développeur et le SDK donnent **trois formes différentes** :

**a) Doc détaillée** (`src/app/components/blocs/DocumentationPaymentLinks.tsx`) :

```json
{
  "status": "success",
  "message": "Link successfully generated",
  "whatsappLink": "https://wa.me/...",
  "telegramLink": "https://t.me/...",
  "dikaloLink": "https://dikalo.me/...",
  "generalLink": "https://taramoney.com/pay/...",
  "cardLink": "https://taramoney.com/card/...",
  "smsLink": "sms:+2376...?body=..."
}
```

**b) Page développeur** (`ApiReferenceSection.tsx`) :

```json
{ "message": "API_ORDER_SUCESSFULL", "status": "SUCCESS", "paymentUrl": "https://taramoney.com/pay/..." }
```

**c) SDK** (`packages/react-sdk/src/types.ts`) : `{ status, paymentLink, reference }` avec `status: "SUCCESS" | "FAILED"`.

**Conséquence pratique :** cherche l'URL de paiement dans `generalLink ?? paymentUrl ?? paymentLink`, et ne te fie pas à la casse de `status` (`success` vs `SUCCESS`). Normalise avant de comparer.

---

## /mobilepay

Encaissement Mobile Money, **14+ pays** (Bénin, Burkina Faso, Cameroun, Congo, Côte d'Ivoire, Gabon, Ghana, Kenya, Rwanda, Sénégal, Sierra Leone, Tanzanie, Ouganda, Zambie). C'est **l'API d'encaissement à utiliser** aujourd'hui.

### Requête

| Champ | Type | Requis | Note |
| --- | --- | --- | --- |
| `productId` | string | oui | Identifiant unique du produit. |
| `productName` | string | oui | Nom du produit ou service. |
| `productPrice` | number | oui | Prix en FCFA, **entier**. |
| `phoneNumber` | string | oui | **Avec indicatif pays** : `2376xxxxxxx`. |
| `webHookUrl` | string | oui | URL HTTPS de notification. |
| `network` | string | non | `"wave"` pour Wave (Sénégal, Burkina Faso, Côte d'Ivoire). |

### Réponse

```json
{ "message": "API_ORDER_SUCESSFULL", "status": "SUCCESS", "vendor": "ORANGE_CAMEROON" }
```

- `status` : `SUCCESS` / `FAILURE`
- `vendor` : `ORANGE_CAMEROON` / `MTN_CAMEROON`

### 🚩 Cas Wave : `authUrl`

Pour un paiement **Wave**, la réponse contient en plus un champ `authUrl` : il faut **rediriger l'utilisateur** vers cette URL pour qu'il valide le paiement Wave est en `REDIRECT_AUTH` ; les autres providers sont en `PROVIDER_AUTH`, sauf Orange Burkina Faso en `PREAUTH` (voir [mobile-money.md](mobile-money.md#providers-supportés)).

```json
{ "authUrl": "{\"url\":\"https://...\"}" }
```

**Piège : `authUrl` est une chaîne JSON, pas un objet.** Le code first-party fait `JSON.parse(authUrl).url` (`src/app/components/PayCollection.tsx:529`). Parse-le défensivement — la valeur peut être soit une string encodée, soit (déjà) un objet selon le chemin d'appel :

```ts
function extractWaveUrl(authUrl: unknown): string | null {
  if (typeof authUrl === 'string') {
    try {
      const parsed = JSON.parse(authUrl)
      return typeof parsed?.url === 'string' ? parsed.url : null
    } catch {
      return null
    }
  }
  if (authUrl && typeof authUrl === 'object' && 'url' in authUrl) {
    return String((authUrl as { url: unknown }).url)
  }
  return null
}
```

---

## /cmmobile

⚠️ **Dépréciée depuis le 1er janvier 2026** — Orange Money & MTN uniquement, Cameroun. N'y démarre rien de nouveau : utilise `/mobilepay`.

Conservée ici pour la maintenance des intégrations existantes. Deux différences avec `/mobilepay` :

- **Pas de champ `network`.**
- **`phoneNumber` est sans indicatif** : `6xxxxxxxx`.

Réponse : identique à `/mobilepay`, plus `ussdCode` (`"#150*50#"` pour Orange Cameroun) que l'utilisateur doit composer.

```json
{
  "message": "API_ORDER_SUCESSFULL",
  "status": "SUCCESS",
  "ussdCode": "#150*50#",
  "vendor": "ORANGE_CAMEROON"
}
```

---

## /useridentity

Retourne l'identité d'un utilisateur depuis son numéro.

> 🇨🇲 **Cameroun uniquement. Facturé 10 XAF par appel.**

| Champ | Type | Requis |
| --- | --- | --- |
| `phoneNumber` | string | oui — format `2376xxxxxxxx` |

```json
{ "firstName": "Jean", "lastName": "Dupont", "vendor": "MTN" }
```

`vendor` = opérateur (`MTN`, `ORANGE`, …).

---

## /transactionlist

Liste paginée des transactions du business.

| Champ | Type | Requis | Note |
| --- | --- | --- | --- |
| `start` | number | non | Offset de pagination (défaut `0`). |
| `size` | number | non | Nombre de résultats par page (défaut `20`). |

**La réponse est un tableau à la racine** (pas d'enveloppe) :

```json
[
  {
    "transactionId": "txn_12345",
    "amount": 5000,
    "currency": "XAF",
    "status": "PENDING",
    "createdAt": "2026-05-11T14:30:00Z"
  },
  {
    "transactionId": "txn_67890",
    "amount": 15000,
    "currency": "XAF",
    "status": "PAID",
    "paidAt": "2026-05-11T10:15:00Z"
  }
]
```

**Les champs varient d'une ligne à l'autre** : `createdAt` sur une transaction en attente, `paidAt` sur une payée. Type `status` de façon tolérante — les valeurs observées ici sont `PENDING` / `PAID`, alors que `/transactions/status` renvoie `SUCCESS` / `FAILURE` / `PENDING` pour la même transaction. **Ne compare jamais un statut à une liste fermée sans fallback.**

---

## /paid/transactionlist

Même requête et même forme de réponse que `/transactionlist`, filtré sur `status: "PAID"`. À utiliser plutôt que de filtrer côté client sur des chaînes instables.

---

## /payout/create

Paiement sortant vers un bénéficiaire.

| Champ | Type | Requis | Note |
| --- | --- | --- | --- |
| `receiverName` | string | oui | Nom du bénéficiaire. |
| `paymentMethod` | string | oui | Voir les valeurs ci-dessous. |
| `receiverPhoneNumber` | string | oui | Format `2376xxxxxxxx`. |
| `receiverId` | string | oui | **Dépend du `paymentMethod`** — voir tableau. |
| `amount` | number | oui | Montant en FCFA. |

### `receiverId` selon la méthode

| `paymentMethod` | `receiverId` attendu |
| --- | --- |
| `MTN_MOBILE_MONEY` | Numéro de téléphone |
| `PAYPAL` | Email du compte PayPal |
| `TARA_BUSINESS` / `TARA_BOT` | Tara ID |
| `BANK_WIRE_TRANSFER` | IBAN |

Badges listés dans l'UI : `PAYPAL`, `BANK_WIRE_TRANSFER`, `MOBILE_MONEY`, `TARA_BUSINESS`, `TARA_PERSON`. L'exemple de la doc utilise `MTN_MOBILE_MONEY`, qui **n'est pas** dans cette liste, et la note parle de `TARA_BOT` quand le badge dit `TARA_PERSON`. Liste d'enum instable : valide la valeur contre l'API avant de la figer en constante applicative.

### Réponse

```json
{ "status": "SUCCESS", "payoutId": "po_987654", "message": "Payout initié avec succès." }
```

`status` : `SUCCESS` / `FAILURE`. Le `message` peut être en français — ne le parse pas.

---

## /mobilemoneypayout

🔒 **Accès restreint** — « This service requires special authorization. Please contact us to get access to this service. » Ne code rien dessus sans autorisation écrite de Tara.

| Champ | Type | Requis | Note |
| --- | --- | --- | --- |
| `amount` | number | oui | Montant en XAF. |
| `phoneNumber` | string | oui | Indicatif Cameroun `237` + numéro : `2376xxxxxxxx`. |

**Aucune forme de réponse succès n'est documentée** — à observer en environnement réel avant d'écrire le parsing.

---

## /transactions/status

Statut courant d'une transaction à partir du `productId`. Les libellés de la doc mentionnent `GET`/`POST`, mais **seule la forme `POST` avec body est spécifiée** : n'invente pas de variante query string.

| Champ | Type | Requis |
| --- | --- | --- |
| `productId` | string | oui — l'ID produit/transaction à vérifier |

```json
{ "productId": "prod_98765", "status": "SUCCESS", "message": "Transaction confirmée." }
```

`status` : `SUCCESS` / `FAILURE` / `PENDING`. C'est **l'appel de vérification à utiliser pour valider un webhook** en l'absence de spec de signature (voir [pieges.md](pieges.md)).

---

## /resend-webhook

Relance l'envoi du webhook d'une transaction précise, en cas d'échec de réception.

| Champ | Type | Requis |
| --- | --- | --- |
| `productId` | string | oui — ID du produit dont il faut renvoyer le webhook |

`{ "apiKey": "...", "businessId": "...", "productId": "prod_12345" }`

**Aucune forme de réponse n'est documentée.** Utile comme filet de sécurité quand ton endpoint était down (Tara ne retente jamais automatiquement).
