# Mentions légales XN-Facture — note de relecture juridique

**Document destiné au juriste chargé de la relecture.** Il accompagne les trois textes publiés
sur le site et signale ce qui doit être vérifié, arbitré ou complété avant l'ouverture
commerciale.

- Mentions légales — `https://www.xn-facture.com/mentions-legales`
- Politique de confidentialité — `https://www.xn-facture.com/confidentialite`
- Conditions générales d'utilisation — `https://www.xn-facture.com/conditions`

Les trois pages portent en tête un encart « document de travail, non validé juridiquement ».
**Il doit être retiré par nos soins une fois votre relecture faite**, et pas avant.

---

## 1. Ce qu'est le service, en une page

XN-Facture est un logiciel de facturation en ligne, vendu par abonnement à des entrepreneurs et
petites structures. Marché principal : **Cameroun et zone CEMAC**.

L'utilisateur y saisit ses clients, émet des factures et des devis en FCFA, et les télécharge en
PDF. Le service **ne manipule aucun flux financier entre l'utilisateur et ses propres clients** :
il produit des documents, il n'encaisse rien pour le compte de personne.

La seule somme qui circule est **l'abonnement que l'utilisateur nous paie**, par mobile money, à
raison de 5 000 FCFA par mois (formule Pro) ou 15 000 FCFA (formule Entreprise), avec un tarif
annuel remisé. Le règlement est aujourd'hui **manuel** : l'utilisateur reçoit une référence de
commande et effectue un transfert ; l'accès est ouvert au paiement constaté.

Une formule gratuite existe, plafonnée à cinq factures émises par mois.

---

## 2. Points appelant une vérification

### 2.1 Mentions obligatoires du commerce électronique

Les champs d'identification de l'éditeur sont laissés en `[à compléter]` : dénomination, forme
juridique, capital, siège, NIU, RCCM, représentant légal, directeur de la publication,
téléphone.

**Questions :**

