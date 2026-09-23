# XN-Facture — mémoire du projet

Document de référence unique. Il est chargé à chaque session : **le lire avant de toucher au
code**, et le mettre à jour quand une décision structurante est prise. Les sections 1 à 4
décrivent ce qui existe ; les sections 5 à 8 disent pourquoi c'est ainsi ; la section 9 explique
comment travailler ici.

**Interface en français par défaut, anglais disponible** — voir « Langue de l'interface » en
section 2. Le **code** reste commenté en français, et les **documents PDF restent français**
quelle que soit la langue choisie.

---

## 1. Ce que fait l'application

SaaS de facturation pour **entrepreneurs et petites structures d'Afrique centrale**, avec le
Cameroun et la zone CEMAC comme cible primaire. Il répond à une question quotidienne :
*combien on me doit, depuis combien de temps, et à qui dois-je le rappeler ?*

Trois particularités de ce marché ont façonné le produit et ne sont pas négociables :

- **Le FCFA n'a pas de centimes.** Tout montant est un entier de francs.
- **Les mentions légales sont obligatoires** sur une facture (NIU, RCCM) — elles ne sont pas
  décoratives.
- **Le téléphone est l'appareil principal**, souvent sur un réseau lent. Le responsive n'est
  pas une adaptation de second rang, et le budget JS compte.

### État du projet

Phase 3 **appliquée et éprouvée sur la base réelle**. L'application est full-stack : Supabase
(Postgres + RLS + Auth), lectures en Server Components, écritures en Server Actions. Le store
`localStorage` et `lib/mock-data.ts` ont disparu ; la date du jour n'est plus figée, elle vient
de `lib/today.ts` (fuseau `Africa/Douala`).

Projet Supabase : **`tpzmmgcfpnsysaghdqrx`** (région `eu-west-1`, Postgres 17). Les trois
migrations et le seed y sont appliqués. Ce qui a été **réellement vérifié** (et non supposé) :

| Contrôle | Résultat |
|---|---|
| RLS, deux comptes / deux entreprises, 15 tentatives de contournement | Aucune fuite, aucune écriture croisée |
| Suppression d'un client rattaché | Refusée par la base (`23503`), pas seulement par l'interface |
| Facture émise sans numéro | Refusée par la base (`23514`) |
| 8 appels simultanés à `next_document_number` | 8 numéros distincts |
| Deux factures au même numéro | Refusé (`23505`) |
| Conversion d'un devis deux fois | Refusée par l'index unique partiel |
| Écriture puis **rechargement complet** (facture, statut, client, paramètres) | Donnée relue en base |
| Chiffres du tableau de bord | 25 000 166 / 11 211 550 / 13 788 616, tranches d'ancienneté = reste à encaisser |
| Contrôle chiffré de référence, du formulaire au PDF | 2 110 000 · 406 175 · 2 516 175 |

⚠️ **LES COMPTES DE DÉMONSTRATION N'EXISTENT PLUS — supprimés le 17 sept. 2026.**
`atelier@example.com` (Atelier Nkolo), `concurrent@example.com` et `verif@example.com` ont été
effacés avec leurs entreprises et toutes leurs données, avant l'ouverture au public. Il ne
reste que des comptes réels.

**Conséquence pratique, à connaître avant d'écrire un test :** les chiffres du tableau de bord
cités plus haut (25 000 166 / 11 211 550 / 13 788 616) venaient d'Atelier Nkolo. **Ils ne sont
plus reproductibles en l'état** — `supabase/seed.sql` recrée le jeu de démonstration, mais il
faut le rejouer, et lui rattacher un compte.

⚠️ **Supprimer le compte d'authentification NE SUFFIT PAS.** `company_members.user_id` est en
`on delete cascade`, mais `companies` ne l'est pas : l'entreprise survit, sans aucun membre,
invisible sous RLS et pourtant bien présente. Descendre dans l'ordre des dépendances —
factures, devis, clients, puis l'entreprise, puis le compte. `invoices.client_id` étant en
`on delete restrict`, supprimer l'entreprise d'un bloc peut faire échouer la cascade.

⚠️ **PostgREST renvoie 204 même quand rien n'a été supprimé.** Exiger
`Prefer: return=representation` et compter les lignes rendues, sinon on croit avoir effacé ce
qui est toujours là.

⚠️ **Les entreprises orphelines ont été supprimées elles aussi** (17 sept. 2026) — quatre
résidus de scripts de test dont le compte avait été effacé sans l'entreprise. **État vérifié
après ménage : 4 entreprises, 4 appartenances, 4 comptes, aucune orpheline.**

Phases restantes : **5** envoi par email, lien public, avoirs, relances · **6** page d'accueil
publique · **7** tests de bout en bout, sécurité, déploiement Vercel.

### Ce qui reste à régler côté Supabase

- ~~Aucun SMTP propre~~ — **réglé le 4 sept. 2026 : Resend est branché**, voir « Envoi des
  emails » en section 2. `mailer_autoconfirm` reste à `false`, ce qui est le bon réglage
  maintenant que les emails partent réellement.
- ~~Aucun domaine vérifié chez Resend~~ — **RÉGLÉ le 17 sept. 2026.** `xn-facture.com` est
  `verified`, l'expéditeur est `no-reply@xn-facture.com`, et **`mailer_autoconfirm` est
  repassé à `false`** : les adresses sont de nouveau réellement vérifiées à l'inscription.
  Le contournement du 8 sept. est levé. Détail en « Envoi des emails », section 2.

  Le paragraphe qui suit est conservé **pour mémoire** : il décrit la panne guérie, et le
  symptôme à reconnaître si un jour l'expédition retombe.

  > L'expéditeur d'essai `onboarding@resend.dev` ne délivre qu'à l'adresse propriétaire du
  > compte Resend. Tant que `mailer_autoconfirm` valait `false` **sans domaine vérifié**,
  > Supabase créait le compte, échouait à envoyer l'email de confirmation, et renvoyait un
  > **500** : l'inscription était **impossible pour tout le monde**, avec à l'écran « La
  > demande n'a pas abouti. Vérifiez vos informations » — un message qui accusait la saisie
  > de l'utilisateur. Erreur exacte, en appelant `/auth/v1/signup` en direct :
  >
  > ```
  > 500  unexpected_failure  Error sending confirmation email
  > ```
  >
  > Contournement alors employé : `mailer_autoconfirm = true`. **Ne plus y revenir sans
  > nécessité** — il désactive la vérification des adresses pour tout le monde.

  `translateAuthError` garde son cas dédié : si l'envoi échoue de nouveau, l'utilisateur lit
  une phrase française qui désigne le serveur, et non sa saisie.
- **Supabase refuse les domaines sans enregistrement MX** (`@example.com`, `@xnfacture.cm`) avec
  `email_address_invalid`. Ce n'est pas un défaut de l'application ; inutile de le rediagnostiquer.

### Dettes assumées

- **Logo en `logo_data_url`** : une data URL de ~50 ko relue à chaque lecture d'entreprise.
  Supabase Storage serait meilleur, mais touche l'uploader, l'aperçu et le PDF.
- **Les captures d'écran de la section 9 ne sont pas automatisées** : elles passent par une
  session déjà ouverte, pilotée en CDP.
- **« Partiellement payée » est promis mais jamais affiché.** `StoredStatus` connaît
  `partially_paid`, mais `DisplayStatus` ne le porte pas : `deriveStatus` le replie sur
  `sent` (ou `overdue`). Une facture soldée à moitié garde donc le badge « Envoyée », alors
  que `record-payment-dialog.tsx:79` annonce à l'utilisateur « La facture passera à
  « Partiellement payée » ». Constaté en conditions réelles : base à `partially_paid`,
  montants justes à l'écran (encaissé −1 000 000, reste dû 1 516 175), badge « Envoyée ».
  Le repli est défendable — ce qui compte est le reste dû, et un cinquième badge chargerait
  la liste — mais **la promesse et l'affichage doivent s'accorder**. À trancher : ajouter le
  statut d'affichage, ou corriger le texte du dialogue. Décision utilisateur, non tranchée.

---

## 2. Fonctionnalités implémentées

### Page d'accueil publique — `/`

Point d'entrée du site depuis le 5 sept. 2026. La racine redirigeait vers `/dashboard` ;
elle porte désormais la landing, et `'/'` a rejoint les `PUBLIC_PATHS` du middleware.

⚠️ **Ajouter `'/'` à cette liste n'ouvre que la racine.** `isPublic` teste `pathname === path`
puis `startsWith(path + '/')` — soit `'//'`, qui ne correspond à aucun chemin réel. Vérifié :
`/dashboard`, `/factures`, `/devis`, `/clients`, `/parametres`, `/paiements` redirigent
toujours vers `/connexion?suite=`.

**La page est STATIQUE**, **1,83 ko de JS** — seuls l'en-tête et le retour en haut sont des
composants clients. C'est délibéré : la première page que voit un prospect sur un réseau lent
ne doit rien attendre.

⚠️ **Ce chiffre était 1,42 ko avant le 19 sept. 2026** : le bouton de retour en haut a coûté
**410 octets**. Toute addition future doit être pesée de la même façon — `npm run build` donne
la taille route par route, et **c'est le seul juge**. Un composant client de plus sur cette
page n'est pas gratuit.

**Elle n'utilise pas Tailwind mais des modules CSS.** C'est le seul endroit du projet dans ce
cas, et c'était une demande explicite. La landing a des compositions longues, des dégradés et
des animations d'ambiance que des attributs `class` rendraient illisibles. Les jetons sont
**recopiés** de `tailwind.config.ts` dans `app/(marketing)/marketing.css` — un module CSS ne
peut pas lire le thème Tailwind. **Toute modification d'une couleur doit donc être répercutée
aux deux endroits.** C'est le coût de la séparation, et il est borné à cette liste de jetons.

- Composants dans `components/marketing/`, chacun avec son `.module.css`.
- `Section`, `InfoCardGrid` et `CtaButton` sont les trois briques réutilisées partout :
  les sections « défis », « fonctionnalités » et « étapes » sont la **même** grille, et tous
  les boutons de la page sont le **même** composant.
- **Palette de l'application, pas celle de la maquette fournie.** La maquette proposait un
  fond bleuté `#f6faff` ; une landing froide suivie d'une app crème se lit comme deux
  produits. Structure et sections de la maquette : conservées telles quelles.
- **Polices déjà auto-hébergées** (Archivo + Inter). Charger Plus Jakarta Sans depuis Google
  aurait cassé la règle du build hermétique de la section 3.
- **Icônes lucide et non Material Symbols** : cela évite une police externe sur un réseau lent.
- Les chiffres de la maquette d'aperçu sont ceux du **contrôle chiffré de référence**
  (2 110 000 · 406 175 · 2 516 175). Inventer des montants aurait affiché une TVA fausse sur
  la page qui vend justement le calcul de la TVA.
- ⚠️ **Les trois témoignages sont des exemples de mise en page, pas de vrais clients.** À
  remplacer avant l'ouverture au public : des avis inventés sous des noms et des villes
  précises seraient un mensonge, pas une maquette.

**Apparition au défilement** (`marketing/reveal.tsx`). La maquette d'aperçu se construit
morceau par morceau quand elle entre dans l'écran : barre du navigateur, formulaire de gauche,
puis document de droite — l'ordre raconte le geste réel, on saisit à gauche et le document se
compose à droite.

- **Un seul `IntersectionObserver` par groupe.** Les enfants marqués `data-reveal` s'échelonnent
  ensuite par `transition-delay: calc(var(--reveal-index) * 70ms)`. Un observateur par élément
  n'aurait rien apporté.
- **L'observation s'arrête au premier passage** : rejouer l'animation à chaque aller-retour de
  molette donnerait une page qui clignote — c'est le défaut le plus courant du procédé.
- ⚠️ **Le contenu est masqué par CSS avant l'exécution du script**, pour éviter le clignotement
  « visible → caché → révélé ». Un échec du script laisserait donc la maquette invisible : deux
  filets couvrent ce risque, `@media (scripting: none)` et le repli du composant quand
  `IntersectionObserver` n'existe pas.
- ⚠️ **§6.6 proscrit l'apparition au défilement — pour l'APPLICATION.** Cette mécanique est
  réservée à la landing, et ne doit pas franchir la frontière.

**Animations.** La landing s'autorise plus de mouvement que l'application — ce n'est pas un
écran où l'on manipule de l'argent. Le plafond de 240 ms de la section 6.6 reste tenu pour
tout ce qui **répond à une action** ; seules les animations d'ambiance (flottement, halo,
lueur) sont longues, et toutes sont coupées par `prefers-reduced-motion`.

⚠️ **Piège CSS rencontré :** `.base:active` et `.primary:hover` ont la même spécificité (une
classe + une pseudo-classe) — c'est l'ordre du fichier qui départage. Placée avant le survol,
la règle d'enfoncement était écrasée et le bouton ne redescendait jamais. Constaté en forçant
`:active` par CDP `CSS.forcePseudoState`, pas supposé.

#### Retour en haut — `marketing/back-to-top.tsx` (19 sept. 2026)

La landing fait plusieurs écrans, et les trois pages légales sont de longs textes : arrivé en
bas, rien ne ramenait au début. L'en-tête est collant mais ne sert qu'à naviguer.

⚠️ **Posé dans la COQUILLE `(marketing)/layout.tsx`**, donc présent sur la landing **et** sur
les trois pages légales. Le besoin y est identique, et un seul exemplaire évite quatre copies
qui auraient divergé.

⚠️ **Le seuil est UNE HAUTEUR D'ÉCRAN**, pas un nombre de pixels.
`window.scrollY > window.innerHeight` se règle tout seul du téléphone au grand moniteur, là où
un seuil fixe serait juste sur l'un et faux sur l'autre. **Vérifié : caché à un écran moins
50 px, visible au-delà.**

⚠️ **`visibility: hidden`, et non `opacity: 0` seule.** L'opacité laisse l'élément dans l'ordre
de tabulation : on tabulerait sur un bouton invisible. `visibility` l'en sort, et elle est
retardée à la fin de la transition pour que la disparition reste visible — d'où le
`transition: … visibility 0s linear 200ms`, remis à `0s` sur l'état visible. `tabIndex` et
`aria-hidden` suivent l'état.

⚠️ **LE CLIC DÉPLACE LE FOCUS, pas seulement la page.** Sans cela il resterait sur un bouton
devenu invisible : au clavier on repartirait du bas, et un lecteur d'écran continuerait
d'annoncer le pied de page. Il est posé sur l'ancre `#haut` — un `div` de hauteur nulle en
`tabIndex={-1}`, au tout début de la coquille. **Vérifié : `document.activeElement.id` vaut
bien `haut` après le clic.**

⚠️ **Défilement instantané sous `prefers-reduced-motion`**, et plus aucun déplacement ni mise
à l'échelle. Un défilement animé sur toute la hauteur d'une page est précisément ce que ce
réglage vise. **Vérifié en forçant le média par CDP `Emulation.setEmulatedMedia`.**

⚠️ **La marge suit `--gutter`** — 16 px sur téléphone, 24 px puis 32 px plus haut : le bouton
respire comme le reste de la page au lieu de porter une valeur en dur. `env(safe-area-inset-*)`
par-dessus, sinon il se pose sur la barre de gestes des iPhone.

44 × 44 px — au-dessus du plancher de 36 px du §6.5, et la cible tactile confortable au pouce,
là où il sert le plus.

**Vérifié à l'écran (16 contrôles)** : absent de la vue et hors tabulation en haut · apparaît
passé le seuil, `tabIndex` à 0 · toujours là au pied de page · le clic remonte à 0 et emmène le
focus · le bouton s'efface ensuite de lui-même · mouvement réduit : aucun déplacement, remontée
en moins de 250 ms · présent et visible sur les trois pages légales · sur 500 px : visible,
44 × 44, marge de 16 px.

### Tableau de bord — `/dashboard`
Quatre cartes de statistiques (Factures émises · Montant facturé · Montant encaissé · Reste à
encaisser), un panneau d'**ancienneté de créance** en barre empilée à quatre tranches
(à échoir, 1–30 j, 31–60 j, +60 j), et les dernières factures.
*Contrôle croisé permanent : la somme des quatre tranches doit égaler le reste à encaisser.*

**Filtres : période et recherche** (`dashboard-filters.tsx`). Période par préréglages —
depuis le début, ce mois-ci, le mois dernier, 3 derniers mois, cette année — plus une plage
personnalisée à deux `DatePicker`. Recherche par nom de client ou numéro.

- **Les deux filtrent l'écran entier**, cartes et panneau d'ancienneté compris, pas seulement
  la liste du bas. Filtrer la liste seule afficherait deux vérités contradictoires sur la même
  page. Une ligne sous les filtres dit ce que couvrent les chiffres, sans quoi des totaux
  partiels se lisent comme ceux de l'entreprise entière. Le contrôle croisé continue de
  tenir : tout est calculé sur le même sous-ensemble.
- **La période porte sur la date d'ÉMISSION**, pas l'échéance : c'est elle qui rattache une
  facture à un exercice.
- **Les bornes couvrent la période entière**, pas « jusqu'à aujourd'hui » : une facture datée
  du 30 septembre doit apparaître dans « Ce mois-ci » dès le 5.
- **L'état vit dans le composant, pas dans l'URL.** Le porter en `?periode=` imposerait
  `useSearchParams`, donc un `<Suspense>` : le tableau de bord ne serait plus rendu qu'après
  hydratation — cf. `/connexion`, dont le HTML statique est vide pour cette raison. Sur réseau
  lent, le coût dépasse le bénéfice d'un lien partageable.
- **Le filtrage se fait sur les données déjà chargées.** La page reçoit déjà toutes les
  factures ; une requête par frappe coûterait bien plus que le tri local.
- `lib/period.ts` porte l'arithmétique des bornes (`Date.UTC`, comme `lib/format.ts`).
  Éprouvée sur 19 cas : bascule d'année, février bissextile, 31 mars → février.
- `matchesQuery` (`lib/invoices.ts`) est l'**unique** prédicat de recherche, partagé avec
  `/factures` pour que les deux ne puissent pas diverger.

**Menu d'actions ⋯ par ligne** (`invoice-row-actions.tsx`) : ouvrir, télécharger le PDF,
transitions de statut, supprimer.

- Le panneau passe par `ui/action-menu.tsx`, **rendu en portail**. `Popover` aurait été rogné
  par le `overflow-x-auto` du tableau — c'est la raison d'être de la règle « rien ne flotte »
  de la section 7.3, que ce portail lève proprement.
- **Les transitions ne sont pas réécrites** : elles viennent de `invoice-status-actions.ts`,
  la même table que la page de détail. Deux copies auraient fini par diverger sur des
  opérations qui attribuent un numéro ou soldent un encaissement.
- Confirmation de suppression et saisie d'encaissement vivent dans la liste, en **un seul
  exemplaire** : une modale par ligne en monterait sept.

### Factures — `/factures`
- **Liste** : filtres par statut avec compteurs, recherche par client ou numéro, bascule en
  cartes sous `md`, états vides distincts (aucune facture / aucun résultat).
