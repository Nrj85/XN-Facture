-- =============================================================================
-- XN-Facture — schéma de base
-- =============================================================================
-- Règles portées par ce fichier, et pourquoi :
--
--   * Aucun total n'est stocké ni calculé ici. Les lignes sont la seule source
--     de vérité ; computeTotals (TypeScript) est la seule autorité de calcul.
--     Réécrire l'arrondi en PL/pgSQL garantirait qu'un jour les deux versions
--     divergent — sur de l'argent.
--   * Aucun flottant ne touche un montant : bigint pour les francs, integer en
--     millièmes pour les quantités.
--   * Les dates métier sont des date, jamais des timestamptz : une facture
--     émise le 8 janvier s'affiche le 8 janvier à Douala comme à Paris.
--   * Les statuts dérivés (« en retard », « expiré », « facturé ») ne sont PAS
--     des colonnes. Ils se déduisent, donc ils ne se stockent pas.
-- =============================================================================

create extension if not exists pgcrypto;

-- --- Types -------------------------------------------------------------------

create type public.invoice_status as enum
  ('draft', 'sent', 'partially_paid', 'paid', 'cancelled');

create type public.quote_status as enum
  ('draft', 'sent', 'accepted', 'refused');

-- XAF (BEAC) et XOF (BCEAO) sont toutes deux sans subdivision.
create type public.currency_code as enum ('XAF', 'XOF');

create type public.member_role as enum ('owner', 'admin', 'member');

create type public.document_kind as enum ('invoice', 'quote');

-- --- Horodatage --------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- --- Entreprises -------------------------------------------------------------

create table public.companies (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  legal_name         text not null,

  -- Mentions légales : obligatoires sur une facture au Cameroun et dans la
  -- zone CEMAC. Non nulles, mais autorisées vides le temps que l'utilisateur
  -- renseigne ses paramètres.
  niu                text not null default '',
  rccm               text not null default '',

  address            text not null default '',
  city               text not null default '',
  country            text not null default 'Cameroun',
  phone              text not null default '',
  email              text not null default '',

  -- Data URL redimensionnée à 256 px par le téléversement. Un passage à
  -- Supabase Storage serait préférable (le logo est relu à chaque lecture de
  -- l'entreprise) : dette assumée, consignée dans CLAUDE.md.
  logo_data_url      text,

  currency           public.currency_code not null default 'XAF',
  vat_rate           numeric(5,2) not null default 19.25
                       check (vat_rate >= 0 and vat_rate <= 100),
  payment_terms_days smallint not null default 30
                       check (payment_terms_days between 0 and 365),
  invoice_prefix     text not null default 'FAC'
                       check (invoice_prefix ~ '^[A-Z0-9-]{2,10}$'),
  default_notes      text,

  bank_name          text,
  bank_account       text,
  momo_mtn           text,
  momo_orange        text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();

-- --- Appartenance ------------------------------------------------------------

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_idx on public.company_members (user_id);

-- --- Clients -----------------------------------------------------------------

create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0),
  contact_name text,
  email        text not null default '',
  phone        text not null default '',
  address      text,
  city         text not null default '',
  created_at   timestamptz not null default now()
);

create index clients_company_idx on public.clients (company_id);

-- --- Factures ----------------------------------------------------------------

create table public.invoices (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,

  -- NULL tant que la facture est un brouillon : un brouillon ne consomme pas
  -- de numéro, ce qui évite les trous dans la séquence.
  number      text,

  -- restrict, PAS cascade : supprimer un client rattaché à des factures
  -- détruirait de la comptabilité. La règle cesse d'être une convention
  -- JavaScript pour devenir une contrainte que rien ne peut contourner.
  client_id   uuid not null references public.clients(id) on delete restrict,

  issue_date  date not null,
  due_date    date not null,

  -- Figé sur la facture : changer le taux dans les paramètres ne doit pas
  -- réécrire le montant d'une facture déjà émise.
  vat_rate    numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),

  address     text not null default '',
  notes       text,
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  status      public.invoice_status not null default 'draft',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint invoices_due_after_issue check (due_date >= issue_date),

  -- Une facture émise porte forcément un numéro. La règle « le numéro est
  -- attribué à l'envoi » devient vérifiable par la base.
  constraint invoices_issued_has_number check (status = 'draft' or number is not null)
);

-- Partiel : les brouillons (number NULL) ne se gênent pas entre eux.
create unique index invoices_number_unique
  on public.invoices (company_id, number) where number is not null;

create index invoices_company_idx on public.invoices (company_id);
create index invoices_client_idx  on public.invoices (client_id);

create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

create table public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  position    smallint not null check (position >= 0),
  description text not null,

  -- Millièmes ENTIERS : « 2,5 heures » se stocke 2500. Aucun flottant ne
  -- touche la base.
  qty_milli   integer not null check (qty_milli > 0),
  unit_price  bigint not null check (unit_price >= 0),

  unique (invoice_id, position)
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

-- --- Devis -------------------------------------------------------------------

create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  number      text,
  client_id   uuid not null references public.clients(id) on delete restrict,

  issue_date  date not null,
  -- Durée de validité, et non échéance de règlement : rien n'est encore dû.
  valid_until date not null,

  vat_rate    numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  address     text not null default '',
  notes       text,
  status      public.quote_status not null default 'draft',

  -- Renseigné dès que le devis a produit une facture. C'est ce verrou qui
  -- empêche de facturer deux fois la même prestation.
  invoice_id  uuid references public.invoices(id) on delete set null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint quotes_valid_after_issue check (valid_until >= issue_date),
  constraint quotes_issued_has_number check (status = 'draft' or number is not null)
);

create unique index quotes_number_unique
  on public.quotes (company_id, number) where number is not null;

-- Deux devis ne peuvent pas revendiquer la même facture.
create unique index quotes_invoice_unique
  on public.quotes (invoice_id) where invoice_id is not null;

create index quotes_company_idx on public.quotes (company_id);
create index quotes_client_idx  on public.quotes (client_id);

create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

create table public.quote_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes(id) on delete cascade,
  position    smallint not null check (position >= 0),
  description text not null,
  qty_milli   integer not null check (qty_milli > 0),
  unit_price  bigint not null check (unit_price >= 0),
  unique (quote_id, position)
);

create index quote_items_quote_idx on public.quote_items (quote_id);

-- --- Compteurs de numérotation ----------------------------------------------
-- En mémoire, le numéro suivant se déduisait d'un balayage du tableau. Avec
-- une base et deux utilisateurs, deux envois simultanés obtiendraient le même
-- numéro. Ce compteur rend l'attribution atomique.

create table public.document_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  kind       public.document_kind not null,
  year       smallint not null,
  last_value integer not null default 0 check (last_value >= 0),
  primary key (company_id, kind, year)
);
