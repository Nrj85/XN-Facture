# XN-Facture — mémoire du projet

Document de référence unique. Il est chargé à chaque session : **le lire avant de toucher au
code**, et le mettre à jour quand une décision structurante est prise. Les sections 1 à 4
décrivent ce qui existe ; les sections 5 à 8 disent pourquoi c'est ainsi ; la section 9 explique
comment travailler ici.

**Interface entièrement en français** — libellés, messages, et commentaires de code.

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

Deux comptes de démonstration existent, créés par l'API d'administration (donc déjà confirmés,
sans passer par l'email) : `atelier@example.com`, rattaché à Atelier Nkolo, et
`concurrent@example.com`, sans entreprise — il sert à rejouer les tests de RLS.

> **Les mots de passe ne figurent pas ici : ce dépôt est public.** Ils ont été transmis
> directement à l'utilisateur ; en cas de perte, les réinitialiser depuis le tableau de bord
> Supabase (Authentication > Users). **Supprimer ces deux comptes avant toute mise en ligne.**

Phases restantes : **5** envoi par email, lien public, avoirs, relances · **6** page d'accueil
publique · **7** tests de bout en bout, sécurité, déploiement Vercel.

### Ce qui reste à régler côté Supabase

- ~~Aucun SMTP propre~~ — **réglé le 4 sept. 2026 : Resend est branché**, voir « Envoi des
  emails » en section 2. `mailer_autoconfirm` reste à `false`, ce qui est le bon réglage
  maintenant que les emails partent réellement.
- **Aucun domaine n'est vérifié chez Resend.** L'expéditeur d'essai `onboarding@resend.dev` ne
  délivre qu'à l'adresse propriétaire du compte Resend : **`/inscription` ne mène toujours
  nulle part pour un vrai utilisateur.** C'est le dernier verrou avant l'ouverture au public,
  et il se lève avec trois enregistrements DNS.
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

### Paramètres — `/parametres`
Quatre sections — Identité (dont téléversement du logo, redimensionné à 256 px avant stockage),
Coordonnées, Facturation (devise, taux de TVA, délai de règlement, préfixe, mention par
défaut), Encaissement (banque, compte, MTN MoMo, Orange Money). Suivi des modifications non
enregistrées, validation, réinitialisation. Tout se répercute immédiatement sur les nouveaux
documents ; **les documents existants gardent leur propre taux de TVA**.

### PDF
Génération serveur — `GET /api/factures/[id]/pdf` et `GET /api/devis/[id]/pdf` — avec logo,
mentions légales, bloc de règlement, pagination. Le document est **relu en base sous RLS** :
il ne peut plus être fabriqué pour une facture qui n'est pas la vôtre. Un brouillon porte la
mention **BROUILLON — NON ÉMISE** et se télécharge sous `Brouillon-<client>.pdf` ; un document
émis prend son numéro.

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
| `smtp_admin_email` | `onboarding@resend.dev` — **expéditeur d'essai** |
| `smtp_sender_name` | `XN-Facture` |
| `rate_limit_email_sent` | 30/h (était 2) |
| `uri_allow_list` | `http://localhost:3000/**` |
| Gabarits | Français : `recovery`, `confirmation`, `password_changed_notification` |

**Les gabarits pointent sur `{{ .TokenHash }}`, pas sur `{{ .ConfirmationURL }}`.** Le lien va
donc directement à l'application et ne dépend d'aucun cookie : il s'ouvre depuis n'importe
quel appareil. Avec `ConfirmationURL` on héritait du flux PKCE, qui exige d'ouvrir le lien
dans le navigateur ayant fait la demande — intenable quand on demande depuis Chrome mobile et
qu'on ouvre le message dans l'application Gmail, c'est-à-dire le cas courant ici.

⚠️ **Deux limites à lever avant l'ouverture au public :**

1. **Aucun domaine n'est vérifié chez Resend.** L'expéditeur `onboarding@resend.dev` ne livre
   qu'à l'adresse propriétaire du compte Resend. Tout autre destinataire est rejeté.
   Vérifier un domaine, puis remplacer `smtp_admin_email`.
2. **`site_url` vaut `http://localhost:3000`**, donc les liens envoyés ne fonctionnent que sur
   cette machine. À changer au déploiement, avec `NEXT_PUBLIC_SITE_URL` et `uri_allow_list`.

**Vérifié de bout en bout**, et non supposé : demande depuis `/mot-de-passe-oublie` → journal
Resend `statut=delivered` vers la boîte réelle, sujet « Réinitialisez votre mot de passe —
XN-Facture », expéditeur `"XN-Facture" <onboarding@resend.dev>` → lien du gabarit rendu avec
un vrai jeton et suivi → `/nouveau-mot-de-passe`, compte reconnu.

### Déploiement Vercel — `xn-facture.vercel.app`

Dépôt **`github.com/Nrj85/XN-Facture`**, branche `main`, déployée automatiquement. **En ligne
et vérifié le 4 sept. 2026** : connexion, destination mémorisée par `?suite=`, tableau de bord
et factures lus depuis Supabase, lien « Mot de passe oublié ? » fonctionnel.

**Trois variables, et seulement trois** — toutes en type **Config**, sur *All Environments* :

```
NEXT_PUBLIC_SUPABASE_URL       https://tpzmmgcfpnsysaghdqrx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  (208 caractères)
NEXT_PUBLIC_SITE_URL           https://xn-facture.vercel.app
```

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
  seed.sql                      Jeu de démonstration, rejouable

app/
  layout.tsx                    Polices auto-hébergées, <html lang="fr">
  (auth)/connexion|inscription|bienvenue/
  (auth)/mot-de-passe-oublie/   Demande du lien de réinitialisation
  (auth)/nouveau-mot-de-passe/  Choix du nouveau mot de passe (session déjà ouverte)
  (app)/layout.tsx              requireSession + CompanyProvider + AppShell
  (app)/dashboard|factures|devis|clients|parametres|paiements|rapports|aide/
  api/auth/confirmation         GET, jeton d'email → session (hors middleware)
  api/factures/[id]/pdf         GET, lit la base (runtime Node)
  api/devis/[id]/pdf            GET, idem
  fonts/                        archivo-latin.woff2, inter-latin.woff2
  globals.css                   Classes .type-display .label-caps .tabular, reduced-motion

components/
  ui/          Primitives : button, icon-button, card, input, field, switch, combobox,
               date-picker, dialog, popover, status-badge, empty-state
  layout/      app-shell, sidebar, topbar, logo, page-placeholder
  auth/        auth-card (enveloppe commune), sign-in-form, sign-up-form,
               create-company-form, forgot-password-form, reset-password-form
  dashboard/   dashboard-view, dashboard-filters, stat-card, recent-invoices,
               receivables-panel
  invoices/    invoice-form, invoice-list, invoice-detail, invoice-editor, invoice-preview,
               line-items-editor, totals-summary, invoice-quick-actions,
               record-payment-dialog, download-invoice-button
  quotes/      quote-form, quote-list, quote-detail, quote-editor, quote-quick-actions
  clients/     client-list
  settings/    settings-form, logo-uploader
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
  actions/          auth, company, clients, invoices, quotes · result, schemas, context
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
| `ui/popover.tsx` | Panneau flottant : bascule au-dessus si la place manque, alignement, clic extérieur, Échap |
| `ui/combobox.tsx` | Sélecteur déroulant, `searchable`, `disabled`. **Remplace `<select>` partout** |
| `ui/date-picker.tsx` | Calendrier. **Remplace `<input type="date">` partout** |
| `ui/dialog.tsx` | `Dialog` et `ConfirmDialog` sur `<dialog>` natif — piège à focus, Échap, inertie gratuits |
| `ui/field.tsx` · `input.tsx` · `switch.tsx` · `empty-state.tsx` | Champs et états |
| `layout/app-shell.tsx` · `sidebar` · `topbar` · `logo` | Coquille et navigation. L'action principale de la barre supérieure **suit la section** (`primaryAction`) |
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
- **Les heredocs Bash mangent les antislashs** (`\\` devient `\`). Pour tout fichier contenant
  une expression régulière, utiliser l'outil d'écriture, pas `cat > fichier <<'EOF'`.
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