- **Actions rapides** par ligne : action contextuelle (envoyer un brouillon, encaisser),
  modifier, télécharger le PDF, supprimer avec confirmation.
- **Création / modification** (`/nouvelle`, `/[id]/modifier`) : client, dates, lignes
  dynamiques, TVA automatique, et **aperçu du document en temps réel** calculé par le même
  moteur que l'enregistrement.
- **Détail** (`/[id]`) : lignes, totaux, encaissements, aperçu, menu de statut, PDF, édition,
  suppression.
- **Statuts** : brouillon → envoyée → partiellement payée → payée, plus annulée.
  « En retard » est **dérivé**, jamais stocké.
- **Encaissements partiels** : le montant se saisit, le statut en découle.
- **Numérotation** `FAC-AAAA-NNNN`, attribuée **à l'envoi** — un brouillon ne consomme pas de
  numéro, ce qui évite les trous dans la séquence.

### Devis — `/devis`
Même squelette que les factures, avec trois différences de fond : une **date de validité** au
lieu d'une échéance, une séquence de numérotation **distincte** (`DEV-AAAA-NNNN`), et aucune
coordonnée de règlement sur le document — rien n'est encore dû.
- Statuts : brouillon → envoyé → accepté / refusé, plus les dérivés **expiré** et **facturé**.
- **Conversion en facture** en un clic, une seule fois.
- Trois statistiques en tête : en attente de réponse, devis remportés, **taux de
  transformation** (affiché `—` tant qu'aucun devis n'a été tranché).

### Clients — `/clients`
Liste avec recherche, ajout et modification en modale (nom, contact, email, téléphone, adresse,
ville). **La suppression est refusée** si le client porte des factures ou des devis, avec le
décompte exact : supprimer en cascade détruirait de la comptabilité.

### Préférences personnelles — nom et langue

Carte séparée du formulaire d'entreprise, dans **Paramètres** (`settings/personal-form.tsx`).
Elle porte les deux réglages qui appartiennent à la personne au clavier et non à la société :
son nom affiché, et la langue de son interface. Les mêler aux réglages d'entreprise aurait
laissé croire qu'on renomme ses collègues ou qu'on change leur langue.

#### Nom du titulaire du compte

**Il n'y avait aucun moyen de le changer, jusqu'au 9 sept. 2026.** `full_name` était écrit une
seule fois, à l'inscription (`lib/actions/auth.ts`), puis relu à chaque session pour alimenter
la barre latérale et le « Bonjour … » du tableau de bord. Une faute de frappe à l'inscription
était donc définitive. `updateUser` n'existait qu'une fois dans tout le projet, pour le mot de
passe. Corrigé par `lib/actions/account.ts` → `updateDisplayNameAction`.

⚠️ **Ne pas confondre avec le nom de l'ENTREPRISE.** Ce sont deux champs distincts, dans deux
cartes distinctes : le nom commercial et la raison sociale vivent dans `companies` et signent
les factures ; celui-ci vit dans `user_metadata` et ne quitte jamais l'écran. Deux associés
d'une même société ont deux noms — les confondre aurait fait renommer l'un en renommant
l'autre. **Le nom d'entreprise était et reste modifiable** : vérifié dans le navigateur et
contre la base, ce n'était pas là que se trouvait le défaut.

⚠️ **`Session` porte DEUX champs de nom, et il faut le bon.** `displayName` retombe sur
l'email quand aucun nom n'est enregistré — juste pour AFFICHER, faux pour ÉDITER : le
formulaire aurait préchargé une adresse email dans « Votre nom », et le premier enregistrement
l'aurait gravée comme nom. `fullName` est le nom réellement enregistré, **vide s'il ne l'est
pas**. C'est lui que reçoit le formulaire, et lui qui décide si le bouton est actif.

⚠️ **Le nom a un bouton, la langue n'en a pas — c'est voulu.** La langue s'applique au choix :
une seule valeur, réversible d'un clic, dont le résultat est immédiatement visible. Un nom se
tape lettre par lettre : l'enregistrer à chaque frappe écrirait une fois par caractère et
afficherait « Jea » dans la barre latérale.

⚠️ **`user_metadata` est modifiable par son propriétaire, par construction.** Sans conséquence
ici : chacun ne change que son propre nom d'affichage, et ce champ ne sert à aucune décision
d'autorisation. **Ne jamais y ranger quoi que ce soit qui accorde un droit.**

**Vérifié de bout en bout**, et non supposé : saisie → confirmation à l'écran en ~3 s →
**rechargement complet** de `/parametres`, champ relu depuis la base → reconnexion en session
neuve, barre latérale « Josue Rengou », avatar « JR », salutation « Bonjour Josue » (elle
affichait auparavant `verif@example....`) → nom vide refusé, et la salutation reste intacte
après la tentative → bascule en anglais, « Your name » / « Save ».

#### Sécurité et connexion — `settings/security-form.tsx` (15 sept. 2026)

Carte **distincte** des préférences personnelles : le nom et la langue sont du confort, ceci
touche à l'accès au compte. Les mêler aurait mis un champ de mot de passe à côté d'un
sélecteur de langue.

Ni l'adresse ni le mot de passe n'étaient modifiables : l'adresse était figée à l'inscription,
et le mot de passe ne se changeait qu'en se **déconnectant** pour passer par « mot de passe
oublié » — pour une opération qu'on veut faire depuis son compte.

⚠️ **L'ANCIEN mot de passe est exigé par NOUS, pas par Supabase.**
`security_update_password_require_reauthentication` vaut `false` sur ce projet : **vérifié en
conditions réelles, un `PUT /auth/v1/user` avec le seul jeton passe en 200**. Quelqu'un qui
trouve un navigateur déverrouillé prend donc le compte et en verrouille le titulaire dehors.
`updatePasswordAction` revalide en tentant une connexion avec l'ancien mot de passe — seule
façon de le contrôler, Supabase ne stockant qu'une empreinte. Un échec de cette tentative ne
touche pas la session en cours.

⚠️ **Le message de refus dit « Mot de passe actuel incorrect », jamais celui de Supabase.**
Le sien serait « Invalid login credentials », qui laisse croire que l'email est en cause.

⚠️ **LE CHANGEMENT D'ADRESSE ÉCHOUE POUR TOUT LE MONDE, aujourd'hui.** Erreur exacte, relevée
le 15 sept. 2026 :

```
500  unexpected_failure  "Error sending email change email"
```

**Même cause que l'échec d'inscription** : aucun domaine n'est vérifié chez Resend, et
l'expéditeur d'essai ne délivre qu'au propriétaire du compte. Ce n'est PAS un défaut de
`updateEmailAction` : le jour où un domaine est vérifié, elle fonctionne sans changer une
ligne. `translateAuthError` porte un cas dédié — placé **avant** le cas générique d'envoi, qui
parlerait sinon de création de compte à quelqu'un qui change d'adresse.

`mailer_secure_email_change_enabled` vaut `true` : Supabase écrit à l'ANCIENNE **et** à la
NOUVELLE adresse, les deux liens doivent être suivis. C'est ce qui rend inutile de demander le
mot de passe ici — un intrus sur une session ouverte n'a pas l'ancienne boîte.

⚠️ **`translateAuthError` a quitté `lib/actions/auth.ts` pour `lib/auth-errors.ts`.** Un module
`'use server'` ne peut exporter que des fonctions **asynchrones** ; celle-ci est synchrone et
deux modules d'actions en ont besoin.

**Vérifié de bout en bout** : saisies divergentes refusées avant tout appel · mauvais mot de
passe actuel refusé, **et l'ancien fonctionne toujours** · nouveau trop court refusé ·
changement légitime → connexion au nouveau, ancien refusé, **les trois champs vidés** ·
changement d'adresse → message français expliquant que c'est le serveur, adresse inchangée en
base.

⚠️ **Piège de test :** `/parametres` porte **deux** champs `input[type=email]` — celui des
coordonnées de l'ENTREPRISE et celui de la carte Sécurité. Un `querySelector('input[type=email]')`
attrape le premier, laisse le second vide, et le bouton reste désactivé : le test conclut à un
bug là où l'application a raison. Cibler par le formulaire conteneur.

#### Langue de l'interface

Sélecteur dans la même carte que le nom. Français par défaut, anglais disponible.

- **Préférence PERSONNELLE, pas réglage d'entreprise.** Deux associés partagent la même
  société sans forcément lire la même langue : le choix vit dans un cookie (`xn-langue`), pas
  dans la table `companies`. Aucune migration, rien à synchroniser.
- **Les documents ne suivent PAS.** Factures et devis restent en français : ce sont des pièces
  comptables camerounaises portant des mentions (NIU, RCCM) sans équivalent traduit. Décision
  prise avec l'utilisateur — ne pas la rouvrir sans lui demander. Le sélecteur le dit à
  l'écran, pour éviter la question « pourquoi ma facture est-elle encore en français ? ».
- **Les routes restent françaises** (`/factures`, `/devis`). Les traduire casserait tous les
  liens déjà partagés.

**Architecture.** `lib/i18n/` : `fr.ts` est la référence, `en.ts` est typé `typeof fr` — une
clé manquante fait échouer `tsc`. `dictionaries.ts` est utilisable des deux côtés,
`index.ts` porte les fonctions serveur, `context.tsx` le `useT()` des composants clients.

⚠️ **Trois pièges déjà payés :**
- **Pas de `as const` sur `fr.ts`.** Il fige chaque chaîne en type littéral, et `'Dashboard'`
  n'est alors pas assignable au type `'Tableau de bord'`. Sans lui, la vérification porte sur
  la forme — c'est ce qu'on veut.
- **`context.tsx` ne doit importer que `dictionaries.ts`.** Passer par `index.ts` tire
  `next/headers` dans le bundle client : « You're importing a component that needs
  next/headers », et l'erreur désigne l'importateur, pas le fautif.
- **`lang` est posé sur la coquille applicative, pas sur `<html>`.** La racine est partagée
  avec la landing, qui est STATIQUE : y lire le cookie rendrait toute la page dynamique.

**Ce qui est traduit** : navigation, fil d'Ariane, statuts, tableau de bord entier (cartes,
encours, tranches, filtres, liste, menu ⋯), libellés d'échéance, paramètres.
**Ce qui ne l'est pas encore** : `/factures`, `/devis`, `/clients`, les pages de détail, les
écrans d'authentification, les dialogues, et les messages d'erreur des Server Actions.

### Paramètres — `/parametres`
Quatre sections — Identité (dont téléversement du logo, redimensionné à 256 px avant stockage),
Coordonnées, Facturation (devise, taux de TVA, délai de règlement, préfixe, mention par
défaut), Encaissement (banque, compte, MTN MoMo, Orange Money). Suivi des modifications non
enregistrées, validation, réinitialisation. Tout se répercute immédiatement sur les nouveaux
documents ; **les documents existants gardent leur propre taux de TVA**.

Ces quatre sections décrivent l'ENTREPRISE et sont partagées par l'équipe. La carte
« Préférences personnelles » qui les suit n'appartient qu'à la personne au clavier — voir
plus haut.

### Abonnements — `/abonnement` (9 sept. 2026, PARTIEL)

Monétisation de XN-Facture **par XN-Facture**, à ne pas confondre avec l'encaissement des
factures de nos utilisateurs auprès de leurs clients. Nous vendons notre propre service, sur
notre propre compte marchand : **aucune question d'agrément COBAC**, et à 5 000 / 15 000 FCFA
les plafonds mobile money ne mordent pas.

**Trois formules, définies UNE SEULE FOIS dans `lib/plans.ts`** — Découverte (gratuit),
Pro (5 000/mois), Entreprise (15 000/mois). Elles n'existaient que dans le composant marketing,
en dur ; l'application en avait besoin de son côté, et deux copies auraient fini par annoncer
un prix sur la page d'accueil et en réclamer un autre à la caisse.

#### Ce qui marche

- **Chaque bouton de la grille porte sa formule** — `/inscription?plan=pro`. Les trois
  pointaient vers `/inscription` tout court : « Choisir Pro » et « Créer mon compte » menaient
  au même endroit, et le choix était perdu à la seconde où on cliquait.
- L'inscription **annonce la formule choisie** et l'enregistre dans `subscriptions.requested`.
- `/abonnement` montre l'état réel : formule active, échéance, formule demandée, journal.

#### Le plafond de Découverte — APPLIQUÉ (migration 0007)

**5 factures émises par mois**, tenu par le déclencheur `invoices_quota`.

- **Un brouillon ne consomme rien**, exactement comme il ne consomme pas de numéro. Le
  plafond ne mord qu'au passage à l'état émis.
- **Le mois est celui de la DATE D'ÉMISSION**, pas de `now()` — sinon une facture antidatée
  tomberait dans le mauvais mois, en désaccord avec le tableau de bord et les filtres.
- **Modifier une facture déjà émise reste libre** : la bloquer serait revenir en douce sur une
  décision verrouillée (§8).
- **Les devis restent illimités**, comme la grille tarifaire le promet.
- **Un abonnement expiré retombe en Découverte, sans rien fermer** : lecture, export PDF et
  devis restent ouverts. Les factures d'un entrepreneur sont sa comptabilité.

⚠️ **Le contrôle est dans la BASE, pas dans les Server Actions.** `invoices_insert` et
`invoices_update` laissent tout membre écrire ses factures : un contrôle applicatif se
sauterait d'un `PATCH /invoices?id=eq.…` avec `status=sent`. Un plafond qu'on saute en une
commande curl n'est pas un plafond.

⚠️ **Le message d'erreur du déclencheur est écrit EN FRANÇAIS, pour être lu à l'écran.**
`describeDbError` a un cas `P0001` qui le relaie tel quel — c'est voulu. Toute nouvelle
exception `raise` de ce type doit donc être rédigée comme un texte d'interface.

#### La fenêtre de plafond — `components/subscription/plan-limit.tsx`

Le refus s'affichait en bandeau rouge, **sans le moindre lien vers la suite** : l'utilisateur
apprenait que sa formule était épuisée au milieu d'un formulaire qu'il venait de remplir, et
il ne lui restait qu'à fermer l'onglet. Un refus qui n'ouvre aucun chemin est un cul-de-sac.
Une modale le remplace, avec ce que la formule Pro apporte et un bouton vers `/abonnement`.

- **Un seul exemplaire**, monté dans `app/(app)/layout.tsx` et piloté par contexte
  (`usePlanLimit()`). Cinq écrans peuvent la déclencher — formulaire de création, page de
  détail, actions rapides de la liste, menu ⋯ du tableau de bord, dialogue d'encaissement —
  et cinq copies auraient divergé au premier ajustement de texte.
- **La saisie n'est pas perdue** : la fenêtre s'ouvre par-dessus le formulaire, qui reste en
  place avec son contenu. Vérifié.
- Elle ne décide rien : le refus vient du déclencheur. La fermer ne débloque rien.

⚠️ **Le refus est reconnu par `hint`, jamais par le texte du message.** La migration 0008
ajoute `hint = 'plan-limit'` au `raise`, et `failFromDb()` (`lib/actions/result.ts`) le traduit
en `reason: 'plan-limit'` sur l'`ActionResult`. Comparer des chaînes aurait cassé à la première
reformulation. `errcode` ne pouvait pas servir : PostgREST traduit `P0001` en 400, un SQLSTATE
inventé retomberait en 500.

⚠️ **Le plafond chiffré n'apparaît QUE dans le message venu de la base.** La fenêtre ne le
répète pas depuis `lib/plans.ts` : deux sources auraient fini par annoncer un plafond que la
base n'applique pas.

⚠️ **Une enveloppe `run` typée `{ ok: boolean; error?: string }` PERD `reason` en silence.**
C'est exactement ce qui est arrivé à `invoice-status-actions.ts` : la forme structurelle
compilait, mais l'appelant ne pouvait plus distinguer un plafond d'une panne. Ces enveloppes
prennent `ActionResult<unknown>`, pas une forme approchante.

⚠️ **La règle d'expiration existe en DEUX exemplaires** : `effectivePlan()` (`lib/plans.ts`)
pour l'affichage, `enforce_invoice_quota()` (0007) pour l'appliquer. **Modifier l'une oblige à
modifier l'autre**, sinon l'écran annonce « Pro » pendant que la base refuse.

