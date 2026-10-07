# Mobile Money — pays, providers, formats

Référence pour `POST /mobilepay` (les données viennent des tableaux de providers de `src/app/app/api/documentation/mobile/page.tsx`).

## Providers supportés

| Pays | Opérateur | Code provider | Devise | Auth |
| --- | --- | --- | --- | --- |
| Bénin | MTN | `MTN_MOMO_BEN` | XOF | `PROVIDER_AUTH` |
| Bénin | Moov | `MOOV_BEN` | XOF | `PROVIDER_AUTH` |
| Burkina Faso | Moov | `MOOV_BFA` | XOF | `PROVIDER_AUTH` |
| Burkina Faso | Orange | `ORANGE_BFA` | XOF | `PREAUTH` |
| Cameroun | MTN | `MTN_MOMO_CMR` | XAF | `PROVIDER_AUTH` |
| Cameroun | Orange | `ORANGE_CMR` | XAF | `PROVIDER_AUTH` |
| Côte d'Ivoire | MTN | `MTN_MOMO_CIV` | XOF | `PROVIDER_AUTH` |
| Côte d'Ivoire | Orange | `ORANGE_CIV` | XOF | `PROVIDER_AUTH` |
| Côte d'Ivoire | Wave | `WAVE_CIV` | XOF | **`REDIRECT_AUTH`** |
| RD Congo | Vodacom | `VODACOM_MPESA_COD` | CDF | `PROVIDER_AUTH` |
| RD Congo | Airtel | `AIRTEL_COD` | CDF | `PROVIDER_AUTH` |
| RD Congo | Orange | `ORANGE_COD` | CDF | `PROVIDER_AUTH` |
| Gabon | Airtel | `AIRTEL_GAB` | XAF | `PROVIDER_AUTH` |
| Ghana | MTN | `MTN_MOMO_GHA` | GHS | `PROVIDER_AUTH` |
| Ghana | AirtelTigo | `AIRTELTIGO_GHA` | GHS | `PROVIDER_AUTH` |
| Ghana | Vodafone | `VODAFONE_GHA` | GHS | `PROVIDER_AUTH` |
| Kenya | M-Pesa | `MPESA_KEN` | KES | `PROVIDER_AUTH` |
| Congo (Brazzaville) | Airtel | `AIRTEL_COG` | XAF | `PROVIDER_AUTH` |
| Congo (Brazzaville) | MTN | `MTN_MOMO_COG` | XAF | `PROVIDER_AUTH` |
| Rwanda | Airtel | `AIRTEL_RWA` | RWF | `PROVIDER_AUTH` |
| Rwanda | MTN | `MTN_MOMO_RWA` | RWF | `PROVIDER_AUTH` |
| Sénégal | Free | `FREE_SEN` | XOF | `PROVIDER_AUTH` |
| Sénégal | Orange | `ORANGE_SEN` | XOF | `PROVIDER_AUTH` |
| Sénégal | Wave | `WAVE_SEN` | XOF | **`REDIRECT_AUTH`** |
| Sierra Leone | Orange | `ORANGE_SLE` | SLE | `PROVIDER_AUTH` |
| Tanzanie | Airtel | `AIRTEL_TZA` | TZS | `PROVIDER_AUTH` |
| Tanzanie | Vodacom | `VODACOM_TZA` | TZS | `PROVIDER_AUTH` |
| Tanzanie | Tigo | `TIGO_TZA` | TZS | `PROVIDER_AUTH` |
| Tanzanie | Halotel | `HALOTEL_TZA` | TZS | `PROVIDER_AUTH` |
| Ouganda | Airtel | `AIRTEL_OAPI_UGA` | UGX | `PROVIDER_AUTH` |
| Ouganda | MTN | `MTN_MOMO_UGA` | UGX | `PROVIDER_AUTH` |

Le texte de la doc annonce « +14 pays » avec la liste : Bénin, Burkina Faso, Cameroun, Congo (Brazzaville), Congo (Kinshasa), Côte d'Ivoire, Gabon, Ghana, Kenya, Rwanda, Sénégal, Sierra Leone, Ouganda, Tanzanie, Zambie. Des entrées `malawi`, `mozambique`, `nigeria`, `zambia` existent dans les libellés mais **sans tableau de providers** — ne les considère pas comme disponibles sans confirmation.

## Différence `PROVIDER_AUTH` vs `REDIRECT_AUTH`

C'est **la distinction qui change ton code d'intégration** :

- **`PROVIDER_AUTH`** — le paiement part par push USSD / validation directe sur le téléphone. Tu affiches un message d'attente, le webhook te prévient.
- **`REDIRECT_AUTH`** (Wave uniquement, `WAVE_CIV` et `WAVE_SEN`) — tu dois **rediriger l'utilisateur vers une URL**, récupérée dans le champ `authUrl` de la réponse. Voir [endpoints.md](endpoints.md#mobilepay) : `authUrl` est une chaîne JSON à parser, et elle est documentée pour le Sénégal, le Burkina Faso et la Côte d'Ivoire.

Pour déclencher Wave, passe `network: "wave"` dans la requête.

## Format du numéro de téléphone

C'est le piège d'intégration numéro un, car **il change selon l'endpoint** :

| Endpoint | Format | Exemple |
| --- | --- | --- |
| `/mobilepay` | Indicatif pays **obligatoire** | `2376xxxxxxxx` |
| `/payout/create` (`receiverPhoneNumber`) | Indicatif pays | `2376xxxxxxxx` |
| `/mobilemoneypayout` | Indicatif Cameroun `237` **obligatoire** | `2376xxxxxxxx` |
| `/useridentity` | Indicatif pays | `2376xxxxxxxx` |
| `/cmmobile` (legacy) | **Sans** indicatif | `6xxxxxxxx` |

La doc est explicite : `6xxxxxxxx` est **incorrect** pour `/mobilepay`. Aucun format n'est spécifié pour les autres pays que le Cameroun — construis l'indicatif depuis le pays du compte.

## Montants et devises

- Montants en **entier**, dans la devise du pays (XAF au Cameroun, XOF au Sénégal / Côte d'Ivoire / Bénin / Burkina, CDF en RD Congo, GHS au Ghana, KES au Kenya, RWF au Rwanda, SLE en Sierra Leone, TZS en Tanzanie, UGX en Ouganda).
- Pas de décimales, pas de centimes : `productPrice: 100` = 100 FCFA.
- Pour les payouts, la doc ne mentionne que le **XAF** (« The amount is specified in XAF ») — ne généralise pas aux autres devises sans confirmation.

## Page de paiement hébergée

Le lien généré pointe vers `https://taramoney.com/pay/{collectionId}?p={amount}`. Options d'intégration iframe : `accent=ff4400&bg=faf9f7&text=1a1a1a&isFrame=true`. Les paiements carte passent par `https://taramoney.com/card/...`.
