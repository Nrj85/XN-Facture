-- =============================================================================
-- XN-Facture — Papier à en-tête de l'entreprise
-- =============================================================================
-- Retour client remonté par l'utilisateur le 1er oct. 2026 : *« beaucoup
-- d'entreprises ont leur propre papier à en-tête »* et veulent l'utiliser pour
-- leurs factures. Deux situations réelles, et elles n'ont pas la même réponse :
--
--   `preprinted`  l'entreprise IMPRIME sur du papier physique déjà imprimé.
--                 Rien à téléverser : le document doit seulement s'effacer et
--                 laisser le blanc nécessaire en haut et en bas.
--   `image`       l'entreprise a son en-tête en fichier. Il est dessiné sur
--                 chaque page du PDF — c'est le seul mode qui tienne quand la
--                 facture part par WhatsApp ou par email, cas courant ici.
--
-- Dans les DEUX cas, le document génère aujourd'hui ce que le papier porte
-- déjà : logo, bloc « Émetteur », pied de page légal. Il doit donc s'écarter,
-- sans quoi tout serait imprimé deux fois, l'un sur l'autre.
--
-- ⚠️ **L'IMAGE NE VIT PAS SUR `companies`, ET C'EST LA DÉCISION
-- STRUCTURANTE.** `getSession()` fait un `select('*')` sur cette table **à
-- chaque chargement de page**, et le résultat traverse `CompanyProvider`
-- jusqu'aux composants. Une image de page entière y pèse des centaines de
-- kilo-octets : elle serait relue et transportée à chaque visite de chaque
-- membre, pour n'être utile qu'au PDF et à l'écran de réglage. Le projet
-- signale déjà `logo_data_url` (~50 ko) comme une dette ; ce serait la même
-- dette multipliée par dix.
--
-- D'où la séparation : les RÉGLAGES (quelques octets) restent sur `companies`
-- parce que l'aperçu et le PDF doivent les connaître partout ; l'IMAGE vit dans
-- `company_letterheads`, lue seulement là où elle sert.
-- =============================================================================

begin;

-- --- Réglages, sur `companies` : minuscules, donc sans conséquence ----------
alter table public.companies
  add column if not exists letterhead_mode text not null default 'none',
  add column if not exists letterhead_top_mm integer not null default 45,
  add column if not exists letterhead_bottom_mm integer not null default 25,
  add column if not exists letterhead_keep_legal boolean not null default true;

-- `none` par défaut : **aucune entreprise existante ne change d'apparence.**
-- Même discipline qu'à la migration 0014 pour la TVA — une facture déjà émise
-- est une pièce remise à un client, et un réglage neuf ne doit jamais la
-- modifier rétroactivement.
alter table public.companies
  add constraint companies_letterhead_mode_valide
  check (letterhead_mode in ('none', 'preprinted', 'image'));

-- ⚠️ **LES MARGES SONT EN MILLIMÈTRES, PAS EN POINTS.** On mesure son papier
-- avec une règle ; personne ne connaît la hauteur de son en-tête en points
-- PostScript. La conversion (× 72 ÷ 25,4) est faite au rendu, dans
-- `invoice-document.tsx`, et nulle part ailleurs.
--
-- Les bornes ne sont pas décoratives : une A4 fait 297 mm de haut. Réserver
-- 150 mm en haut ne laisserait pas la place d'un tableau de lignes, et le
-- document deviendrait illisible sans que rien ne l'ait signalé.
alter table public.companies
  add constraint companies_letterhead_marges_raisonnables
  check (letterhead_top_mm between 0 and 120 and letterhead_bottom_mm between 0 and 80);

comment on column public.companies.letterhead_mode is
  'none | preprinted (papier physique, on réserve l''espace) | image (en-tête dessiné sur le PDF)';
comment on column public.companies.letterhead_keep_legal is
  'Garder la ligne légale en pied de page (raison sociale, RCCM, NIU) même sous en-tête. Vrai par défaut : une facture sans ces mentions n''est pas conforme, et rien ne garantit que le papier les porte.';

-- --- L'image, dans sa propre table ------------------------------------------
create table if not exists public.company_letterheads (
  -- Clé primaire = clé étrangère : **un seul en-tête par entreprise**, garanti
  -- par le schéma plutôt que par du code. `on delete cascade` parce que cette
  -- image n'a aucun sens sans son entreprise — contrairement au journal
  -- d'activité, qui survit délibérément à ce qu'il trace.
  company_id uuid primary key references public.companies(id) on delete cascade,

  -- ⚠️ **MÊME LISTE BLANCHE QUE LE LOGO, ET POUR LA MÊME RAISON — le SSRF du
  -- 26 sept. 2026.** Cette valeur finit dans `<Image src={…} />` de
  -- `@react-pdf`, qui **va chercher une URL distante depuis le serveur**. Si
  -- l'on acceptait autre chose qu'une image en ligne, on rouvrirait exactement
  -- la faille refermée par `logoDataUrlSchema`. `image/svg+xml` reste exclu :
  -- un SVG est un document, il porte du script.
  data_url text not null
    check (data_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'),

  -- Une page A4 à 150 ppp pèse quelques centaines de ko une fois encodée. Le
  -- plafond borne ce qu'un appel direct peut faire écrire : sans lui, rien
  -- n'empêcherait d'y déposer plusieurs mégaoctets, relus à chaque PDF.
  check (char_length(data_url) <= 2 * 1024 * 1024),

  updated_at timestamptz not null default now()
);

create trigger company_letterheads_touch
  before update on public.company_letterheads
  for each row execute function public.touch_updated_at();

alter table public.company_letterheads enable row level security;

-- Mêmes politiques que le reste des données d'entreprise : `is_company_member`
-- décide, et rien d'autre. Toutes `to authenticated` — aucun visiteur anonyme
-- n'a de raison de lire le papier à en-tête de qui que ce soit.
create policy company_letterheads_select
  on public.company_letterheads for select to authenticated
  using (public.is_company_member(company_id));

create policy company_letterheads_insert
  on public.company_letterheads for insert to authenticated
  with check (public.is_company_member(company_id));

create policy company_letterheads_update
  on public.company_letterheads for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy company_letterheads_delete
  on public.company_letterheads for delete to authenticated
  using (public.is_company_member(company_id));

-- Lecture pour les administrateurs de plateforme, comme les huit politiques
-- `*_admin_select` de 0004 : **ajoutée**, jamais fondue dans celle du membre.
create policy company_letterheads_admin_select
  on public.company_letterheads for select to authenticated
  using (public.is_platform_admin());

comment on table public.company_letterheads is
  'Image du papier à en-tête, une par entreprise. SÉPARÉE de `companies` : getSession() y fait un select(*) à chaque page, et une image de page entière y serait transportée à chaque visite.';

commit;