**Vérifié contre la base réelle**, et non supposé : 8 brouillons acceptés malgré le plafond ·
5 émises acceptées, la 6ᵉ refusée · `PATCH` sur une facture déjà émise accepté · brouillon →
envoyée refusé aussi (pas seulement l'`INSERT`) · plafond levé en formule Pro · plafond
retrouvé quand l'abonnement est expiré, **lecture et devis toujours ouverts**. Puis, par le
vrai chemin applicatif : clic sur « Envoyer » → message du déclencheur affiché en `role=alert`
→ facture toujours brouillon, `number` toujours `null` en base.

#### Commander une formule — `subscription_orders` (migration 0009)

La grille montrait les trois formules **sans aucun bouton pour en prendre une** : la fenêtre de
plafond y menait, et le parcours s'arrêtait là. `PlanChooser` porte désormais le choix
mensuel / annuel et un bouton par formule payante ; `OrderSummary` affiche la commande, sa
référence et les instructions de règlement.

**Le règlement est mobile money MANUEL**, pas un débit : aucun agrégateur n'est branché. On
commande, on reçoit une référence, on envoie l'argent, la formule s'ouvre au paiement constaté.
C'est ainsi que démarrent la plupart des SaaS de la zone, et l'agrégateur remplacera l'étape
de constat sans rien jeter du reste.

⚠️ **Une commande n'est PAS un paiement**, d'où deux tables. `subscription_payments`
journalise de l'argent réellement encaissé ; `subscription_orders` note une intention. Les
confondre aurait fait figurer au journal des sommes jamais reçues.

⚠️ **La commande ne porte AUCUN montant**, et c'est à la fois une règle de cohérence et une
protection. Le prix vit dans `lib/plans.ts` ; le figer en base en ferait une seconde vérité.
Et comme `start_subscription_order()` est appelable directement par tout client authentifié,
un montant en paramètre aurait permis de se commander la formule Pro à 1 FCFA. Elle ne prend
que `plan` et `period`, tous deux revalidés contre une liste fermée.

⚠️ **Aucune politique d'écriture sur `subscription_orders`**, comme partout ailleurs ici. Une
politique d'`update` aurait permis de faire passer sa propre commande en « payée ».

⚠️ **Un index unique partiel** (`where status = 'pending'`) garantit une seule commande en
attente par entreprise : la référence affichée est LA référence à rappeler. Recliquer le même
choix rend la **même** référence — elle ne doit pas changer sous les yeux de quelqu'un qui la
recopie sur son téléphone.

⚠️ **Référence hexadécimale** (`XN-PRO-A3F91C`) : l'alphabet 0-9A-F ne contient ni O ni I,
donc rien à confondre avec un zéro ou un un à la recopie.

⚠️ **LA COMMANDE S'AFFICHE AU-DESSUS DE LA GRILLE — IL FAUT DONC Y EMMENER.**
Piège d'ergonomie payé le 17 sept. 2026, et remonté par l'utilisateur en ces termes : « ça ne
redirige vers rien… c'est statique et ça ne bouge pas ». La commande **était** créée, avec sa
référence et les numéros mobile money ; simplement, elle apparaissait **hors de l'écran**, au
-dessus du bouton qu'on venait de cliquer en bas de page. Du siège de l'utilisateur, le clic
n'avait rien produit.

Le placement reste le bon — la référence est l'information la plus utile de la page. C'est la
**transition** qui manquait :

- la carte porte `id="commande"`, `tabIndex={-1}` et `scroll-mt-20` (80 px : la barre
  supérieure est collante et haute de 56 px, sans quoi la carte arrive dessous) ;
- `PlanChooser` y défile après une commande réussie, et **y pose le focus** — sans ce focus, un
  lecteur d'écran continue d'annoncer la grille, et le correctif ne vaudrait que pour ceux qui
  voient ;
- le défilement est **instantané** sous `prefers-reduced-motion`.

⚠️ **`router.refresh()` NE REND PAS DE PROMESSE.** Au moment où il revient, le serveur n'a rien
re-rendu et `#commande` n'existe pas encore : il faut guetter son apparition, avec une limite.

⚠️ **Le bouton de la formule déjà commandée n'est PLUS désactivé.** Il affichait « Commande en
attente » et ne faisait rien — un contrôle mort (§6.1), et la seule chose à l'écran qui
répondait au clic. Il dit désormais **« Voir ma commande »** et y ramène.

⚠️ **Piège de test associé : ne pas comparer `scrollY` avant/après.** La carte est **insérée**
au-dessus de la grille, ce qui décale tout le document : un défilement parfaitement correct
fait donc *augmenter* `scrollY`. Mesurer la position de la carte **dans l'écran**
(`getBoundingClientRect().top`), pas celle du document. Mon assertion inverse a crié au bug là
où le rendu était juste.

#### L'écran de commande doit proposer une ACTION (17 sept. 2026)

Deuxième remontée de l'utilisateur sur le même écran : « le numéro apparaît bien mais aucun
bouton ne redirige vers un moyen de paiement, c'est statique et il n'y a pas d'action à
mener ».

⚠️ **Un bouton « Payer » NE PEUT PAS exister tant qu'aucun lien de paiement n'est branché.**
Ce serait le contrôle mort par excellence (§6.1). Ce qu'on peut offrir aujourd'hui, et qui
répond au vrai besoin :

- **Un bouton « Copier » sur la référence et sur chaque numéro.** Le règlement se termine dans
  une AUTRE application, celle de l'opérateur, où il faut retaper neuf chiffres. Chaque
  caractère retapé est une occasion de se tromper de destinataire, **et une somme envoyée au
  mauvais numéro ne se rattrape pas**. Ce n'est donc pas du confort.
- **Une marche à suivre numérotée en trois temps**, et non un paragraphe : l'écran se lit d'une
  main pendant qu'on manipule son téléphone de l'autre.

⚠️ **L'échec de copie est DIT, jamais avalé.** L'API du presse-papiers exige un contexte
sécurisé et peut être refusée : le bouton affiche alors « Copie refusée », et la valeur est
lue à voix haute pour les lecteurs d'écran — sans quoi la personne reste sans recours.

⚠️ **Le bouton d'annulation est passé de `ghost` à `secondary`.** En `ghost` il n'avait ni
bordure ni fond : il se lisait comme une phrase, et rien ne disait qu'on pouvait cliquer
dessus. Il garde `secondary` et non primaire — ce n'est pas l'action qu'on attend de cet
écran, seulement celle dont il ne faut pas priver — et **pas de ton `danger`** : rien n'est
détruit, la commande se repasse d'un clic. Un filet l'écarte des instructions, sinon on le
clique par erreur en suivant la marche à suivre.

⚠️ **PIÈGE DE TEST — `element.click()` ne produit PAS d'activation utilisateur**, et l'API du
presse-papiers l'exige. Un test qui clique ainsi observe un refus du navigateur et conclut à
tort que le bouton ne marche pas. Passer par CDP `Input.dispatchMouseEvent`
(`mousePressed` + `mouseReleased` au centre de l'élément), et accorder
`clipboardReadWrite` par `Browser.grantPermissions`.

**Vérifié à l'écran** : trois étapes numérotées · trois boutons « Copier » (référence + deux
canaux) · **la référence et le numéro réellement présents dans le presse-papiers** après un
vrai clic · le libellé passe à « Copié » puis revient à « Copier » · le bouton d'annulation
porte une bordure, un fond, 36 px de haut (§6.5) et un filet le sépare.

⚠️ **Les coordonnées d'encaissement viennent de l'ENVIRONNEMENT** (`lib/billing-config.ts` :
`XN_MOMO_MTN`, `XN_MOMO_ORANGE`, `XN_PAYMENT_HOLDER`, `XN_BILLING_EMAIL`), **jamais du code**.
Un numéro vers lequel des gens envoient de l'argent n'a rien à faire dans un dépôt public, et
une faute de frappe versée mille fois ne se rattrape pas. **Tant qu'aucun n'est renseigné,
aucune instruction de paiement n'est affichée** — un faux numéro serait bien pire qu'une
absence. À ne pas confondre avec `companies.momo_mtn`, qui est le numéro de CHAQUE entreprise
cliente, imprimé sur SES factures.

#### Tara (Dikalo) — liens de paiement (migration 0010)

`POST https://www.dikalo.co/api/tara/paymentlinks` rend **six liens** pour un même règlement :
général, carte, WhatsApp, SMS, Telegram, Dikalo. Au Cameroun cette variété compte autant que le
paiement lui-même — tout le monde n'a pas la même application.

**La correspondance est directe** : `productId` = **notre référence de commande** (unique par
construction, donc elle sert d'ancre d'idempotence) · `productPrice` = `priceFor()` calculé
**côté serveur** · `returnUrl` = `/abonnement?commande=<ref>` · `webHookUrl` = notre route
gardée par un secret.

⚠️ **Appel SERVEUR uniquement.** La clé transite dans le CORPS de la requête : la poser dans
un composant client la publierait. Jamais de préfixe `NEXT_PUBLIC_`.

⚠️ **Un échec de Tara ne fait JAMAIS échouer la commande.** Elle existe déjà avec sa
référence ; refuser laisserait l'utilisateur devant une erreur alors que le règlement manuel
reste ouvert. Sans lien, l'écran retombe sur les coordonnées mobile money, puis sur le repli
« nous revenons vers vous ». Délai de 15 s sur l'appel : un prestataire lent ne doit pas figer
la Server Action.

⚠️ **LES LIENS SONT FILTRÉS PAR SCHÉMA, et c'est indispensable.** Ils viennent d'une API tierce
et finissent dans un `href` : un `javascript:` renvoyé par un serveur détourné s'exécuterait au
clic. Seuls `https:`, `sms:`, `tg:`, `whatsapp:` passent — à l'écriture **et** à la relecture
(`lienSur`, `readStoredLinks`). Un `http:` nu est écarté aussi. **Vérifié avec un lot piégé :
le `javascript:` et le `http://` ne sont rendus nulle part dans la page.**

⚠️ **Le retour de `returnUrl` ne CONCLUT rien.** Revenir sur la page ne prouve pas que le
règlement a abouti ; annoncer un succès non constaté serait démenti par la formule toujours
fermée. Le message est affiché seulement si la référence de l'URL correspond à la commande
réellement en attente.

**Ce que la documentation de Tara NE dit PAS — à demander avant d'activer automatiquement :**

1. **Le contenu du webhook** — quels champs, quelles valeurs de statut.
2. **Comment prouver qu'un appel vient de Tara** — signature, en-tête secret, liste d'IP.
   Sans ça, l'URL du webhook est un sésame : qui la découvre s'offre la formule Pro.
3. **Un point de vérification** pour interroger l'état d'un paiement plutôt que de croire ce
   qu'on reçoit.

En attendant, `TARA_WEBHOOK_SECRET` (24 caractères minimum) forme un segment imprévisible dans
l'URL de notification. **Ce n'est PAS l'équivalent d'une signature** et ne prétend pas l'être :
c'est ce qu'on peut faire sans la coopération du prestataire.

**Variables d'environnement** : `TARA_API_KEY`, `TARA_BUSINESS_ID`, `TARA_WEBHOOK_SECRET`.
Tant qu'elles sont vides, aucun appel n'est fait et le parcours manuel reste en place.

⚠️ `siteOrigin()` a quitté `lib/actions/auth.ts` pour `lib/site-origin.ts` : deux copies en
auraient divergé. Elle privilégie `NEXT_PUBLIC_SITE_URL` parce que les en-têtes viennent du
client — un `Host` falsifié détournerait l'adresse du webhook vers un serveur choisi par
l'attaquant.

**Activation après paiement — à la main, par la console SQL :**

```sql
update public.subscriptions
set plan = 'pro', expires_at = current_date + interval '1 month'
where company_id = (select company_id from public.subscription_orders
                    where reference = 'XN-PRO-A3F91C');
update public.subscription_orders set status = 'paid' where reference = 'XN-PRO-A3F91C';
```

**Vérifié contre la base réelle** : commander la formule gratuite refusé · période fantaisiste
refusée · `INSERT` direct d'une commande « payée » refusé (403) · recliquer rend la même
référence · changer de formule en crée une nouvelle et annule l'ancienne · une seule en attente
· se marquer « payée » soi-même : 0 ligne · `DELETE` de ses commandes : 0 ligne · **la formule
reste Découverte après commande**. Et à l'écran, sur 500 px : boutons présents, prix qui suit
la période, référence affichée, instructions présentes quand un canal est configuré et repli
honnête sinon, annulation qui rend le bouton « Choisir ».

#### ⚠️ Ce qui n'existe PAS encore — ne pas le croire

- **`maxMembers` n'est pas appliqué.** Rien n'empêche une sixième personne de rejoindre une
  entreprise. À faire avant de vendre la formule Entreprise sur cet argument.
- **Aucun débit automatique.** Pas d'agrégateur, pas de webhook : l'activation est manuelle.
- ~~Aucune relance avant échéance~~ — **FAIT le 17 sept. 2026**, migration 0011. Voir
  « Relance avant échéance » ci-dessous.

#### Badges de la barre latérale — `layout/account-badge.tsx` (17 sept. 2026)

Deux badges au pied de la barre latérale : **Admin** et la **formule payante**.

⚠️ **DEUX badges, parce que ce sont DEUX attributs distincts.** La formule appartient à
l'**ENTREPRISE** — elle s'applique à toute l'équipe, et deux associés ne peuvent pas être l'un
en Pro et l'autre en Découverte. Le rôle d'administrateur appartient à la **PERSONNE**
(`platform_admins` est indexée par `user_id`). Les fondre en un seul aurait laissé croire que
la formule se règle par utilisateur.

⚠️ **Le badge d'administrateur ne vaut PAS un badge de formule, et ne le remplace jamais.**
Être administrateur ne lève aucun plafond : `invoices_quota` s'applique à l'entreprise sans
exception pour qui que ce soit. Afficher « Pro » à un administrateur dont l'entreprise est en
Découverte serait un mensonge que la base démentirait à la sixième facture du mois.

⚠️ **Le plan affiché est le plan EFFECTIF**, résolu par `effectivePlan()` dans
`app/(app)/layout.tsx`. Passer `subscriptions.plan` brut mettrait un badge « Pro » sur un
abonnement expiré — la divergence exacte contre laquelle cette section met en garde.
**Vérifié : à J+1 après l'échéance, le badge de formule disparaît et seul Admin demeure.**

⚠️ **Rien n'est affiché en Découverte** : c'est l'état par défaut, un badge n'y apprendrait
rien et occuperait une place rare.

⚠️ **PIÈGE DE MISE EN PAGE DÉJÀ PAYÉ — les badges ont leur PROPRE rangée.** Posés à côté des
noms, ils prenaient la place dans une barre de 248 px : « Josue Rengou » devenait « Josu… » et
« Atelier Badge » devenait « At… ». **Constaté en capture d'écran, pas supposé** — et c'est
précisément ce que les trois commandes de vérification ne montrent jamais. Un badge qui rend le
nom illisible coûte plus qu'il n'apporte. `pl-12` aligne la rangée sous le texte (36 px
d'avatar + 12 px d'écart).

**Vérifié à l'écran (14 contrôles)** : Pro seul · le libellé suit la formule (Entreprise) ·
Admin apparaît **automatiquement** sans remplacer celui de la formule · **abonnement expiré →
plus de badge de formule, Admin demeure** · Découverte → aucun badge · dans le **tiroir mobile
à 500 px** : tiroir réellement ouvert, deux badges visibles, **ni le nom ni l'entreprise
tronqués** avec « Atelier Nkolo Mobile ».

⚠️ **Piège de test associé :** interroger `querySelectorAll` depuis le document entier trouve
la barre latérale **masquée** (`hidden lg:block`) et fait croire que le tiroir est correct. Il
faut filtrer sur la visibilité réelle (`getBoundingClientRect`), et vérifier que le tiroir s'est
bien ouvert avant de conclure. Le libellé du bouton du tiroir est en `sr-only`, pas en
`aria-label`.

#### Ne pas renouveler — migration 0013 (17 sept. 2026)

⚠️ **LE MOT « RÉSILIER » EST ÉVITÉ PARTOUT, et ce n'est pas de la coquetterie.**
Le mobile money ne sait pas prélever : **il n'existe aucun débit récurrent à
interrompre**. Un bouton « Résilier mon abonnement » laisserait croire à un arrêt immédiat, et
l'accès qui continue jusqu'à l'échéance passerait pour un dysfonctionnement — ou pour un
prélèvement qu'on n'a pas su arrêter. Le bouton dit donc **« Je ne souhaite pas renouveler »**.

Ce que la déclaration fait **réellement** — sans quoi ce serait un contrôle mort (§6.1) :

1. **les relances J-7 et J-1 cessent** — réclamer un paiement à qui a dit non est du
   harcèlement ;
2. **l'écran annonce la date de fin** au lieu de proposer le renouvellement.

⚠️ **`expires_at` N'EST PAS TOUCHÉE.** Ce qui est payé reste dû : quelqu'un qui a réglé douze
mois d'avance et renonce au mois suivant garde son accès jusqu'au terme. Avancer l'échéance
reviendrait à lui reprendre son argent.

⚠️ **La relance J-0 est CONSERVÉE**, même après refus. Elle ne réclame rien : elle constate le
retour en Découverte et rassure sur ce qui est gardé. La supprimer ferait découvrir le plafond
de cinq factures au milieu d'une saisie.

⚠️ **`set_renewal_intent(p_renew)` ne prend PAS d'identifiant d'entreprise**, exactement comme
`request_plan` : elle agit sur celle de l'appelant, il n'y a rien à falsifier. C'est ce qui
permet d'ouvrir cette écriture alors que `subscriptions` n'a **aucune politique d'écriture**.

⚠️ **Le bouton n'est pas en ton `danger` et n'est pas mis en avant.** Rien n'est détruit, et la
décision se défait d'un clic ; un bouton rouge dramatiserait un geste réversible.

**Vérifié contre la base réelle et à l'écran (19 contrôles)** : relance J-7 normale avant ·
déclaration acceptée et enregistrée · **formule toujours Pro et échéance inchangée** · J-7 et
J-1 supprimées · **J-0 envoyée quand même** · retour en arrière accepté, relances reprises ·
refus sur Découverte avec un message **français** lisible à l'écran · `PATCH` direct de
`renewal_declined` et `expires_at` → **0 ligne** · à l'écran sur 500 px : bouton présent et
neutre, confirmation qui explique et dit la réversibilité, état « ne sera pas renouvelée » avec
la date, bouton de reprise.

#### Relance avant échéance — migration 0011 (17 sept. 2026)

Le mobile money ne sait pas prélever : chaque renouvellement est un paiement **manuel**, que
rien ne déclenche. Sans relance, un abonné perdait sa formule un matin sans avoir rien décidé.
**Trois messages** partent désormais : **J-7**, **J-1**, et **J-0**.

⚠️ **TOUT VIT DANS LA BASE, et c'est la conséquence directe d'une règle du projet.** Un
traitement périodique n'a **pas de session** et doit pourtant lire les abonnements de *toutes*
les entreprises. Le faire depuis l'application imposerait `SUPABASE_SERVICE_ROLE_KEY` sur
Vercel — ce que « Déploiement » interdit. Donc : **`pg_cron`** déclenche depuis Postgres,
**`pg_net`** appelle Resend, et la clé d'API dort dans **`vault`**, chiffrée. Aucun secret ne
quitte la base, et Vercel garde ses trois seules variables.

⚠️ **LA CLÉ RESEND N'EST PAS DANS LA MIGRATION**, et ne doit jamais y être — ce dépôt est
public. Elle est déposée à part :

```sql
select vault.create_secret('<la clé>', 'resend_api_key', 'Clé d''API Resend — relances');
```

Sans elle, `send_expiry_reminders()` **n'envoie rien, ne marque rien**, et le signale en
`warning`. Elle ne tombe pas : un déploiement sans coffre ne casse pas la base.

⚠️ **L'idempotence tient sur un index unique `(company_id, kind, expires_at)`**, pas sur du
code. La tâche tourne tous les jours et rien n'empêche qu'elle tourne deux fois. **On RÉSERVE
la ligne avant d'envoyer** : l'insertion sert de verrou, donc deux exécutions simultanées ne
peuvent pas produire deux messages. L'ordre inverse — envoyer puis marquer — enverrait deux
fois au moindre incident entre les deux.

⚠️ **`expires_at` fait partie de la clé**, et c'est ce qui rend le renouvellement gratuit à
gérer : dès que l'échéance change, la nouvelle période porte ses propres relances. Rien à
purger, aucune tâche de nettoyage.

⚠️ **Aucun PRIX dans le SQL.** Le message nomme la formule mais ne chiffre rien : le montant
vit dans `lib/plans.ts`, source unique. L'inscrire aussi en base en ferait une seconde vérité,
et une relance annoncerait un jour un tarif que la caisse ne pratique plus. Le message renvoie
vers `/abonnement`, où le prix est celui qui sera réellement demandé.

⚠️ **Le message J-0 doit RASSURER.** La règle du projet est de redescendre en Découverte,
jamais de fermer — les factures d'un entrepreneur sont sa comptabilité. Le texte dit
explicitement que rien n'est perdu, que tout reste consultable et exportable, et que seule
l'émission redevient plafonnée. Un message alarmant ferait croire à une perte de données qui
n'a pas lieu.

⚠️ **La date est calculée en `Africa/Douala`**, comme `lib/today.ts`. En UTC, la relance
« demain » serait partie le jour même pour qui vit à Douala.

⚠️ **`pg_net` est ASYNCHRONE** : il rend un identifiant, la réponse arrive plus tard dans
`net._http_response`. La fonction ne peut donc pas savoir si l'envoi a abouti. D'où la vue
`subscription_reminders_status`, qui rapproche les deux — sans elle, un échec d'acheminement
serait invisible.

⚠️ **`subscription_reminders` n'a AUCUNE politique d'écriture**, comme partout ici. Lecture
réservée aux administrateurs de plateforme. Une politique d'insertion permettrait à un client
de se déclarer « déjà relancé » et de supprimer ses propres rappels.

**Ne déclenchent PAS de relance**, et c'est vérifié : une formule Découverte · un abonnement
sans échéance · une échéance à J-3 ou tout autre jalon · un abonnement **déjà expiré** depuis
plusieurs jours — relancer au bout de cinq jours ne serait plus une relance, ce serait du
harcèlement · **un abonnement dont le titulaire a déclaré ne pas renouveler** (J-7 et J-1
seulement ; le J-0 part quand même — voir 0013 ci-dessus).

⚠️ **La migration 0013 REMPLACE `send_expiry_reminders()` en entier**, pour une seule ligne de
`where`. C'est le prix de `create or replace` sur une fonction PL/pgSQL : il n'existe pas de
modification partielle. **Toute évolution ultérieure doit repartir de la version de 0013, pas
de celle de 0011** — sinon on réintroduit les relances à quelqu'un qui a dit non.

**Vérifié contre la base réelle, 15 contrôles** : une relance à J-7 · **aucun doublon au
second passage** · J-1 et J-0 distinctes · les quatre cas qui ne doivent rien déclencher ·
retour à la même échéance sans nouveau message · **les trois emails réellement livrés**, sujets
français portant le nom de la formule · **la base constate un HTTP 200 pour chacun** via la vue
· tâche `relances-abonnement` planifiée à `0 7 * * *` et active · relances effacées en cascade
avec l'entreprise.

#### Tarification annuelle — décidée le 14 sept. 2026

**Pro 50 000 FCFA/an, Entreprise 150 000 FCFA/an : dix mois payés pour douze.** Ce n'est pas
une promotion décorative. Le mobile money ne sait pas prélever automatiquement, donc chaque
renouvellement est un paiement **manuel** qui peut ne pas venir : douze occasions de perdre un
client par an contre une seule. La remise coûte moins cher que l'attrition qu'elle évite, et
elle encaisse d'avance.

⚠️ **L'annuel n'est PAS sur la page d'accueil**, seulement dans `lib/plans.ts` et sur
`/abonnement`. Le porter sur la grille publique est une décision commerciale : à valider avec
l'utilisateur avant.

#### ⚠️ Pourquoi la formule n'est PAS une colonne de `companies`

`companies_update` (0003_rls.sql) autorise un membre à modifier **n'importe quelle colonne**
de son entreprise. Une colonne `plan` y aurait été modifiable par son titulaire : un `PATCH`
REST suffisait à s'offrir Pro. Elle vit donc dans `subscriptions`, **sans aucune politique
d'écriture** — même protection que `platform_admins`.

Le seul écrit ouvert au client est `request_plan(p_plan)`, `security definer`, qui n'écrit que
`requested` et **ne prend pas d'identifiant d'entreprise** : elle agit sur celle de l'appelant,
il n'y a rien à falsifier. `requested` n'accorde rien.

**Six tentatives d'élévation, toutes repoussées** (vérifié, pas supposé) : `PATCH plan=pro`
→ 0 ligne · `PATCH expires_at=2099` → 0 ligne · `INSERT` d'une formule → 403 · `INSERT` d'un
faux paiement → 403 · `DELETE` de sa formule → **0 ligne supprimée** · `request_plan('gratuit-
a-vie')` → 400. Après quoi la formule vaut toujours `discovery`.

⚠️ Le `DELETE` renvoie **204 même quand la RLS n'a rien laissé passer** : c'est le
comportement normal de PostgREST, et non une suppression réussie. Pour trancher, exiger
`Prefer: return=representation` et compter les lignes rendues.

#### Le mur qui vient : le webhook

Un webhook de paiement n'a **pas de session** et doit pourtant écrire. Or `service_role` ne
doit pas aller sur Vercel (voir « Déploiement »). La sortie est une **Edge Function Supabase**,
qui détient la clé dans son propre environnement. Elle vérifiera la signature du prestataire,
puis écrira `subscriptions.plan` et `expires_at`.

⚠️ **L'idempotence tient sur `unique (provider, provider_reference)`**, dans
`subscription_payments` — pas dans le code applicatif. Un webhook est rejoué.

⚠️ **Le mobile money ne sait pas prélever automatiquement.** L'abonnement est donc à
renouvellement **manuel** : une période payée, un accès jusqu'à une date, une relance avant
échéance (Resend est déjà branché). À l'expiration, **redescendre en Découverte, jamais
fermer** : les factures d'un entrepreneur sont sa comptabilité.

**Prestataires pour le Cameroun** : prendre un agrégateur (CamPay, Fapshi, Monetbil, Tranzak,
CinetPay) plutôt que les API MTN et Orange séparément — un seul contrat, un seul format.
Ordre de grandeur des frais : 1,5 à 2,5 %, soit 100 FCFA sur un abonnement Pro.

⚠️ **`/inscription` est devenue DYNAMIQUE** (elle était statique). Elle lit `?plan=` côté
serveur. C'est délibéré, et meilleur que l'alternative : `useSearchParams` aurait imposé un
`<Suspense>`, et le formulaire n'aurait plus existé qu'après hydratation — exactement ce qui
vide le HTML statique de `/connexion`.

### Espace administrateur de plateforme — `/admin`

Vue transversale de **toutes les entreprises**, en **lecture seule** : chiffres de la
plateforme, liste des entreprises avec leurs volumes, comptes avec dernière connexion, et
journal d'activité.

**L'accès est appliqué par la BASE, pas par l'interface.** Migration `0004_admin.sql` :
table `platform_admins`, fonction `is_platform_admin()`, et **huit politiques
`*_admin_select` AJOUTÉES** — aucune politique existante n'est modifiée. Trois raisons, toutes
importantes :

- l'isolation entre entreprises reste exactement ce qu'elle était, et une relecture du fichier
  montre d'un coup d'œil ce qui a été ajouté ;
- `invoice_items_all` et `quote_items_all` sont des politiques `for all` : y glisser
  `or is_platform_admin()` aurait ouvert **l'écriture** en même temps que la lecture ;
- aucune politique d'insertion, de mise à jour ou de suppression n'est accordée à un
  administrateur. **La clé `service_role` reste inutilisée** et absente de Vercel.

**Vérifié après migration** : un compte ordinaire ne voit toujours qu'une entreprise, un
client, une facture et trois lignes ; il ne voit pas la liste des administrateurs ; ses
écritures croisées touchent zéro ligne ; l'écriture dans le journal et l'auto-promotion sont
refusées en 403.

#### Export CSV des entreprises (17 sept. 2026)

Bouton « Exporter tout (CSV) » dans l'en-tête de la carte Entreprises, pour les campagnes de
prospection. Route `GET /api/admin/entreprises/export`, composition dans
`lib/admin/company-export.ts`.

⚠️ **C'est une LECTURE — l'espace reste en lecture seule.** Le bouton n'écrit rien, et la base
ne le lui permettrait pas.

⚠️ **La route REFUSE, elle ne redirige jamais** (401 sans session, 403 sans droit
d'administrateur, en JSON). Une redirection 307 serait suivie par `fetch`, et le navigateur
enregistrerait la page de connexion sous le nom `xn-facture-entreprises-….csv`. Même règle que
les routes PDF.

⚠️ **Le bouton passe par `fetch`, pas par une `<a download>`.** Une ancre qui reçoit un 403
enregistre le JSON d'erreur dans un fichier `.csv` : l'administrateur croit tenir son export et
ne découvre la surprise que dans son tableur.

⚠️ **DEUX adresses email cohabitent, et il ne faut pas les confondre.** `companies.email` est
l'adresse de facturation saisie dans les paramètres, imprimée sur les factures — **souvent
vide**. L'adresse du **titulaire** est celle de son compte : elle existe toujours. Pour une
campagne, seule la seconde est exploitable. Les deux figurent dans le fichier, sous des
intitulés distincts.

⚠️ **INJECTION CSV — `neutraliser()` n'est pas une coquetterie.** Les noms d'entreprise sont
saisis par les utilisateurs, et Excel évalue toute cellule commençant par `=`, `+`, `-` ou
`@`. Quelqu'un qui nomme son entreprise `=HYPERLINK(...)` attaquerait la machine de celui qui
ouvre l'export — la nôtre. Le préfixe apostrophe force la lecture en texte. **Vérifié avec une
entreprise délibérément nommée `=SUM(1+1) Piegee`.** Effet de bord assumé : un numéro de
téléphone en `+237…` reçoit aussi l'apostrophe, que le tableur masque.

⚠️ **Trois détails décident si le fichier s'ouvre proprement dans Excel** : séparateur
**point-virgule** (Excel français empile tout en une colonne avec la virgule), **marque d'ordre
d'octets** en tête (sans elle « Échéance » et « Société » sont illisibles), et fins de ligne
**CRLF**.

⚠️ **Piège de test :** `response.text()` **supprime la marque d'ordre d'octets** en décodant.
Un test qui vérifie `charCodeAt(0) === 0xFEFF` échoue sur un fichier parfaitement correct.
Contrôler les octets par `arrayBuffer()` — `EF BB BF`.

⚠️ **Le bouton réemploie `usePdfDownload`**, qui n'a rien de spécifique au PDF. **Dette
assumée : son nom ment.** Le renommer toucherait `download-pdf-button` et
`invoice-row-actions` ; en écrire un second aurait dupliqué le garde-fou du corps vide et la
gestion d'erreur, et un doublon est un bug.

⚠️ **L'export porte TOUTES les entreprises, pas le filtre de recherche voisin.** D'où le mot
« tout » dans le libellé : sans lui, la proximité des deux contrôles induit en erreur.

⚠️ **Conséquence juridique, à moitié réglée.** Le **désabonnement existe** depuis le
17 sept. 2026 (migration 0012, voir ci-dessous). En revanche la **politique de confidentialité
ne mentionne toujours pas la prospection commerciale** parmi les finalités — l'utilisateur a
demandé d'y revenir plus tard. Question portée au juriste, section 2.8 de
`docs/mentions-legales-questions-juriste.md`.

#### Désabonnement des emails de prospection — migration 0012 (17 sept. 2026)

Sans lui, une campagne n'offrait aucune issue : le seul recours du destinataire était le bouton
« courrier indésirable », qui abîme la réputation du **domaine d'envoi** bien au-delà de la
personne concernée.

⚠️ **LE REFUS NE COUVRE QUE LE COMMERCIAL.** Confirmation d'adresse, mot de passe oublié et
**avis d'échéance** continuent de partir : ce sont des messages liés à l'exécution du service.
Laisser quelqu'un perdre sa formule faute d'avoir été prévenu serait lui nuire, pas le
respecter. La page de désabonnement le dit **explicitement**, sinon un avis d'échéance reçu
après coup se lit comme un désabonnement qui n'a pas marché.

⚠️ **`/desabonnement` est dans les `PUBLIC_PATHS`, et doit y rester.** On clique depuis sa boîte
mail, sur un appareil sans session. Derrière `/connexion`, se désabonner exigerait de se
connecter — c'est-à-dire n'existerait pas pour qui a oublié son mot de passe. L'autorisation
vient du **jeton** porté par l'URL, pas d'une session.

⚠️ **Le jeton est distinct de `user_id`.** Publier l'identifiant de compte dans un lien d'email
le ferait fuiter vers tout intermédiaire qui lit l'URL. Ce jeton n'ouvre qu'une porte : changer
une préférence d'envoi.

⚠️ **RIEN N'EST ENREGISTRÉ AU CHARGEMENT DE LA PAGE.** Les passerelles antispam et les clients
de messagerie **visitent les liens** d'un message pour les inspecter. Une page qui se
désabonnerait à l'ouverture retirerait des gens qui n'ont jamais cliqué, et qui attendraient
ensuite des messages qu'ils ne recevraient plus. Le geste vient d'un **bouton**. Vérifié : après
chargement de la page, la base dit toujours `marketing = true`.

⚠️ **L'export RETIRE les désabonnés, il ne les signale pas par une colonne.** Un fichier de
campagne contenant encore ces adresses n'attendrait qu'une inattention pour les démarcher quand
même, et le désabonnement ne serait qu'un décor. Leur nombre est affiché **près du bouton**,
sinon l'écart entre le nombre d'entreprises et le nombre de lignes passerait pour un défaut.

⚠️ **Chaque ligne du CSV porte SON lien de désabonnement.** Les campagnes partent d'un outil
externe à partir de ce fichier : sans cette colonne, le lien n'existerait dans aucun message.

⚠️ **`marketing_recipients()` est `security definer`, donc la RLS y tombe : la garde
`is_platform_admin()` est DANS la fonction.** Sans elle, n'importe quel compte authentifié
obtiendrait les jetons de tout le monde — et pourrait désabonner autrui.

⚠️ **PIÈGE PL/pgSQL déjà payé — `42702 column reference "user_id" is ambiguous`.** `returns
table (user_id …)` déclare une **variable** homonyme de la colonne : `on conflict (user_id)`
devient ambigu et la fonction échoue **à l'exécution**, pas à la création. Écrire
`on conflict on constraint email_preferences_pkey`, et qualifier partout par l'alias.

**Vérifié de bout en bout (17 contrôles)** : le CSV porte le lien, bien formé · **le chargement
de la page ne désabonne pas** · le clic enregistre, affiche l'adresse concernée, dit ce qui
continue d'arriver et offre le retour en arrière · **l'export exclut la ligne**, puis la remet
au réabonnement · un utilisateur ordinaire ne peut ni lister les jetons (400), ni lire la table
(RLS, `[]`), ni désabonner autrui (`PATCH` → 0 ligne) · jeton inconnu → message neutre qui ne
dit pas s'il existe · lien sans jeton → page explicative.

**Vérifié de bout en bout** : sans session → **401 JSON**, aucune page HTML · utilisateur
ordinaire → **403, aucune adresse email dans la réponse** · administrateur → 200, `text/csv`,
nom de fichier daté, 14 colonnes, les deux emails distingués, ville et formule présentes ·
injection neutralisée · `EF BB BF` en tête et CRLF en fin, sur les octets bruts.

**Ajout d'un administrateur : par la console SQL uniquement.** `platform_admins` n'a aucune
politique d'écriture — ce n'est pas un oubli, c'est la protection principale.

⚠️ **UN SCRIPT DE TEST INTERROMPU LAISSE UN ADMINISTRATEUR DERRIÈRE LUI.** Constaté le
17 sept. 2026 : un essai qui promeut un compte jetable en administrateur puis échoue avant son
ménage laisse la ligne `platform_admins` en place. Le compte survit avec un **mot de passe
connu** et la lecture de **toutes** les entreprises — ce n'est plus du résidu, c'est un accès.
**Après tout ménage, relire `platform_admins` et vérifier qu'il ne contient que de vraies
adresses**, avant même de compter les entreprises :

```sql
select u.email from public.platform_admins a join auth.users u on u.id = a.user_id;
```

Un test qui accorde ce droit devrait le retirer dans un `finally`, pas à la dernière ligne.

⚠️ **Trois pièges déjà payés :**
- **`/admin` est dans son propre groupe `(admin)`, pas dans `(app)`.** La coquille
  applicative appelle `requireSession()`, qui renvoie vers `/bienvenue` tout compte sans
  entreprise — **or un administrateur de plateforme n'en a pas forcément**. Constaté : la base
  répondait `is_platform_admin() = true` pendant que la page rendait un 307 vers
  `/bienvenue`. `requireAdmin()` ne s'appuie donc PAS sur `getSession()`.
- **PL/pgSQL ne court-circuite pas le `and`.** Le déclencheur testait
  `tg_op = 'UPDATE' and new.status is distinct from old.status` : l'insertion d'un CLIENT
  échouait aussitôt en `record "new" has no field "status"`, la table n'ayant pas cette
  colonne. D'où une branche `if` par table, et des `if` imbriqués plutôt qu'une condition
  combinée.
- **Le journal n'a pas de clé étrangère sur `company_id`.** Délibéré : une contrainte ferait
  disparaître l'historique en même temps que ce qu'il journalise.

  ⚠️ **Conséquence à connaître : supprimer une entreprise laisse ses lignes de journal
  derrière elle.** Le 17 sept. 2026, après le retrait des comptes de démonstration, le journal
  comptait **154 lignes dont 143 renvoyaient à des entreprises disparues** — l'écran, qui n'en
  montre que 60, ne donnait plus à voir qu'un historique fantôme. L'affichage était pourtant
  honnête (`entreprise supprimée` au lieu d'un nom) : le défaut était le **volume**, pas le
  libellé. Après purge : 7 lignes, toutes réelles.

  **Purge des lignes devenues orphelines — par la console SQL**, comme l'ajout d'un
  administrateur :

  ```sql
  delete from public.activity_log a
  where a.company_id is not null
    and not exists (select 1 from public.companies c where c.id = a.company_id);
  ```

  ⚠️ **PAS de bouton de purge dans l'interface, et c'est délibéré.** L'espace d'administration
  est en lecture seule par décision explicite de l'utilisateur (§8) : lui accorder une
  politique de suppression sur `activity_log` rendrait le journal effaçable depuis l'écran par
  celui-là même qu'il trace, ce qui lui ôterait sa valeur. La demande a été faite le
  17 sept. 2026 et cette réponse lui a été exposée ; **ne pas ajouter ce bouton sans le lui
  redemander.**

Les totaux de la page sont calculés **en TypeScript** par `computeTotals`, jamais en SQL —
même règle qu'ailleurs. ⚠️ La lecture charge toutes les factures de toutes les entreprises
avec leurs lignes : exact, mais **à revoir quand le volume grandira**.

### Pages légales — `/confidentialite`, `/conditions`, `/mentions-legales`
Trois pages statiques (420 o chacune), bâties sur un gabarit unique
(`marketing/legal-page.tsx`) : mêmes documents de texte long, même mise en page.
**Elles sont dans les `PUBLIC_PATHS`** — des mentions légales derrière une authentification
n'auraient aucun sens.

**Mentions légales réécrites le 17 sept. 2026**, en vue d'une relecture par un juriste :
identification de l'éditeur rassemblée dans **un seul tableau** (dix champs, donc un seul
endroit à remplir), liste **complète** des quatre sous-traitants avec leur rôle et leur
localisation, propriété des contenus, cookies, disponibilité, droit applicable, signalement des
failles. La note à emporter chez le juriste est dans
`docs/mentions-legales-questions-juriste.md` — elle ne doit **pas** figurer sur la page
publique, elle s'adresse au relecteur.

⚠️ **`contact@xn-facture.cm` — mauvais domaine, corrigé en `.com`.** L'adresse était fausse aux
trois endroits où elle apparaissait, dont le pied de page commun aux trois documents. **La boîte
`contact@xn-facture.com` reste à créer et à relever** : une adresse de contact citée dans des
mentions légales et qui ne répond pas est pire que pas d'adresse du tout.

⚠️ **Réserves assumées, à lever avant l'ouverture :**
- Chaque page porte un encart « document de travail, non validé juridiquement ». Il reste tant
  qu'un juriste n'a pas relu les textes.
- Les champs d'identification de l'éditeur sont des **espaces réservés visibles**
  (`[à compléter]`). Un produit qui impose le NIU et le RCCM sur chaque facture ne peut pas en
  inventer pour lui-même — **ne jamais les remplir d'office.**
- **Les CGU ne disent RIEN de l'abonnement** — ni prix, ni paiement, ni durée, ni
  renouvellement, ni résiliation. Elles datent de l'époque où le service était gratuit. Le
  chapitre est à écrire ; la note pour le juriste le signale en tête de sa section 2.5.
- Le contenu décrit l'infrastructure **réelle** (Supabase en Irlande, Vercel, Resend, LWS,
  isolation par RLS). Décrire un traitement qui n'existe pas serait pire que de ne rien écrire.
  ⚠️ **Conséquence : toute évolution d'infrastructure oblige à relire ces pages.** La mise en
  service des relances d'échéance a ainsi rendu fausse la phrase « Resend — emails
  d'authentification, **uniquement** » de la politique de confidentialité.

### PDF
Génération serveur — `GET /api/factures/[id]/pdf` et `GET /api/devis/[id]/pdf` — avec logo,
mentions légales, bloc de règlement, pagination. Le document est **relu en base sous RLS** :
il ne peut plus être fabriqué pour une facture qui n'est pas la vôtre. Un brouillon porte la
mention **BROUILLON — NON ÉMISE** et se télécharge sous `Brouillon-<client>.pdf` ; un document
émis prend son numéro.

⚠️ **Piège de déploiement, réglé le 5 sept. 2026 — 500 sur Vercel, 200 partout ailleurs.**
Erreur exacte, relevée sur la fonction déployée :

    Cannot find module '/var/task/node_modules/pdfkit/js/standard-fonts/Helvetica.cjs'

`pdfkit` charge les polices de base par un **sous-chemin d'import de paquet** —
`require('#standard-fonts/Helvetica')`, résolu à l'exécution via le champ `imports` de son
`package.json`. L'analyse statique de Next ne suit pas cette indirection : les 29 fichiers du
dossier étaient absents de la trace, donc du bundle déployé. En local rien ne paraissait,
`node_modules` étant présent en entier.

Le correctif tient dans `next.config.mjs`, `experimental.outputFileTracingIncludes`, pour les
deux routes PDF. **Contrôle après tout changement de dépendance** :

```bash
node -e "const a=require('./.next/server/app/api/factures/[id]/pdf/route.js.nft.json').files;   console.log(a.filter(f=>f.includes('standard-fonts')).length)"   # doit rendre 30, pas 0
```

⚠️ **Fausse piste, ne pas la refaire.** J'ai d'abord accusé les métriques `.afm` de
`pdfkit/js/data/` — absentes de la trace elles aussi, ce qui rendait l'hypothèse séduisante.
Les forcer n'a **rien changé** : le module manquant est un `.cjs`, pas un `.afm`. La leçon
tient en une phrase : **lire l'erreur avant de deviner la cause.** Une route qui renvoie
temporairement `cause.message` et six lignes de pile tranche en un déploiement.

**Filigrane.** Le logo de l'émetteur est repris en grand au centre de chaque page, à
**opacité 0,07**, rendu avant le contenu et marqué `fixed` pour se répéter sur toutes les
pages. Absent si l'entreprise n'a pas de logo — aucun repli textuel, deux lettres géantes en
fond ne ressembleraient à rien.

⚠️ **L'opacité est reprise à l'identique dans `invoice-preview.tsx`** : l'aperçu prétend
montrer « le document tel que le client le recevra », les deux doivent bouger ensemble. 0,05
faisait disparaître un logo à traits fins ; au-delà de 0,10 les montants souffrent.

⚠️ **Piège d'empilement CSS, côté aperçu uniquement.** Il faut `-z-10` sur le filigrane ET
`isolate` sur la carte. Sans `isolate`, un enfant à indice négatif passe derrière le fond du
parent — donc sous le `bg-surface` blanc, invisible. Constaté en capturant la carte avec et
sans filigrane : **empreintes identiques**. Le contrôle vaut d'être rejoué si l'aperçu change,
parce que l'œil ne voit pas la différence entre « très pâle » et « absent ».

Ces deux routes sont **hors du `matcher` du middleware**, et refusent elles-mêmes en **401
JSON**. Ce n'est pas un relâchement : une redirection 307 vers `/connexion` serait suivie par
`fetch`, et le client enregistrerait la page de connexion sous le nom `FAC-2026-0052.pdf`.
**Toute nouvelle route d'API suit cette règle : refuser, jamais rediriger.**

### Confirmation de création
Après enregistrement, une fenêtre rappelle client, numéro, statut et total, et offre le
téléchargement du PDF.

### Authentification — `/connexion`, `/inscription`, `/bienvenue`
Supabase Auth par email et mot de passe. Le `middleware.ts` rafraîchit la session et redirige
vers `/connexion` en mémorisant la destination dans `?suite=`. L'inscription crée l'entreprise
**et** l'appartenance dans la même transaction (`create_company_for_current_user`) ; si le
projet exige une confirmation par email, il n'y a pas encore de session à l'inscription et
`/bienvenue` rattrape le cas — un compte sans entreprise serait un cul-de-sac.

#### Connexion et inscription avec un compte Google (22 sept. 2026) — **ACTIF EN PRODUCTION depuis le 23 sept. 2026**

Bouton en tête de **`/connexion`** (« Continuer avec Google ») **et de
`/inscription`** (« S'inscrire avec Google »), au-dessus du formulaire email et
séparé par un « ou ». Au-dessus, parce que le placer dessous en ferait un
chemin de repli alors que c'est le plus court — un clic contre quatre champs.

**Activé le 23 sept. 2026.** Projet Google Cloud `xn-facture`
(numéro 1066202177367), écran de consentement **Externe**, état **En
production** — donc sans limite de 100 utilisateurs de test. Vérifié depuis
l'extérieur : `external.google = true` sur `/auth/v1/settings`, bouton servi
sur `/connexion` et `/inscription`, et **le clic mène réellement à
`accounts.google.com` sans écran de blocage**.

⚠️ **GOOGLE AFFICHE `tpzmmgcfpnsysaghdqrx.supabase.co`, PAS « XN-Facture ».**
Constaté en capture d'écran sur la production, pas supposé : l'écran de Google
dit « Accéder à l'application **tpzmmgcfpnsysaghdqrx.supabase.co** ». Ce n'est
pas un défaut de configuration — le nom de l'application n'apparaît qu'une fois
l'application **validée par Google** ; tant qu'elle ne l'est pas, Google
affiche le domaine de l'URI de redirection, qui est celui de Supabase.

Rien n'est cassé, et les liens « Règles de confidentialité » / « Conditions
d'utilisation » de cet écran pointent bien vers **nos** pages. Mais une chaîne
de 20 caractères aléatoires inspire peu confiance sur un produit qui manipule
de l'argent. **Deux sorties, aucune gratuite :**

1. **Validation de marque par Google** (« Centre de validation ») — gratuite,
   exige de prouver la propriété de `xn-facture.com` dans Search Console, et
   prend des jours à des semaines. Affiche ensuite le nom **et** le logo.
2. **Domaine d'authentification propre chez Supabase** — option payante ; le
   retour devient `auth.xn-facture.com`, et c'est ce domaine que Google
   affiche. Plus rapide, mais ce reste un domaine, pas le nom.

**Décision à prendre avec l'utilisateur. Ne pas engager la validation Google
sans lui demander** — elle met le projet sous examen.

⚠️ **DEUX RÉGLAGES DOIVENT S'ACCORDER**, et l'un ne suffit jamais :

1. **Supabase** — *Authentication > Sign In / Providers > Google*, avec le
   *Client ID* et le *Client Secret* de Google Cloud. C'est ce qui fait
   marcher la connexion.
2. **`XN_AUTH_GOOGLE=1`** (`lib/auth-providers.ts`) — décide seulement si le
   bouton s'affiche. Même motif que `lib/billing-config.ts` : sans la
   variable, aucun contrôle n'apparaît (§6.1). Posée sur Vercel en **Config**,
   **Production seulement** : les liens de retour partent toujours vers
   `www.xn-facture.com` (`NEXT_PUBLIC_SITE_URL`), donc un bouton sur un
   déploiement de prévisualisation ramènerait l'utilisateur en production au
   milieu de son parcours.

⚠️ **PIÈGE D'ORDRE PAYÉ LE 23 sept. 2026 : enregistrer la variable APRÈS avoir
redéployé ne sert à rien.** Le premier redéploiement a reconstruit avec
l'ancien environnement ; le code neuf était bien en ligne (prouvé par la sonde
`?retour=`, et `X-Vercel-Cache: MISS` écartait le cache) mais le bouton restait
absent. **De l'extérieur, une variable absente et une variable vide sont
indiscernables** — seule la liste Vercel les distingue. Toujours : enregistrer,
**puis** redéployer.

Dans Google Cloud, l'URI de redirection autorisée est celle de **Supabase**,
pas la nôtre : `https://tpzmmgcfpnsysaghdqrx.supabase.co/auth/v1/callback`.

⚠️ **PIÈGE MESURÉ, et c'est le plus coûteux de cette fonctionnalité.**
`signInWithOAuth` **ne contacte personne** : elle fabrique l'URL en local et
rend la main. Quand le fournisseur n'est pas activé, c'est le navigateur qui
découvre le refus — et **Supabase ne redirige pas, il RÉPOND** :

```
{"code":400,"error_code":"validation_failed",
 "msg":"Unsupported provider: provider is not enabled"}
```

L'utilisateur reste planté sur une URL `supabase.co`, devant du JSON anglais,
hors du site, sans autre issue que le bouton « précédent ». Poser
`XN_AUTH_GOOGLE=1` avant de configurer Supabase suffisait à produire cela.
D'où le contrôle **mesuré** de `providerActif()` : `GET /auth/v1/settings`
(publique, clé `anon`) rend `{ external: { google: … } }`, interrogé avant
d'envoyer qui que ce soit chez Google, en cache 5 minutes. **Un échec réseau
répond `false`, jamais `true`** — dans le doute on refuse chez nous, en
français, avec le formulaire email juste dessous.

⚠️ **Le callback est `/api/auth/confirmation`, celui des emails — PAS un
second.** Google emploie le même `?code=` PKCE ; un deuxième échangeur aurait
divergé. Seule la destination d'échec change, portée par **`?retour=`**.
Renvoyer vers « mot de passe oublié » quelqu'un qui n'a jamais eu de mot de
passe chez nous n'aurait aucun sens. `retour` est validé comme `suite` (chemin
interne, `//` refusé) et **réduit à son `pathname`**, sinon un `?` déjà présent
casserait le `?motif=` ajouté.