- La liste est-elle **complète** au regard de la loi camerounaise régissant le commerce
  électronique et de l'Acte uniforme OHADA portant sur le droit commercial général ? Manque-t-il
  une mention (numéro de déclaration ANTIC, autorisation d'exercer, assurance) ?
- La **forme juridique** retenue change-t-elle la liste ? Une entreprise individuelle et une
  SARL n'ont pas les mêmes obligations d'affichage.
- Le **directeur de la publication** doit-il être distinct du représentant légal ?

### 2.2 Localisation des données hors du Cameroun

Les données de facturation des utilisateurs — leurs clients, leurs montants, leur chiffre
d'affaires — **résident en Irlande** (Supabase, région `eu-west-1`). L'application est servie
depuis l'infrastructure de Vercel, société américaine. Les emails transitent par Resend.

**Questions :**

- Ce transfert hors du Cameroun appelle-t-il une **formalité préalable** (déclaration,
  autorisation) ou une **mention d'information** particulière ?
- Le fait que l'utilisateur soit **commerçant**, et que les données concernent son activité
  professionnelle plutôt que sa vie privée, change-t-il l'analyse ?
- Faut-il faire figurer dans les CGU une **clause de consentement explicite** au transfert, ou
  l'information suffit-elle ?

### 2.3 Données comptables et durée de conservation

Une facture est une pièce comptable. Nos utilisateurs sont tenus de conserver les leurs pendant
une durée fixée par la réglementation fiscale.

**Questions :**

- Quelle **durée de conservation** devons-nous annoncer, et sommes-nous tenus à une obligation
  de conservation propre, en tant qu'hébergeur de ces pièces ?
- Que devons-nous faire des données **après résiliation** ? Notre position actuelle est de ne
  jamais fermer l'accès en lecture : à l'expiration d'un abonnement payant, le compte redescend
  en formule gratuite et l'utilisateur continue de consulter et d'exporter tout son historique.
  Cette position est-elle tenable, et suffit-elle ?
- Devons-nous prévoir une **suppression sur demande**, et sous quel délai ? Comment l'articuler
  avec l'obligation de conservation ci-dessus, qui va en sens inverse ?

### 2.4 Mentions légales des factures produites

Le logiciel impose le **NIU** et le **RCCM** de l'utilisateur sur chaque facture émise, et
calcule la TVA au taux paramétré par l'entreprise (19,25 % par défaut).

**Questions :**

- Les mentions imposées par le produit sont-elles **suffisantes** au regard de la
  réglementation fiscale camerounaise ? En manque-t-il (mention du régime d'imposition,
  numérotation, mention d'exonération, centre des impôts de rattachement) ?
- **Quelle est notre responsabilité** si une facture produite par le logiciel se révèle non
  conforme et que l'utilisateur est redressé ? Quelle clause de limitation est admissible, et
  laquelle serait réputée non écrite ?
- Le logiciel doit-il répondre à une exigence de **non-modification des données** ou de piste
  d'audit, comme il en existe ailleurs pour les logiciels de caisse ? Précision utile : **une
  facture déjà envoyée reste modifiable** dans le produit, par choix explicite de l'éditeur.
  Si cela pose un problème de conformité, il faut le savoir maintenant.

### 2.5 Abonnement, paiement et rétractation

⚠️ **Lacune connue, signalée d'emblée : les conditions générales d'utilisation ne comportent
aujourd'hui AUCUNE clause sur l'abonnement** — ni sur le prix, ni sur le paiement, ni sur la
durée, ni sur le renouvellement, ni sur la résiliation. Elles ont été écrites quand le service
était entièrement gratuit. **Il faut donc rédiger ce chapitre**, et les questions ci-dessous
sont celles auxquelles il devra répondre.

- Le paiement est **manuel, par mobile money**, avec activation après constat. Faut-il une
  mention particulière sur les **délais d'activation** et sur le sort d'un paiement reçu sans
  référence identifiable ?
- Un **droit de rétractation** s'applique-t-il ? L'acheteur est un professionnel et le service
  est immédiatement exécuté, ce qui plaide contre, mais la question doit être tranchée.
- Le **tarif annuel remisé** (dix mois payés pour douze) est payé d'avance. Que devons-nous en
  cas de résiliation en cours de période ?
- Faut-il faire figurer les prix **toutes taxes comprises**, et devons-nous facturer la TVA sur
  nos propres abonnements ?

### 2.6 Responsabilité et disponibilité

Le service ne garantit aucun taux de disponibilité chiffré. Il dépend de prestataires tiers dont
nous ne maîtrisons pas les interruptions.

**Questions :**

- Jusqu'où une **clause de limitation de responsabilité** est-elle valable en droit camerounais
  entre professionnels ? Quel plafond est défendable — le montant de l'abonnement, une période
  d'abonnement, autre chose ?
- Devons-nous nous engager sur une **obligation de sauvegarde**, et sur sa fréquence ?

### 2.7 Cookies

Deux cookies seulement, tous deux strictement nécessaires : la session, et le choix de langue.
**Aucun traceur publicitaire, aucune mesure d'audience tierce, aucun profilage.**

**Question :** cette absence complète de traceurs nous dispense-t-elle de tout bandeau de
consentement ?

### 2.8 Propriété des contenus

Notre position, écrite noir sur blanc : les données saisies par l'utilisateur lui appartiennent,
nous n'en acquérons aucun droit, nous ne les revendons pas et ne les communiquons à aucun tiers
en dehors des quatre sous-traitants techniques nommés.

**Question :** la rédaction actuelle est-elle suffisamment ferme pour nous engager utilement, et
suffisamment précise pour ne pas nous interdire des usages légitimes (statistiques agrégées et
anonymes, par exemple, que nous n'exploitons pas aujourd'hui) ?

---

## 3. Ce qui reste à compléter de notre côté

| À faire | État |
|---|---|
| Renseigner les dix champs d'identification de l'éditeur | **en attente de l'immatriculation** |
| Créer et faire relever la boîte `contact@xn-facture.com` | **à faire** — l'adresse est citée dans les trois documents |
| Remplacer les trois témoignages de la page d'accueil | **inventés, à remplacer** — voir ci-dessous |
| Retirer l'encart « non validé juridiquement » | après votre relecture |

⚠️ **Les trois témoignages affichés sur la page d'accueil sont fictifs.** Ils portent des noms et
des villes précises et servent aujourd'hui de simple gabarit de mise en page. Ils seront
remplacés par de vrais avis, ou retirés, avant l'ouverture au public. Nous le signalons parce
qu'ils constitueraient sinon une allégation commerciale trompeuse — et parce qu'ils sont encore
en ligne pendant votre relecture.

---

## 4. Ce que nous ne vous demandons pas de valider

Le **contenu fonctionnel** du produit — l'exactitude des calculs de TVA, la numérotation des
documents, le format des PDF — a été éprouvé de notre côté et ne relève pas de cette relecture,
sauf si une exigence réglementaire s'y attache (voir 2.4).
