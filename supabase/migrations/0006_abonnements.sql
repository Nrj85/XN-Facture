-- ============================================================================
-- 0006 — Abonnements à XN-Facture
--
-- La grille tarifaire de la page d'accueil vendait trois formules qui
-- n'existaient nulle part : pas de colonne, pas de table, aucune limite
-- appliquée. Ce fichier fait exister la formule ; il ne l'applique pas encore.
--
-- ⚠️ POURQUOI UNE TABLE À PART, ET PAS UNE COLONNE SUR `companies`.
-- `companies_update` (0003_rls.sql) autorise un membre à modifier n'importe
-- quelle colonne de SON entreprise. Une colonne `plan` y serait donc
-- modifiable par son propre titulaire : un appel REST direct suffirait à
-- s'offrir la formule Pro. La formule vit dans `subscriptions`, qui n'a
-- AUCUNE politique d'écriture — c'est la protection principale, exactement
-- comme `platform_admins`.
-- ============================================================================

create type public.plan_code as enum ('discovery', 'pro', 'business');

-- --- La formule en cours -----------------------------------------------------

create table public.subscriptions (
  company_id uuid primary key references public.companies(id) on delete cascade,

  plan       public.plan_code not null default 'discovery',

  -- Date civile, comme toute date métier du projet : une échéance au 8 janvier
  -- se lit le 8 janvier à Douala comme à Paris. `null` pour Découverte, qui
  -- n'expire pas.
  expires_at date,

  -- La formule choisie sur la grille tarifaire, avant tout paiement. Elle
  -- n'accorde RIEN : elle dit seulement ce que la personne est venue chercher.
  requested  public.plan_code,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- --- Le journal des paiements d'abonnement -----------------------------------
--
-- Un journal, pas un cumul. `invoices.amount_paid` est un total sans mémoire :
-- il ne sait dire ni qui a payé, ni quand, ni sous quelle référence — donc il
-- ne sait pas refuser un doublon. Ici chaque encaissement est une ligne.

create table public.subscription_payments (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,

  plan               public.plan_code not null,

  -- Entier de francs, comme partout : le FCFA n'a pas de centimes.
  amount             bigint not null check (amount > 0),
  currency           public.currency_code not null default 'XAF',

  channel            text not null,   -- 'mtn_momo', 'orange_money', 'bank', ...
  provider           text not null,   -- l'agrégateur qui a encaissé
  provider_reference text not null,

  status             text not null
                       check (status in ('pending', 'succeeded', 'failed')),

  period_start       date,
  period_end         date,

  created_at         timestamptz not null default now(),

  -- ⚠️ L'IDEMPOTENCE TIENT ICI, ET NULLE PART AILLEURS.
  -- Un webhook est rejoué : sans cette contrainte, un paiement rejoué crédite
  -- deux fois. C'est la base qui refuse, pas le code applicatif.
  constraint subscription_payments_reference_unique
    unique (provider, provider_reference)
);

create index subscription_payments_company_idx
  on public.subscription_payments (company_id, created_at desc);

-- --- Toute entreprise a une formule ------------------------------------------
--
-- Par déclencheur plutôt qu'en modifiant `create_company_for_current_user` :
-- lui ajouter un paramètre aurait créé une seconde fonction de même nom, et
-- tout appel à deux arguments serait devenu ambigu.

create or replace function public.create_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.subscriptions (company_id) values (new.id)
  on conflict (company_id) do nothing;
  return new;
end;
$fn$;

create trigger companies_default_subscription
  after insert on public.companies
  for each row execute function public.create_default_subscription();

-- Rattrapage des entreprises déjà créées.
insert into public.subscriptions (company_id)
select id from public.companies
on conflict (company_id) do nothing;

-- --- Politiques ---------------------------------------------------------------

alter table public.subscriptions         enable row level security;
alter table public.subscription_payments enable row level security;

-- Lecture seule pour les membres. On voit sa formule et ses paiements.
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.is_company_member(company_id));

create policy subscription_payments_select on public.subscription_payments
  for select to authenticated
  using (public.is_company_member(company_id));

-- ⚠️ AUCUNE politique d'insertion, de mise à jour ou de suppression.
-- Ce n'est pas un oubli. Accorder la formule est une décision qui appartient
-- au webhook de paiement, jamais au client : celui-ci s'accorderait Pro.
-- Le webhook écrira depuis une Edge Function Supabase, qui détient
-- `service_role` dans SON environnement — la clé ne va pas sur Vercel.
-- Le seul écrit ouvert au client est `requested`, par la fonction ci-dessous,
-- et il n'accorde rien.

-- Administrateurs de plateforme : lecture seule, politiques AJOUTÉES,
-- même motif qu'en 0004_admin.sql. Il s'agit ici de votre propre chiffre
-- d'affaires : le voir est légitime.
create policy subscriptions_admin_select on public.subscriptions
  for select to authenticated
  using (public.is_platform_admin());

create policy subscription_payments_admin_select on public.subscription_payments
  for select to authenticated
  using (public.is_platform_admin());

-- --- Enregistrer la formule demandée -----------------------------------------
--
-- `security definer` parce que la table n'a pas de politique d'écriture. La
-- fonction n'écrit QUE `requested`, et toujours sur l'entreprise de l'appelant :
-- elle ne prend pas d'identifiant d'entreprise en paramètre, il n'y a donc rien
-- à falsifier.

create or replace function public.request_plan(p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_company uuid := public.current_company_id();
begin
  if v_company is null then
    raise exception 'Aucune entreprise pour ce compte.' using errcode = '42501';
  end if;

  if p_plan is null or p_plan not in ('discovery', 'pro', 'business') then
    raise exception 'Formule inconnue.' using errcode = '22023';
  end if;

  update public.subscriptions
  set requested = p_plan::public.plan_code
  where company_id = v_company;
end;
$fn$;

revoke all on function public.request_plan(text) from public;
grant execute on function public.request_plan(text) to authenticated;