⚠️ **`access_denied` ne produit AUCUN bandeau.** Fermer l'écran de Google est
une décision, pas une panne : on repose la personne sur `/connexion`, d'où elle
partait. Un message rouge lui reprocherait son propre choix.

⚠️ **Le vérificateur PKCE est posé par la Server Action, en cookie.** C'est la
raison pour laquelle l'appel est côté serveur : déclenché depuis le navigateur,
le cookie serait posé ailleurs et l'échange échouerait au retour.

⚠️ **`prompt: 'select_account'` est délibéré.** Le téléphone est souvent
partagé ici, et Google réutilise sinon en silence le dernier compte connecté :
on créerait une entreprise sous l'identité de quelqu'un d'autre. Cet écran de
choix est le dernier moment où l'erreur est rattrapable.

**Il n'y a pas d'inscription distincte** : le premier passage crée le compte,
qui arrive **sans entreprise**, et `requireSession()` l'emmène sur
`/bienvenue`. Chemin déjà existant, rien à ajouter. `user_metadata.full_name`
est rempli par Google, donc la barre latérale affiche le bon nom sans code
supplémentaire, et `email_preferences` se crée à la volée dans
`marketing_recipients()` (0012).

⚠️ **Les couleurs du logo sont EN DUR, seule exception admise au §6.2.** Ce
n'est pas une couleur de produit mais une marque déposée : les conditions
d'usage de Google interdisent d'en changer la teinte. lucide ne fournit plus
les logos de marque, d'où le tracé en ligne — pas une image chargée chez
Google, qui coûterait une requête réseau.

