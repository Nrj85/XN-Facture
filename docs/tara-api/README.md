# Référence de l'API Tara — copie locale

Ces quatre fichiers ne sont **pas de nous**. Ils viennent du paquet de skill publié par Tara :

```
https://taramoney.com/skills/skills.zip   ->   skills/tara-api-developer/reference/
```

## Pourquoi ils sont versionnés ici

⚠️ **LA SYNCHRONISATION DE LA SKILL LES PERD.** Constaté deux fois, le 6 et le
7 oct. 2026 : le dossier installé
(`~/.claude/skills/synced/…/tara-api-developer/`) ne contient que `SKILL.md`,
jamais son sous-dossier `reference/`. L'archive d'origine, elle, les contient
bien — **c'est la synchronisation qui les abandonne, pas le paquet.** Je m'étais
d'abord trompé en accusant le paquet.

⚠️ **ET LEUR ABSENCE COÛTE CHER.** Le 7 oct. 2026, faute de les avoir lus,
j'ai écrit dans CLAUDE.md, dans un message de commit et en tête de l'Edge
Function qu'une faille exploitable permettait d'activer la formule Entreprise
pour 100 FCFA. **C'était faux**, et une seule phrase de `webhooks.md` suffisait
à le voir :

> Tara envoie un `POST` sur le `webHookUrl` que tu fournis **au moment de
> l'initiation du paiement**.

L'adresse de notification est portée par la **transaction**, pas par le compte :
le lien d'un tiers notifie son propre serveur, jamais le nôtre. Les versionner
ici évite que la prochaine session reparte sans eux et refasse le raisonnement
à l'aveugle.

## Ce qu'ils apprennent, et qu'on ne trouve nulle part ailleurs

| Fichier | Le point qui a compté |
|---|---|
| `endpoints.md` | `POST /transactions/status` rend `{ productId, status, message }` — **aucun montant**. On ne peut donc pas vérifier une somme auprès de Tara |
| `webhooks.md` | Les **trois** formes de charge · `webHookUrl` est porté par la transaction · la charge Mobile Money n'a **ni `productId` ni `amount`** · aucun renvoi automatique |
| `mobile-money.md` | Pays, opérateurs, devises, **formats de numéro par endpoint** (`mobilepay` veut l'indicatif, `cmmobile` non) |
| `pieges.md` | Contradictions de leur propre documentation, et la liste à passer avant mise en production |

## À savoir avant de s'y fier

Ce sont les notes de Tara sur leur propre API, pas une spécification contractuelle.
**Plusieurs points y sont explicitement donnés comme non documentés** — au premier
rang desquels la **signature des webhooks** : ni en-tête, ni algorithme, ni chaîne
canonique. Ne pas l'inventer ; la vérification passe par un rappel de
`POST /transactions/status`.

⚠️ **Deux choses que ces fichiers ne disent PAS et que nous avons mesurées**
(7 oct. 2026, voir CLAUDE.md § « Tara ») : **l'API ne valide pas la clé** — elle
contrôle seulement qu'elle est non vide, le `businessId` étant le seul verrou réel
— et le domaine correct est **`www.dklo.co`**, jamais `dikalo.co`, qui n'a aucun
enregistrement DNS.