##### La formule choisie doit survivre au trajet — et elle était PERDUE

⚠️ **DÉFAUT PRÉEXISTANT TROUVÉ ET RÉPARÉ le 22 sept. 2026, sans rapport avec
Google.** `signUp` sort sur `if (!data.session) return ok({ needsConfirmation:
true })` **avant** d'appeler `request_plan`. Depuis que `mailer_autoconfirm`
est repassé à `false` (17 sept.), il n'y a **jamais** de session à ce moment :
le `request_plan` de `signUp` n'était plus jamais atteint. Quelqu'un qui
cliquait « Choisir Pro » sur la grille tarifaire arrivait en Découverte
**sans que rien n'en garde trace** — et l'écart ne se voyait nulle part, ni à
l'écran ni dans un journal.

**Deux porteurs, UN SEUL point d'écriture.** `createCompany()` est désormais le
seul à appeler `request_plan` hors inscription directe, et il couvre les deux
chemins qui aboutissent à `/bienvenue` :

| Chemin | Porteur | Pourquoi celui-là |
|---|---|---|
| Google | `?plan=` dans `suite` → `/bienvenue?plan=pro` | Nous fabriquons le `redirect_to`, donc nous pouvons y mettre ce que nous voulons |
| Email | `user_metadata.requested_plan`, déposé par `signUp` | **Le gabarit d'email est FIXE pour tout le projet** (`suite=%2Fbienvenue` en dur) : il ne peut rien transporter de propre à une personne |

L'URL l'emporte sur `user_metadata` : c'est le choix le plus récent.

⚠️ **`requested_plan` dans `user_metadata` ne viole PAS la règle du projet**,
qui interdit d'y ranger ce qui accorde un droit. Il n'en accorde aucun :
`requested` est une intention commerciale, tout le monde reste en Découverte,
et `request_plan` est de toute façon **déjà** appelable par n'importe quel
compte authentifié avec n'importe quel code valide. Falsifier ce champ ne donne
accès à rien de plus que l'écran d'abonnement. **Ne pas généraliser** : c'est
l'analyse de CE champ, pas une levée de la règle.

⚠️ **`components/auth/chosen-plan.tsx` est extrait de `sign-up-form.tsx`**,
parce qu'il en fallait un second exemplaire sur `/bienvenue` — c'est là
qu'atterrit un compte Google, et là que l'entreprise est réellement créée. Deux
copies auraient divergé sur un texte qui parle d'argent.

**Vérifié à l'écran et contre la base réelle (26 contrôles)** :

- **sans la variable**, sur les DEUX écrans : aucun bouton, pas de séparateur
  orphelin, formulaires intacts (2 et 4 champs), formule toujours annoncée ;
- **avec elle** : libellés distincts par écran, 40 px, `type=button` (il ne
  soumet pas le formulaire), les quatre couleurs du G, séparateur présent,
  placé avant le formulaire · tabulation Google → email → mot de passe · sur
  500 px : tient, aucun débordement ;
- **clic réel, Google non activé** : message français sur notre page, **on ne
  quitte pas le site** ;
- **`redirect_to` observé** : `…/api/auth/confirmation?suite=/bienvenue?plan=pro&retour=/connexion`, avec `prompt=select_account` ;
- callback `access_denied` → `/connexion` **sans motif** · autre erreur →
  `?motif=fournisseur` · **`retour=//evil.example.com` et
  `retour=https://evil…` → repli sur `/mot-de-passe-oublie`, aucune redirection
  ouverte** · sans `retour`, les liens d'email sont inchangés ;
- **bout en bout contre la base, deux comptes jetables** : porteur URL →
  `requested = 'pro'` · porteur `user_metadata` → `requested = 'business'` ·
  **`plan` reste `discovery` dans les deux cas — rien n'a été accordé** ·
  formule rappelée à l'écran sur `/bienvenue` ·
  **ménage vérifié : 0 entreprise, 0 compte, 0 orpheline, 1 administrateur
  (le vrai)**.

**Vérifié EN PRODUCTION le 23 sept. 2026, après activation (8 contrôles)** :
bouton présent sur `/connexion` (40 px, les quatre couleurs du G, séparateur) ·
présent sur `/inscription` avec la formule toujours annoncée · **le clic mène
réellement à `accounts.google.com`** · **aucun écran de blocage, aucun
avertissement « application non validée »** · `redirect_to` observé en
`https://www.xn-facture.com/api/auth/confirmation?suite=/dashboard&retour=/connexion`
· les sondes `?retour=` et anti-redirection-ouverte répondent juste sur le
domaine réel.

⚠️ **CE QUI N'A TOUJOURS PAS ÉTÉ ÉPROUVÉ : la connexion menée à son terme.**
Elle exige de saisir un vrai mot de passe Google, ce qui ne peut pas se faire
ici. Sont prouvés : l'aller jusqu'à Google, l'URL de retour, et l'absence de
blocage. Restent à constater par l'utilisateur : le retour sur `/bienvenue`, la
création de l'entreprise, et le nom repris de Google dans la barre latérale.

### Mot de passe oublié — `/mot-de-passe-oublie`, `/nouveau-mot-de-passe`
Trois étapes : demande (adresse email) → lien reçu par email → choix du nouveau mot de passe,
suivi d'une connexion immédiate. Le lien passe par **`GET /api/auth/confirmation`**, qui
échange le jeton contre une session puis redirige.

- **La route de retour est sous `/api/`** parce que le middleware exclut ce préfixe. Ailleurs,
  il l'aurait renvoyée vers `/connexion` avant exécution — or l'utilisateur qui arrive là n'a
  justement pas encore de session.
- **Deux formes de jeton sont acceptées.** `?code=` (flux PKCE, celui de `@supabase/ssr` par
  défaut) exige que le lien soit ouvert **dans le navigateur qui a fait la demande**, le
  vérificateur étant un cookie ; `?token_hash=&type=` (gabarit d'email utilisant
  `{{ .TokenHash }}`) fonctionne depuis n'importe quel appareil. Le message d'échec dit
  explicitement le cas « autre appareil », sans quoi il est indevinable.
- **`?suite=` n'accepte qu'un chemin interne.** Il transite par Supabase et reviendrait sinon
  en redirection ouverte.
- **La réponse est la même que l'adresse existe ou non.** Dire « compte inconnu » ferait de ce
  formulaire un outil d'énumération de clients. Seule la limite de débit est signalée — sans
  quoi l'utilisateur réessaie en boucle sans jamais rien recevoir.
- **Configuration requise** : `NEXT_PUBLIC_SITE_URL` (sinon l'origine est déduite d'en-têtes
  fournis par le client), et l'adresse `<site>/api/auth/confirmation` déclarée dans Supabase
  sous *Authentication > URL Configuration > Redirect URLs*.
### Envoi des emails — configuration en place (4 sept. 2026)

**Resend est branché comme SMTP de Supabase.** Le service d'email intégré a été abandonné :
il plafonnait à 2 messages par heure, ne livrait qu'aux membres du projet, et — c'est le
point qui l'a condamné — **verrouillait les gabarits**. L'API de gestion refusait toute
modification :

> `Email template modification is not available for free tier projects using the default
> email provider.`

Un SMTP personnalisé débloque les trois d'un coup : livraison, traduction, et forme du lien.

| Réglage | Valeur |
|---|---|
| `smtp_host` / `smtp_user` | `smtp.resend.com` / `resend` (mot de passe = `RESEND_API_KEY`) |
| `smtp_admin_email` | **`no-reply@xn-facture.com`** (17 sept. 2026 ; était `onboarding@resend.dev`) |
| `mailer_autoconfirm` | **`false`** — les adresses sont réellement vérifiées |
| `smtp_sender_name` | `XN-Facture` |
| `rate_limit_email_sent` | 30/h (était 2) |
| `uri_allow_list` | `https://xn-facture.com/**`, `https://www.xn-facture.com/**`, `https://xn-facture.vercel.app/**`, `http://localhost:3000/**` |
| `site_url` | `https://www.xn-facture.com` (16 sept. 2026) |
| Gabarits | Français : `recovery`, `confirmation`, `password_changed_notification`, `email_change`, `email_changed_notification` |

**Les gabarits pointent sur `{{ .TokenHash }}`, pas sur `{{ .ConfirmationURL }}`.** Le lien va
donc directement à l'application et ne dépend d'aucun cookie : il s'ouvre depuis n'importe
quel appareil. Avec `ConfirmationURL` on héritait du flux PKCE, qui exige d'ouvrir le lien
dans le navigateur ayant fait la demande — intenable quand on demande depuis Chrome mobile et
qu'on ouvre le message dans l'application Gmail, c'est-à-dire le cas courant ici.

~~**Deux limites à lever avant l'ouverture au public**~~ — **LES DEUX SONT LEVÉES.**

1. ~~Aucun domaine vérifié chez Resend~~ — **RÉGLÉ le 17 sept. 2026.** Voir « Vérification du
   domaine chez Resend » ci-dessous. `smtp_admin_email` est passé à `no-reply@xn-facture.com`
   et `mailer_autoconfirm` est revenu à `false`.
2. ~~**`site_url` vaut `http://localhost:3000`**~~ — **RÉGLÉ.** Il vaut
   `https://www.xn-facture.com` depuis le 16 sept. 2026, et `uri_allow_list` couvre le nouveau
   domaine, son apex, `xn-facture.vercel.app` et localhost.

   *(Auparavant : les liens envoyés ne fonctionnaient que sur la machine de développement.)*

#### Vérification du domaine chez Resend — VÉRIFIÉ le 17 sept. 2026

Domaine `xn-facture.com`, identifiant Resend `df95aeb0-dc85-4baa-ba4b-a576044a17fd`, région
`eu-west-1` (Irlande). Les quatre enregistrements — TXT `resend._domainkey`, MX `send`,
TXT `send`, CNAME `rsend` — sont publiés dans la zone LWS (voir `xn-facture.com.zone`) et
tous `verified`.

**La validation a mis environ 24 heures**, alors que la documentation de Resend annonce
« souvent moins de 15 minutes ». Le DKIM et le CNAME sont passés en premier, la paire
MX + TXT sur `send` bien plus tard. **Il n'y avait rien à corriger.**

⚠️ **Deux explications ont été proposées puis RÉFUTÉES par la mesure. Ne pas les reprendre :**
(1) le cache négatif des résolveurs — le TTL minimum du SOA vaut 3600 s, et passé ce délai les
enregistrements étaient visibles sur 1.1.1.1, 8.8.8.8, 9.9.9.9 et OpenDNS pendant que Resend
refusait toujours ; (2) les relances de vérification trop fréquentes — une heure de veille
strictement passive n'a rien débloqué non plus. **La cause était l'attente, rien d'autre.**

Ce qui a été vérifié entre-temps, et qui sert de protocole si le cas se reproduit : valeurs
attendues par l'API comparées aux valeurs publiées, **priorité 10 comprise** · les quatre
serveurs `ns17-20.lwsdns.com` · une seule chaîne TXT et un seul MX sur `send`, **aucun CNAME
ni A parasite** qui invaliderait le nœud · aucun CAA · toute la liste de dépannage officielle
de Resend (région, MX multiples, suffixe ajouté par le fournisseur, DNS géré à plusieurs
endroits, CNAME proxifié) — aucune ne s'appliquait.

⚠️ **`POST /domains/:id/verify` REMET TOUS LES ENREGISTREMENTS À `pending`** avant de les
retester, y compris ceux déjà validés. Ne pas y lire une régression. `veille-resend.mjs`, au
bloc-notes, observe sans jamais déclencher.

⚠️ **Le statut ne se déduit pas, il se prouve par un envoi.** `POST /emails` répondait
`403 validation_error` tant que la vérification n'était pas complète — c'est le seul contrôle
qui tranche, et il doit être rejoué après toute modification de la zone.

**Vérifié de bout en bout le 17 sept. 2026**, et non supposé : envoi réel depuis
`no-reply@xn-facture.com` → `delivered` · **inscription** (qui renvoyait un 500 pour tout le
monde) → compte créé, `email_verified: false`, email de confirmation livré, lien suivi jusqu'à
`/bienvenue`, `email_confirmed_at` renseigné **en base** · **mot de passe oublié** → email
livré, sujet français, lien vers `www.xn-facture.com` · **changement d'adresse** (qui renvoyait
`500 Error sending email change email`) → deux emails livrés, les deux liens suivis, adresse
réellement changée en base, connexion avec la nouvelle.

##### Gabarits `email_change` et `email_changed_notification` (17 sept. 2026)

Ils étaient restés **en anglais** — ils n'avaient jamais pu être éprouvés, la fonction
échouant. Traduits, et leur lien passé de `{{ .ConfirmationURL }}` à `{{ .TokenHash }}` comme
les autres : `ConfirmationURL` hérite du flux PKCE, qui exige d'ouvrir le lien dans le
navigateur ayant fait la demande — intenable quand on demande depuis un navigateur et qu'on
ouvre le message dans l'application Gmail du téléphone. `type=email_change` est bien accepté
par `EmailOtpType`, donc par `/api/auth/confirmation` sans modification.

⚠️ **`mailer_secure_email_change_enabled = true` : le gabarit part aux DEUX adresses**,
l'ancienne et la nouvelle, et **les deux liens doivent être suivis** pour que le changement
prenne effet. Le texte le dit à l'utilisateur, sans quoi il attend un effet qui ne vient pas.

⚠️ **PIÈGE DE TEST — le service d'authentification garde les gabarits en cache une dizaine de
minutes.** Deux essais lancés une et deux minutes après la modification ont reçu l'**ancien
gabarit anglais**, alors que l'API de gestion renvoyait déjà le français et qu'aucune chaîne
anglaise ne subsistait nulle part dans la configuration. Le troisième, treize minutes plus
tard, est passé. **Attendre avant de conclure qu'un gabarit n'est pas pris en compte.**

⚠️ `mailer_notifications_email_changed_enabled` vaut **`false`** : le gabarit
`email_changed_notification` est traduit mais **ne part jamais**. À basculer si l'on veut
qu'un changement d'adresse soit notifié — c'est une protection utile contre un détournement
de compte.

**Vérifié de bout en bout le 4 sept. 2026** *(relevé d'époque : l'expéditeur était encore
`onboarding@resend.dev` — voir plus haut pour l'état actuel)* : demande depuis
`/mot-de-passe-oublie` → journal Resend `statut=delivered` vers la boîte réelle, sujet
« Réinitialisez votre mot de passe — XN-Facture » → lien du gabarit rendu avec un vrai jeton
et suivi → `/nouveau-mot-de-passe`, compte reconnu.

### Déploiement Vercel — `www.xn-facture.com`

Dépôt **`github.com/Nrj85/XN-Facture`**, branche `main`, déployée automatiquement. **En ligne
et vérifié le 4 sept. 2026** : connexion, destination mémorisée par `?suite=`, tableau de bord
et factures lus depuis Supabase, lien « Mot de passe oublié ? » fonctionnel.

#### Le domaine propre — `www.xn-facture.com` (16 sept. 2026)

Domaine acheté chez **LWS**, qui reste l'hébergeur DNS. `xn-facture.vercel.app` continue de
répondre et sert de filet.

**`www` est l'adresse officielle, choisie par l'utilisateur**, et `xn-facture.com` redirige
vers elle en 308 — réglage par défaut de Vercel quand on déclare les deux, conservé tel quel.
`NEXT_PUBLIC_SITE_URL`, `site_url` et les liens d'email doivent tous porter la **forme www** :
une divergence ferait traverser une redirection à chaque lien de réinitialisation.

Quatre lignes de la zone LWS ont changé, et **seulement** quatre :

| Ligne | Avant (LWS) | Après (Vercel) |
|---|---|---|
| `@` **A** | `193.203.239.78` | `216.198.79.1` |
| `@` **AAAA** | `2a00:7ee0:8:0:3:3883:0:dab` | **supprimée** |
| `ftp` | CNAME vers `@` | A `193.203.239.78` |
| `www` | CNAME vers `@` | CNAME `48460a88f6a26d4d.vercel-dns-017.com.` |

La zone complète est versionnée dans **`xn-facture.com.zone`**, et l'état antérieur dans
**`xn-facture.com.zone.avant-vercel`**. Les deux servent de marche arrière.

⚠️ **NE JAMAIS accepter l'onglet « Vercel DNS ».** Il propose de basculer les serveurs de noms
sur `ns1/ns2.vercel-dns.com`, ce qui **déplace toute la zone** chez Vercel — lequel ne recrée
que ce qui concerne le web. Disparaîtraient d'un coup le MX, SPF, DKIM, DMARC et **les quatre
enregistrements Resend**. La messagerie du domaine cesserait d'arriver. Vercel n'a besoin que
d'un enregistrement par domaine, pris dans l'onglet **« DNS Records »**.

⚠️ **Supprimer la ligne AAAA est obligatoire, et c'est le piège le plus coûteux.** Elle n'est
pas remplacée par une AAAA Vercel : si on la laisse pointer sur LWS, les visiteurs en **IPv6**
atterrissent sur l'ancien hébergeur pendant que ceux en IPv4 voient l'application. Un site qui
marche une fois sur deux selon le réseau du visiteur, et rien dans les journaux pour le dire.

⚠️ **`ftp` pointait sur `@`** : il aurait suivi le domaine jusque chez Vercel. Figé sur
l'adresse LWS. Même vigilance pour tout futur enregistrement défini comme CNAME vers `@`.

⚠️ **La valeur du CNAME `www` est PROPRE AU PROJET** (`48460a88f6a26d4d.vercel-dns-017.com.`),
elle ne se devine pas. `cname.vercel-dns.com` et `76.76.21.21` restent acceptés en héritage,
mais **c'est l'onglet « DNS Records » du projet qui fait foi** — le recopier, pas le supposer.

**Vérifié, et non supposé** : `https://www.xn-facture.com` → 200 avec le titre attendu et un
certificat valide · `https://xn-facture.com` → 308 vers www · `/dashboard` sans session → 307
vers `/connexion?suite=%2Fdashboard` · pages légales et `/connexion` → 200 · MX, SPF, DKIM,
DMARC et `mail` relus **sur le serveur faisant autorité**, intacts · les quatre lignes Resend
servies par **les quatre** serveurs LWS · aucune AAAA résiduelle · propagation constatée sur
1.1.1.1, 8.8.8.8, 9.9.9.9 et OpenDNS.

##### L'ancienne adresse redirige — `next.config.mjs`, `redirects()`

Vercel continue de servir l'application sur `xn-facture.vercel.app` **et** sur le domaine
propre, et **ne sait pas rediriger son propre sous-domaine `.vercel.app` depuis l'interface**.
Un favori, un onglet resté ouvert ou un lien partagé avant la migration gardait donc
l'ancienne adresse sous les yeux de l'utilisateur, indéfiniment. D'où une règle de
redirection portée par le code, filtrée sur l'en-tête `host`.

⚠️ **`permanent: false` (307), pas 308.** Un 308 est mis en cache durablement par le
navigateur : le jour où le domaine propre poserait problème, `xn-facture.vercel.app` ne
redonnerait plus accès à l'application pour quiconque l'a visitée une fois. **Le filet de
secours doit rester praticable.** Le référencement n'en souffre pas — l'adresse `.vercel.app`
n'est pas l'adresse de marque.

⚠️ **`/api/` est EXCLU de la redirection**, pour la raison exacte qui l'exclut du `matcher` du
middleware : `fetch` suit les redirections sans broncher, et le cookie de session est posé sur
l'**ancien** domaine — une route PDF redirigée vers le nouveau répondrait 401, et le bouton
enregistrerait cette erreur sous le nom du document. La règle du projet tient : **une route
d'API refuse, elle ne redirige pas.**

⚠️ **Les déploiements de prévisualisation ne sont pas touchés** : leur hôte
(`xn-facture-git-<branche>-<compte>.vercel.app`) ne correspond pas à la valeur filtrée.

**Vérifié sur le serveur de production local**, en forgeant l'en-tête `Host` : `/` → 307 ·
`/dashboard` → 307 · `/factures/abc` → 307 · `/connexion?suite=%2Fdashboard` → 307 **avec les
paramètres préservés** · `/api/factures/abc/pdf` → **401 sans redirection** · depuis
`www.xn-facture.com` → 200 · depuis un hôte de prévisualisation → 200.

**Trois variables indispensables** — toutes en type **Config**, sur *All Environments* :

```
NEXT_PUBLIC_SUPABASE_URL       https://tpzmmgcfpnsysaghdqrx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  (208 caractères)
NEXT_PUBLIC_SITE_URL           https://www.xn-facture.com
```

⚠️ **Ce paragraphe disait « et seulement trois » — c'est devenu faux.** S'y ajoutent les
variables **facultatives** qui n'ouvrent une fonctionnalité que si on les pose, et dont
l'absence est un comportement prévu, jamais une panne :

```
XN_MOMO_MTN, XN_MOMO_ORANGE, XN_PAYMENT_HOLDER, XN_BILLING_EMAIL   encaissement
TARA_API_KEY, TARA_BUSINESS_ID, TARA_WEBHOOK_SECRET                liens de paiement
XN_AUTH_GOOGLE                                                     bouton Google
```

⚠️ **Les trois de Tara sont « Sensitive », Production seulement.** Elles ne sont **jamais**
préfixées `NEXT_PUBLIC_` : la clé Tara transite dans le corps de la requête, la publier la
donnerait à tout visiteur. La liste des variables **interdites** sur Vercel n'a pas changé —
voir juste dessous.

⚠️ **`NEXT_PUBLIC_SITE_URL` restait à `https://xn-facture.vercel.app` au 16 sept. 2026**, le
changement étant à faire dans l'interface Vercel. Il décide de l'adresse inscrite dans les
liens d'email (`siteOrigin()`). **Changer la valeur ne suffit pas** : voir le piège n° 3
ci-dessous, il faut redéployer en décochant le cache de build.

**`SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_ACCESS_TOKEN` ne doivent PAS y être.**
`serviceRoleKey()` existe dans `lib/supabase/config.ts` mais n'est appelé nulle part ; la
poser exposerait une clé qui contourne la RLS sans aucun bénéfice. `SUPABASE_ACCESS_TOKEN` est
un jeton personnel qui pilote *tous* les projets Supabase du compte : il n'a rien à faire sur
un serveur web. `RESEND_API_KEY` non plus — elle vit sur Supabase comme mot de passe SMTP.

Le fichier `.env.vercel.local` (ignoré par git) contient le bloc prêt à coller.

#### Les trois pièges rencontrés — ne pas les rediagnostiquer

**1. Importer `.env.example` au lieu de `.env.local`.** Les deux se ressemblent ; le premier
est versionné et **vide par construction**. Symptôme : quatre variables aux bons noms, toutes
sans valeur.

**2. Une variable `NEXT_PUBLIC_*` ne peut pas être de type « Secret ».** Vercel refuse
d'enregistrer (« Remove the public framework prefix… change the variable to Config ») — mais
une variable déjà enregistrée en Secret **ne se convertit pas** (« Saved secrets are
write-only »). Seule issue : **la supprimer et la recréer en Config**, le type se choisissant
avant le premier enregistrement. C'est légitime ici : ce qui contourne la RLS reste secret,
ce que la RLS protège peut être public.

**3. `NEXT_PUBLIC_*` est inscrit en dur À LA COMPILATION.** Corriger la valeur dans l'interface
ne change **rien** au binaire déjà déployé. Il faut **Redeploy en décochant « Use existing
Build Cache »**. Signature observée : `NEXT_PUBLIC_SITE_URL` — absente du build précédent, donc
laissée en lecture à l'exécution — arrivait correctement, tandis que les deux variables déjà
présentes mais vides restaient vides. Une variable *absente* au build se lit à l'exécution ;
une variable *présente mais vide* est gravée à vide.

#### Comment diagnostiquer, si cela se reproduit

Le test décisif est **comparatif**, sur `/dashboard` sans session :

| | Attendu | Si les clés manquent |
|---|---|---|
| `/dashboard` | `307 → /connexion?suite=%2Fdashboard` | **500** |
| `/` | 307 vers `/connexion` | 307 **sans `Location`**, page blanche |

Le 500 vient de `isConfigured()` faux dans le middleware : il laisse passer, puis la page lève
`ConfigError`. En cas de doute sur *quelle* variable manque, une route temporaire
`app/api/diagnostic/route.ts` renvoyant présence et longueur (jamais les valeurs) tranche en
un déploiement.

⚠️ **Ne pas chercher les clés dans les bundles JavaScript servis.** C'est une fausse piste :
`lib/supabase/client.ts` n'est importé nulle part, tout Supabase passe par le serveur, donc
`NEXT_PUBLIC_SUPABASE_URL` n'apparaît dans aucun bundle client — même en local avec toutes les
clés. L'absence n'y prouve rien.

⚠️ **`/connexion` n'a rien dans son HTML statique** : `useSearchParams` impose un `<Suspense>`,
donc le formulaire n'existe qu'après hydratation. Un `curl | grep` sur cette page ne prouve
rien non plus — il faut inspecter le DOM. Et tester le lien « Mot de passe oublié ? » exige
une session purgée, sinon le middleware renvoie `/connexion` vers `/dashboard`.

---

## 3. Technologies

| Brique | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 14.2**, App Router | Route groups, Server Components, route handlers |
| Langage | **TypeScript 5.5** strict + `noUncheckedIndexedAccess` | Un index non vérifié est une source d'erreur silencieuse sur des montants |
| Styles | **Tailwind CSS 3.4**, jetons dans `tailwind.config.ts` | Aucune valeur en dur dans un composant |
| Icônes | **lucide-react** | Attention : certains glyphes portent un `$` — proscrit dans un produit FCFA |
| PDF | **@react-pdf/renderer 4.9** | Runtime Node obligatoire (`export const runtime = 'nodejs'`) |
| Polices | **Archivo** + **Inter**, auto-hébergées (`next/font/local`) | `next/font/google` retombe **silencieusement** sur les polices système si le réseau échoue au build |
| Utilitaires | `clsx` + `tailwind-merge` via `cn()` | — |
| Base et auth | **Supabase** — `@supabase/supabase-js` + `@supabase/ssr` | `@supabase/auth-helpers-nextjs` est déprécié : ne pas y revenir |
| Validation serveur | **zod 4** (`lib/actions/schemas.ts`) | Une Server Action est une route HTTP : le client peut y envoyer n'importe quoi |
| À venir | Déploiement Vercel | — |

Aucune bibliothèque de formulaires : l'état des formulaires reste contrôlé à la main. `zod`
ne sert qu'à la **frontière serveur**, pas à la saisie.

---

## 4. Structure des fichiers

```
middleware.ts                   Session + protection des routes

supabase/
  migrations/0001_schema.sql    Tables, contraintes, index
  migrations/0002_functions.sql is_company_member, current_company_id,
                                next_document_number, create_company_for_current_user
  migrations/0003_rls.sql       Politiques, toutes `to authenticated`
  migrations/0004_admin.sql     platform_admins, is_platform_admin, journal, déclencheurs
  migrations/0005_admin_actors.sql  Vue des comptes, réservée aux administrateurs
  migrations/0006_abonnements.sql   subscriptions + subscription_payments, request_plan
  migrations/0007_quota_factures.sql invoices_quota — plafond Découverte, par déclencheur
  migrations/0008_quota_hint.sql    hint = 'plan-limit' : refus reconnaissable par le code
  migrations/0009_commandes.sql     subscription_orders + start/cancel_subscription_order
  migrations/0010_liens_paiement.sql provider + payment_links, attach_payment_links
  migrations/0011_relances_echeance.sql subscription_reminders, send_expiry_reminders,
                                pg_cron + pg_net + vault — la clé Resend N'Y EST PAS
  migrations/0012_desabonnement.sql email_preferences, set_marketing_preference,
                                marketing_recipients — jeton d'URL, page publique
  migrations/0013_resiliation.sql   renewal_declined + set_renewal_intent ; REMPLACE
                                send_expiry_reminders (repartir de CE fichier)

docs/
  mentions-legales-questions-juriste.md  Note de relecture juridique (à emporter chez
                                le juriste) — lacunes connues et points à trancher
  seed.sql                      Jeu de démonstration, rejouable

app/
  layout.tsx                    Polices auto-hébergées, <html lang="fr">
  (marketing)/page.tsx          Landing publique — STATIQUE, modules CSS
  (marketing)/marketing.css     Jetons recopiés de tailwind.config.ts
  (auth)/connexion|inscription|bienvenue/
  (auth)/mot-de-passe-oublie/   Demande du lien de réinitialisation
  (auth)/nouveau-mot-de-passe/  Choix du nouveau mot de passe (session déjà ouverte)
  (auth)/desabonnement/         PUBLIQUE — refus des emails de prospection, par jeton
  (admin)/admin/                Espace administrateur — coquille propre, sans entreprise
  (app)/abonnement/             Formule de l'entreprise (lecture seule, sans caisse)
  (app)/layout.tsx              requireSession + CompanyProvider + AppShell
  (app)/dashboard|factures|devis|clients|parametres|paiements|rapports|aide/
  api/admin/entreprises/export  GET, CSV des entreprises (admins, refuse en JSON)
  api/auth/confirmation         GET, jeton d'email → session (hors middleware)
  api/factures/[id]/pdf         GET, lit la base (runtime Node)
  api/devis/[id]/pdf            GET, idem
  fonts/                        archivo-latin.woff2, inter-latin.woff2
  globals.css                   Classes .type-display .label-caps .tabular, reduced-motion

components/
  admin/       admin-view, export-companies-button (export CSV des entreprises)
  ui/          Primitives : button, icon-button, card, input, field, switch, combobox,
               date-picker, dialog, popover, action-menu, status-badge, empty-state
  layout/      app-shell, sidebar, topbar, logo, page-placeholder,
               account-badge (Admin + formule payante)
  marketing/   site-header, site-footer (+ FinalCta), hero, app-preview, reveal,
               back-to-top (retour en haut, landing + pages légales),
               section, info-card, cta-button, pricing, testimonials, legal-page
               — chacun avec son .module.css, hors Tailwind
  auth/        auth-card (enveloppe commune), sign-in-form, sign-up-form,
               create-company-form, forgot-password-form, reset-password-form,
               google-button (connexion Google — masqué sans XN_AUTH_GOOGLE),
               chosen-plan (rappel de la formule — inscription ET /bienvenue)
  dashboard/   dashboard-view, dashboard-filters, stat-card, recent-invoices,
               invoice-row-actions, receivables-panel
  invoices/    invoice-form, invoice-list, invoice-detail, invoice-editor, invoice-preview,
               invoice-status-actions (table UNIQUE des transitions),
               line-items-editor, totals-summary, invoice-quick-actions,
               record-payment-dialog, download-invoice-button
  quotes/      quote-form, quote-list, quote-detail, quote-editor, quote-quick-actions
  clients/     client-list
  settings/    settings-form, logo-uploader, personal-form (nom + langue),
               security-form (adresse email + mot de passe)
  subscription/ plan-limit (fenêtre de plafond), plan-chooser (choix + commande),
                order-summary (référence et instructions de règlement),
                renewal-intent (ne pas renouveler / revenir dessus)
  documents/   status-menu, document-created-dialog, use-creation-notice   (facture + devis)
  pdf/         download-pdf-button

lib/
  types.ts          Client, Invoice/InvoiceView, Quote/QuoteView, Company, statuts
  money.ts          SOCLE — arrondi, TVA, formatage. Aucun montant ne le contourne
  invoice-calc.ts   computeTotals : lignes → sous-total → TVA → TTC
  format.ts         Dates civiles en UTC, formatage jj/mm/aaaa
  today.ts          Date du jour en fuseau Africa/Douala
  invoices.ts       deriveStatus, toView, computeStats, computeAging
  quotes.ts         deriveQuoteStatus, toQuoteView, computeQuoteStats, QUOTE_NOTES
  company-context.tsx  CompanyProvider — LECTURE SEULE (company, formatMoney, user)
  supabase/         config (env typé), client (navigateur), server (RSC/actions), middleware
  db/               database.types (GÉNÉRÉ), types (alias de lignes), mappers (ligne ↔ domaine),
                    queries (lectures serveur, `getSession` et `requireSession`)
  actions/          auth, account (nom affiché), company, clients, invoices, quotes
                    · email-preferences (désabonnement, SANS session)
                    · locale · result, schemas, context
  admin/company-export.ts  Lignes et CSV de l export des entreprises (anti-injection)
  plans.ts          Les trois formules et leurs prix — SOURCE UNIQUE du montant
  billing-config.ts Coordonnées d'encaissement et secret du webhook (ENVIRONNEMENT)
  site-origin.ts    Origine publique du site — source UNIQUE (emails, retours, webhook)
  auth-errors.ts    translateAuthError — PAS 'use server' (fonction synchrone partagée)
  auth-providers.ts Affichage du bouton Google (XN_AUTH_GOOGLE) — l'activation
                    RÉELLE est chez Supabase, vérifiée par /auth/v1/settings
  payments/tara.ts  Tara/Dikalo : création du lien, filtrage des URL par schéma
  period.ts         Préréglages de période du tableau de bord (bornes en Date.UTC)
  calendar.ts       Grille du DatePicker (lundi en tête)
  nav.ts            Navigation et libellés de fil d'Ariane
  utils.ts          cn()
  pdf/              payload (contrat), build (assembleurs), invoice-document (rendu),
                    use-pdf-download (hook client)
```

> Le dossier `XN-FACTURE/` à la racine est **vide et sans usage** — reliquat, à ignorer.

### Comment circulent les données

**Lecture.** La page (Server Component) appelle `requireSession()` puis une fonction de
`lib/db/queries.ts`, et passe le résultat en props. `requireSession` redirige vers `/connexion`
sans session, vers `/bienvenue` sans entreprise.

**Écriture.** Le composant client **importe directement la Server Action** — rien ne descend en
props. Chaque action valide (zod), écrit, appelle `revalidatePath`, et rend un
`ActionResult` : `{ ok: true, data }` ou `{ ok: false, error }`. Une action qui peut être
légitimement refusée **ne lève pas** : une exception traverserait la frontière serveur en
message générique.

**`CompanyProvider`** ne porte que l'entreprise, `formatMoney` et l'utilisateur — parce que
`formatMoney` sert dans huit composants présentationnels et que les traverser en props
reviendrait à faire descendre l'entreprise partout. Les factures, devis et clients ne sont
**jamais** dans un contexte.

**Le mappeur `lib/db/mappers.ts` est la seule frontière** où `snake_case` devient `camelCase`
et où `qty_milli` redevient une quantité. C'est ce qui permet à `toView`, `computeTotals`,
`computeStats` et `computeAging` de rester inchangés depuis la phase 2.

---

## 5. Argent, dates, statuts — les règles produit

Prioritaires sur toute considération visuelle.

- Le **FCFA n'a pas de centimes**. Montants en **entiers de francs** (`bigint` en base). Aucun
  flottant ne touche un montant.
- `formatMoney(250000)` → `250 000 FCFA`. `formatAmount` pour le nombre seul.
- Les quantités fractionnaires circulent en **millièmes entiers** (`qtyMilli`).
- Un seul arrondi dans tout le projet : `roundHalfUp` de `lib/money.ts`.
- **TVA : un seul arrondi par base taxable, jamais par ligne.** Arrondir ligne à ligne accumule
  l'erreur et produit un total qui ne correspond pas à celui du client.
- Dates métier en `date` (`AAAA-MM-JJ`), jamais `timestamptz` : une facture émise le 8 janvier
  s'affiche le 8 janvier à Douala comme à Paris. Parsing en `Date.UTC` — sinon décalage d'un
  jour selon le fuseau.
- **Les statuts dérivés ne sont jamais stockés** : « en retard » (`deriveStatus`), « expiré » et
  « facturé » (`deriveQuoteStatus`). Les stocker imposerait un traitement nocturne sur toute la
  base, avec dérive garantie entre deux passages.
- Un **encaissement borné au total** : un montant supérieur donnerait un solde négatif, que ni
  les statistiques ni les tranches d'ancienneté ne savent représenter.
- Un devis converti garde le **taux de TVA du devis**, pas celui de l'entreprise : le total
  facturé doit rester celui que le client a accepté. Il ne se convertit **qu'une fois** —
  `invoiceId` verrouille la seconde tentative.

### Ce que la base garantit désormais

Trois règles ont cessé d'être des conventions JavaScript pour devenir des contraintes que
rien ne contourne :

| Règle | Mécanisme |
|---|---|
| On ne supprime pas un client rattaché à des documents | `on delete restrict` sur `invoices.client_id` et `quotes.client_id` |
| Une facture émise porte un numéro | `check (status = 'draft' or number is not null)` |
| Un devis ne se convertit qu'une fois | index unique partiel sur `quotes.invoice_id` |
| La formule Découverte plafonne à 5 factures émises par mois | déclencheur `invoices_quota` (0007) |
| Un client ne peut pas s'accorder une formule payante | `subscriptions`, aucune politique d'écriture (0006) |
| Une commande ne peut pas se déclarer payée | `subscription_orders`, aucune politique d'écriture (0009) |
| Une seule commande en attente par entreprise | index unique partiel `where status = 'pending'` (0009) |

Et une garantie neuve : **la numérotation est atomique**. En mémoire, le numéro suivant se
déduisait d'un balayage du tableau ; deux envois simultanés auraient obtenu le même. La
fonction `next_document_number` incrémente `document_counters` en une seule instruction
`insert … on conflict … returning`. Un rollback laisse un trou dans la séquence — c'est le
prix de l'atomicité, très inférieur au risque de deux factures partageant un numéro.

**Aucun total, aucune TVA, aucun arrondi n'est calculé en SQL.** Réécrire `roundHalfUp` en
PL/pgSQL garantirait qu'un jour les deux versions divergent, sur de l'argent. La base ne
stocke que des lignes ; `computeTotals` reste la seule autorité.

**Aucun flottant ne touche la base** : `bigint` pour les francs, `qty_milli integer` pour les
quantités (« 2,5 heures » se stocke `2500`).

---

## 6. Design système

Extrait du tableau de bord validé. **Toute nouvelle page s'y conforme. Aucun écran ne réinvente
sa propre échelle.**

### 6.1 Règles absolues

1. **Réutiliser avant de créer.** Vérifier `components/ui/` avant d'écrire un composant. Un
   second bouton ou une seconde carte est un bug.
2. **Aucune valeur en dur hors jetons.** Pas de `#hex` ni de `text-[17px]` inventé : tout vient
   de `tailwind.config.ts`. Si un jeton manque, on l'ajoute au thème, on ne le contourne pas.
3. **Tout montant passe par `lib/money.ts`.** Jamais de `toLocaleString`, jamais d'arithmétique
   flottante sur de l'argent.
4. **Toute date passe par `lib/format.ts`.**
5. **Un statut n'est jamais transmis par la couleur seule** — toujours pastille + libellé.
6. **Pas de contrôle mort.** On ne livre pas un interrupteur, un filtre ou un raccourci qui ne
   fait rien. Mieux vaut l'absence que le mensonge.
7. **Jamais de `<select>` ni de `<input type="date">` nus** — ils ouvrent des panneaux du
   système d'exploitation, impossibles à styler : utiliser `Combobox` et `DatePicker`.
8. **Un panneau flottant passe par `Popover`.** Il gère la bascule au-dessus quand la place
   manque, et l'alignement (`stretch` pour un champ, `end` pour un menu).

### 6.2 Couleurs

Neutres **chauds** (teintés de brun/jaune). Un gris froid posé sur le fond crème paraît sale :
ne jamais utiliser `gray-*`, `slate-*`, `zinc-*` de Tailwind.

| Jeton | Hex | Usage |
|---|---|---|
| `paper` | `#FBF8F3` | Fond de l'application |
| `surface` | `#FFFFFF` | Cartes, panneaux, ligne de nav active |
| `sand` | `#F4EFE6` | Sidebar, pistes de contrôles, carrés d'icônes |
| `sand-deep` | `#EDE6D9` | Survol sur `sand`, fond de jauge |
| `line` | `#E8E1D4` | Bordures par défaut |
| `line-strong` | `#D8CFBD` | Bordure au survol |
| `ink` | `#1B1815` | Texte principal |
| `ink-2` | `#5C544A` | Texte secondaire — 7,0:1 sur `paper` |
| `ink-3` | `#7A7064` | Texte atténué — 4,58:1, **plancher AA, ne pas éclaircir** |
| `brand` | `#CE4A14` | Fond de bouton primaire — 4,55:1 avec du blanc |
| `brand-hover` | `#B03D0F` | Survol du bouton primaire, **et couleur de texte obligatoire dès que le fond est `brand-soft`** |
| `brand-bright` | `#E2571F` | Repères graphiques, icône de nav active, anneau de focus. **Jamais sous du texte blanc** (échoue AA) |
| `brand-soft` | `#FDF1EA` | Fond de survol des liens de marque, avatar. Piège : `brand` posé dessus ne donne que **4,11:1** — le texte doit passer en `brand-hover` (5,38:1) |

**Statuts (`status-*`)** — trio `texte` / `-bg` / `-dot`, tous entre 6:1 et 7:1, rendus
exclusivement par `status-badge.tsx` :

| Statut | Texte | Fond | Pastille |
|---|---|---|---|
| `paid` — Payée | `#0B5C43` | `#E6F4EE` | `#12946B` |
| `sent` — Envoyée | `#92400E` | `#FDF0E3` | `#DE8A3A` |
| `draft` — Brouillon | `#57534E` | `#F1ECE2` | `#A89C8B` |
| `overdue` — En retard | `#9B1C1C` | `#FCEBEA` | `#D93A2B` |

Les statuts de devis **réemploient ces mêmes trios** : `accepted` et `converted` en vert,
`refused` en rouge, `expired` en gris. Aucun jeu de couleurs supplémentaire — deux verts
proches seraient indistinguables et n'apprendraient rien de plus.

Ces couleurs sont **réservées aux statuts** : jamais comme couleur de série dans un graphique.

**Rampe `aging-1..4`** — `#E9A06B` → `#D97A34` → `#B4520F` → `#7C3308`. Séquentielle (une
teinte, du clair au foncé) pour les échelles ordonnées. Jamais pour distinguer des catégories
sans ordre.

**Règles graphiques** : magnitude → rampe `aging-*` · deux segments accolés se séparent par un
écart de 2 px en couleur de surface, jamais par un contour · tout segment sous 3:1 avec le fond
porte une **étiquette directe** · le texte ne porte jamais la couleur de la donnée (libellés en
`ink*`, l'identité vient de la pastille) · jamais deux axes verticaux.

### 6.3 Typographie

- **`font-display`** (Archivo) — titres uniquement, via `.type-display`.
- **`font-sans`** (Inter) — tout le reste. Seule des deux à offrir des chiffres tabulaires.

**Échelle fermée — n'inventer aucune autre taille :**

| Rôle | Classe |
|---|---|
| Micro-libellé | `.label-caps` (11px, `tracking-[0.08em]`, `ink-2`) |
| Méta | `text-[11.5px]` |
| Aide | `text-[12.5px]` |
| Contrôle | `text-[13px]` — boutons, liens, champs, navigation |
| Donnée | `text-[13.5px]` — corps de tableau |
| Corps | `text-sm` |
| Titre de bloc | `text-[15px] font-semibold` |
| Valeur de stat | `text-[25px] sm:text-[28px] font-bold tracking-[-0.03em]` |
| Titre de page | `.type-display text-[26px] sm:text-[32px]` |
| Chiffre héros | `.type-display text-[30px] sm:text-[34px]` |

**Tout montant, toute date, tout numéro porte `.tabular`.** Un produit de facturation est fait
de colonnes de chiffres : elles doivent s'aligner. Les grands montants se composent en deux
parties — le nombre en gros corps, l'unité `FCFA` en `text-[12.5px] font-semibold text-ink-3`.

### 6.4 Espacement, rayons, ombres

Espacement en **multiples de 4** uniquement. Page : `px-4 py-6 sm:px-6 lg:px-8`, conteneur
`mx-auto w-full max-w-[1240px]`. Entre sections : `space-y-5`. Entre cartes : `gap-4`.
Intérieur de carte : `p-4 sm:p-5`. En-tête de carte : `px-5 py-4`. Cellule : `px-5 py-3.5`.

Rayons — quatre valeurs : `rounded-lg` (boutons-icônes, liens à fond) · `rounded-[10px]`
(boutons, champs, nav) · `rounded-card` 14px (cartes) · `rounded-full` (badges, pastilles).

Ombres — `shadow-card` (repos) · `shadow-raised` (survol primaire) · `shadow-pop` (tiroir,
panneau flottant). **Toute carte porte `border border-line` : la bordure fait le relief, pas
l'ombre.**

### 6.5 Responsive

| Seuil | Bascule |
|---|---|
| `lg` (1024px) | Sidebar fixe ↔ tiroir coulissant + hamburger |
| `md` (768px) | **Tableau ↔ liste de cartes** — un tableau de plus de 3 colonnes est illisible sur téléphone |
| `sm` (640px) | Grille de statistiques 1 ↔ 2 colonnes |
| `xl` (1280px) | Grille de statistiques 4 colonnes |

Aucun défilement horizontal de page · tout tableau conservé vit dans un `overflow-x-auto` ·
cible tactile minimale **36 × 36 px**.

### 6.6 Animation

Une animation doit porter une information, sinon elle est retirée. Durée maximale **240 ms**.

| Élément | Spécification |
|---|---|
| Bouton | `transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out` + `active:scale-[0.97] active:duration-75` |
| Bouton-icône | idem, avec `active:scale-90` |
| Flèche dans un lien | `transition-transform duration-200 ease-out group-hover:translate-x-0.5` |
| Lien, élément de nav | `transition-colors duration-150` |
| Entrée de page | `animate-fade-in` (240 ms) |
| Tiroir mobile | `animate-slide-in` (220 ms, `cubic-bezier(0.22, 1, 0.36, 1)`) |

Hiérarchie : **75 ms** l'enfoncement — seule animation qui porte vraiment une information, elle
confirme la prise en compte du clic ; **150 ms** couleurs et ombres ; **200–240 ms**
déplacements. Tout `transform` animé s'accompagne de `motion-reduce:transition-none` et
`motion-reduce:active:scale-100`.

**Proscrit** : rebond et `ease-back`, balayage lumineux, dégradé animé, apparition au
défilement, toute durée au-delà de 240 ms. Dans un outil où l'on manipule de l'argent, le
mouvement décoratif sape la crédibilité.

### 6.7 Accessibilité — plancher non négociable

- Texte normal ≥ 4,5:1. `ink-3` est à 4,58:1 : ne pas l'éclaircir.
- **Un contraste se vérifie sur le fond réel, y compris au survol.** Un lien conforme sur
  `surface` peut basculer sous le seuil dès qu'un fond teinté apparaît — c'est exactement ce
  qui est arrivé aux liens de marque (4,11:1 sur `brand-soft`).
- Focus visible partout (`:focus-visible` global en `ring-brand-bright`). Ne jamais poser
  `outline-none` sans remplacement.
- L'information ne passe jamais par la couleur seule.
- Icône décorative → `aria-hidden`. Bouton-icône → libellé en `sr-only`.
- Tableau : `<caption className="sr-only">` et `scope="col"`.
- **Corriger l'ARIA, ne pas le faire taire.** Deux erreurs passées : `aria-invalid` sur un
  bouton (ignoré) et un `role="grid"` qui mentait sur la structure. Remplacés, pas masqués.

---

## 7. Composants et motifs

### 7.1 Inventaire — à réutiliser, pas à redéfinir

| Fichier | Rôle |
|---|---|
| `ui/button.tsx` | `primary` / `secondary` / `ghost`, tailles `sm` / `md`. `buttonClasses()` permet à un `<Link>` de porter la même apparence |
| `ui/icon-button.tsx` | Bouton-icône 36 × 36, tons `neutral` / `brand` / `danger`. `label` **obligatoire** |
| `ui/card.tsx` | `Card`, `CardHeader`, `CardTitle` |
| `ui/status-badge.tsx` | **Seule** façon d'afficher un statut. Couvre factures et devis ; `label` sert à accorder au masculin |
| `ui/popover.tsx` | Panneau flottant `absolute` : bascule au-dessus si la place manque, alignement, clic extérieur, Échap. **Rogné par un ancêtre à `overflow`** |
| `ui/action-menu.tsx` | Menu ⋯ en **portail** (`fixed` sur `document.body`) : le seul qui survive à un `overflow-x-auto`. Se replace au défilement |
| `ui/combobox.tsx` | Sélecteur déroulant, `searchable`, `disabled`. **Remplace `<select>` partout** |
| `ui/date-picker.tsx` | Calendrier. **Remplace `<input type="date">` partout** |
| `ui/dialog.tsx` | `Dialog` et `ConfirmDialog` sur `<dialog>` natif — piège à focus, Échap, inertie gratuits. ⚠️ **Son bouton « Fermer » fait 32 px**, sous le plancher de 36 px du §6.5 — mesuré, non corrigé : il touche toutes les modales |
| `ui/field.tsx` · `input.tsx` · `switch.tsx` · `empty-state.tsx` | Champs et états |
| `layout/logo.tsx` | Marque. **`href` la rend cliquable** ; sans lui elle reste un `<span>` — un logo qui ne mène nulle part ne doit pas se comporter comme un lien. Destination : `/` depuis les écrans d'authentification, `/dashboard` depuis l'application |
| `layout/app-shell.tsx` · `sidebar` · `topbar` | Coquille et navigation. L'action principale de la barre supérieure **suit la section** (`primaryAction`) |
| `dashboard/stat-card.tsx` | Carte de statistique (valeur, unité, jauge, aide) |
| `dashboard/recent-invoices.tsx` | Motif de référence **tableau + bascule liste mobile** |
| `dashboard/receivables-panel.tsx` | Motif de référence **barre empilée + étiquetage direct** |
| `invoices/invoice-preview.tsx` | Aperçu du document. `variant="quote"` bascule les libellés et retire le bloc de règlement |
| `invoices/line-items-editor.tsx` · `totals-summary.tsx` | Saisie des lignes et récapitulatif, partagés facture/devis |
| `invoices/record-payment-dialog.tsx` | Saisie du montant encaissé — le statut en découle |
| `documents/status-menu.tsx` | **Seule** façon de changer un statut depuis une page de détail |
| `documents/document-created-dialog.tsx` · `use-creation-notice.ts` | Confirmation après enregistrement |
| `pdf/download-pdf-button.tsx` | Téléchargement PDF, en bouton plein ou en icône |
| `lib/pdf/build.ts` | `buildInvoicePayload` / `buildQuotePayload` — **seule** façon de composer une charge PDF |

### 7.2 Squelette de page

```tsx
<div className="animate-fade-in space-y-5">
  <header>
    <p className="label-caps">{contexte}</p>
    <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">{titre}</h1>
    <p className="mt-2 text-sm text-ink-2">{sousTitre}</p>
  </header>
  {/* sections en <Card> */}
</div>
```

Routes sous `app/(app)/`, **nommées en français**. Chaque page exporte `metadata`. Une page qui
lit `useSearchParams` **doit** être enveloppée dans `<Suspense>`, sans quoi Next refuse de la
prérendre. Server Component par défaut ; `'use client'` uniquement pour de l'état ou des
gestionnaires. Prévoir systématiquement l'**état vide** — c'est une invitation à agir, pas une
page blanche.

### 7.3 Actions rapides dans une liste

1. **Une seule action contextuelle**, celle que le statut appelle. Un document au bout de sa
   course n'en propose aucune.
2. **Rien ne flotte** — un menu déroulant serait rogné par l'`overflow-x-auto` du tableau.
   ⚠️ **Vrai de `Popover`, faux de `ActionMenu`.** `Popover` se positionne en `absolute` dans
   le flux, donc un ancêtre à `overflow` le découpe. `ui/action-menu.tsx` rend son panneau
   dans un **portail sur `document.body`**, en `fixed` : aucun ancêtre ne peut plus le rogner.
   C'est ce qui permet le menu ⋯ du tableau de bord. La règle reste valable pour tout panneau
   bâti sur `Popover`.
3. **`stopPropagation` sur chaque bouton** : la ligne entière est un raccourci vers le détail.

Sur téléphone, la carte ne peut plus être un `<Link>` enveloppant — un lien ne contient pas de
boutons. Le lien couvre l'en-tête, les actions vivent sur leur rangée sous un filet.

### 7.4 Changement de statut

Par un **menu de transitions**, jamais par une liste déroulante d'états. Une liste déroulante
laisse croire qu'on choisit une valeur ; on déclenche en réalité une opération, qui peut
attribuer un numéro ou solder un encaissement.

- Entrées nommées par ce qu'elles font : **« Marquer comme payée »**, pas « Payée ».
- Les transitions impossibles sont **absentes**, pas grisées.
- Les statuts **dérivés** n'y figurent jamais ; un pied de panneau explique pourquoi.
- Corrections et annulations séparées des avancements par un filet.
- **Un statut qui suppose un montant se saisit par son montant** — `recordPayment` rend
  impossible une facture partiellement payée à zéro franc.

---

## 8. Décisions verrouillées

Prises avec l'utilisateur. **Ne pas les rouvrir sans le lui demander.**

| Sujet | Décision |
|---|---|
| Multi-utilisateur | `companies` + `company_members` avec rôles (phase 3) |
| Périmètre v1 | Paiements partiels, PDF + email, devis, avoirs, relances |
| Devise et TVA | Configurables par entreprise (XAF et 19,25 % par défaut) |
| Modification d'une facture envoyée | **Libre.** Choix explicite de l'utilisateur, contre ma recommandation de la verrouiller |
| Numéro de facture | Attribué **à l'envoi**, pas à la création |
| Devise par facture | Pas de sélecteur — elle vient des paramètres |
| Préfixe de devis | Constante `DEV`, non configurable (contrairement au préfixe de facture, qui porte une contrainte comptable) |

---

## 9. Instructions pour un futur modèle

### Avant d'écrire

1. **Lire ce document en entier.** Il contient des pièges déjà payés une fois.
2. **Chercher le composant existant** avant d'en créer un. Un doublon est un bug.
3. Pour un montant, une date, un statut ou une charge PDF : **passer par le socle**
   (`money.ts`, `format.ts`, `StatusBadge`, `lib/pdf/build.ts`). Ne jamais recalculer à côté.

### Vérifier — obligatoire avant de déclarer terminé

```bash
npx tsc --noEmit && npm run lint && npm run build
```

**Ces trois commandes ne prouvent que la cohérence des types.** Depuis la phase 3, elles
passent même si aucune requête n'atteint la base. Les contrôles qui comptent :

- **Rejouer migrations puis seed** sur une base neuve, sans erreur.
- **Tenter de violer la RLS.** Deux comptes, deux entreprises : le premier ne doit voir ni
  modifier aucune donnée du second. Une politique qu'on n'a pas essayé de contourner n'est
  pas une politique vérifiée.
- **Recharger la page après une écriture.** C'est le seul contrôle qui distingue un vrai
  full-stack d'un état React qui en a l'air.
- **Supprimer un client rattaché à des factures** : le refus doit venir de la base, pas
  seulement du message affiché.
- **Deux envois simultanés** doivent produire deux numéros distincts.

Puis **regarder le rendu, ne pas le supposer.** Le serveur de production se lance détaché
(les tâches de fond du harnais sont tuées en fin de tour) :

```powershell
Start-Process cmd.exe -ArgumentList "/c npm run start > $env:TEMP\xn.log 2>&1" -WindowStyle Hidden
```

Capture d'écran — **passer par PowerShell**, l'accès en écriture est refusé autrement :

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu `
  --hide-scrollbars --virtual-time-budget=6000 --window-size=1440,1100 `
  "--screenshot=<chemin absolu>.png" "http://localhost:3000/<route>"
```

Pour un parcours réel (clics, formulaires, téléchargements), piloter Chrome par CDP via le
`WebSocket` global de Node — sans aucune dépendance. Lancer Chrome avec
`--remote-debugging-port=9222`, puis `Runtime.evaluate`. Pour les téléchargements, utiliser
`Browser.setDownloadBehavior` (`Page.setDownloadBehavior` est obsolète et **silencieusement
ignoré**), et attendre l'apparition du fichier plutôt qu'un délai fixe.

**Vérifier les chiffres à la main.** Contrôle de référence : `2 × 500 000 + 1 × 750 000 +
3 × 120 000` = 2 110 000 HT, TVA 19,25 % = **406 175**, TTC = **2 516 175**. Ces trois nombres
doivent être identiques dans le formulaire, l'aperçu, le détail et le PDF.

### Pièges de cette machine — ne pas les rediagnostiquer

- **Chrome headless impose une largeur minimale d'environ 500 px sous Windows.** Une capture à
  390 px est **recadrée**, pas re-mise en page : tester le mobile à 500 px.
- **Chrome 153 ignore l'URL passée à `PUT /json/new?<url>`** : l'onglet s'ouvre sur
  `about:blank` et y reste. Créer l'onglet vide, puis **naviguer par `Page.navigate`**. Le
  symptôme est trompeur — la connexion CDP réussit, seul le `waitFor` expire.
- **`innerText` ne voit pas la landing.** Ses sections sont masquées par CSS jusqu'à
  l'apparition au défilement (`marketing/reveal.tsx`), et `innerText` ignore ce qui est caché.
  Pour vérifier la page d'accueil en headless, interroger le **DOM** (`textContent`,
  `getAttribute`), jamais le texte rendu.
- **`formatAmount` sépare les milliers par U+202F**, l'espace fine insécable — pas une espace
  ASCII. Un `html.includes('15 000')` tapé au clavier échoue donc sur un montant parfaitement
  correct. Normaliser avant de comparer (`replace(/\s+/g, ' ')` suffit : `\s` couvre U+202F),
  ou comparer sur les octets. Piège payé une fois : le test criait au bug là où le rendu était
  juste.
- **Les heredocs Bash mangent les antislashs** (`\\` devient `\`). Pour tout fichier contenant
  une expression régulière, utiliser l'outil d'écriture, pas `cat > fichier <<'EOF'`. Payé une
  fois de plus le 17 sept. 2026 : un `node -e` de remplacement a inséré un **vrai retour à la
  ligne au milieu d'un littéral regex**, et le script ne se chargeait plus.

  ⚠️ **AGGRAVATION PAYÉE LE 22 sept. 2026 : l'antislash est mangé DEUX fois.** Un script CDP
  écrit par heredoc, dont l'expression est un **littéral gabarit** passé à `Runtime.evaluate` :
  le heredoc retire le premier antislash, le gabarit retire le second. `/\\s+/g` arrive chez
  Chrome en **`/s+/g`** — qui remplace chaque lettre « s » par une espace. Symptôme observé :
  `innerText.includes('Formule choisie')` échouait sur une page qui l'affichait parfaitement,
  pendant que `/Pro/` passait (aucun « s »). **Le test criait au bug là où le rendu était
  juste**, pour la seconde fois de ce document. Ne jamais écrire `\s`, `\d` ou `\w` dans une
  expression destinée à `Runtime.evaluate` : classes explicites (`[ \t\n]`), ou fichier écrit
  par l'outil d'écriture. Contrôle qui tranche en un appel :
  `evaluate(t, "(/\\s+/).source")` doit rendre `\s+`, pas `s+`.
- ⚠️ **`Network.clearBrowserCookies` vide les cookies du NAVIGATEUR ENTIER, pas de l'onglet.**
  Piège coûteux : appelé à l'ouverture de chaque onglet, il supprime la session ouverte dans
  l'onglet précédent. Symptôme observé — la route d'export répondait **401**, et l'assertion
  « la ligne a disparu du fichier » **passait à tort**, puisqu'un message d'erreur ne contient
  évidemment pas l'adresse cherchée. **Toujours vérifier le code HTTP avant de conclure sur le
  contenu d'une réponse.** Purger une seule fois, au début, ou créer un contexte de navigateur
  séparé.
- ⚠️ **`innerText` rend le texte TRANSFORMÉ par CSS.** `.type-display` et `.label-caps`
  passent en capitales : `innerText.includes('Lien incomplet')` échoue sur une page qui affiche
  correctement « LIEN INCOMPLET ». Comparer sans tenir compte de la casse, ou interroger le DOM.
- **La première invocation d'une Server Action sur un serveur fraîchement démarré compile à
  froid** : un test qui n'attend que 3 s conclut à un bouton mort. Précharger la route, ou
  attendre par condition plutôt que par délai fixe.
- Écrire une capture d'écran depuis Bash échoue en « Accès refusé » : passer par PowerShell.
- En développement, Next compile chaque route au premier accès (~25 s) : `curl -m 90` avant de
  conclure qu'un serveur est en panne.
- Un `.next` corrompu produit des erreurs sur des pages intactes — `rm -rf .next` avant
  d'enquêter plus loin.
- **CAUSE ÉLUCIDÉE (4 sept. 2026) — c'est Internet Download Manager, pas l'application.**
  Chromium annulait sur cette machine tout téléchargement de PDF servi en local : `fetch`
  recevait un **204 sans corps**, un téléchargement natif passait par `downloadWillBegin`
  puis `canceled`, 0 octet. Le coupable est l'**« Advanced Integration » d'IDM** (`IDMan.exe`),
  qui détourne les réponses `application/pdf` au niveau du réseau. La preuve est dans le
  `statusText` de la réponse, visible uniquement par CDP `Network.responseReceived` :

  ```
  ← réponse 204 « Intercepted by the IDM Advanced Integration » | protocole http/1.0
  ```

  Cela explique pourquoi `--disable-extensions` n'y changeait rien : l'intégration avancée
  n'est pas une extension, elle s'accroche sous le navigateur et s'applique donc même à un
  profil neuf et au mode headless.

  **Conséquences pratiques.** La route `/api/factures/[id]/pdf` est saine : en curl avec le
  cookie de session elle rend **200, ~4,8 ko, `Content-Disposition` correct, en ~2,7 s**.
  Pour vérifier un PDF sur cette machine, **utiliser curl avec le cookie de session** (le
  récupérer par CDP `Network.getCookies`), puis extraire le texte. Pour un essai dans le
  navigateur, arrêter `IDMan.exe` au préalable. Le garde-fou de `use-pdf-download.ts`
  (`blob.size === 0`) fait son travail : l'utilisateur voit « Le document reçu est vide »
  au lieu d'enregistrer un fichier de zéro octet.

  ⚠️ Le commentaire des lignes 34–41 de `lib/pdf/use-pdf-download.ts` attribue encore ce 204
  au « gestionnaire de téléchargement de Chromium ». C'est faux — il vise IDM. `Content-
  Disposition` a été **formellement mis hors de cause** : réponse fabriquée en même origine
  par CDP `Fetch.fulfillRequest`, corps identique, avec et sans l'en-tête — les deux
  arrivent intactes à `fetch`.
- **Une erreur d'authentification Supabase ne doit jamais remonter telle quelle** : elle est
  en anglais. `translateAuthError` retombe désormais sur une phrase française générique.

### Honnêteté

- **Un contrôle qui échoue est un fait à rapporter**, pas une gêne à contourner. Si un test
  échoue parce que le test se trompe, le dire et corriger le test — c'est arrivé plusieurs fois.
- Ne pas annoncer « vérifié » ce qui n'a pas été exécuté.
- Un doute sur un calcul se lève en le refaisant, pas en le supposant. Mon arithmétique
  mentale s'est déjà trompée là où le code avait raison.

### Tenir ce document à jour

Une décision structurante, un piège résolu, un composant partagé : **ils viennent ici**. Un
document faux est pire qu'un document absent.
