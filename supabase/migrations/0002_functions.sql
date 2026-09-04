-- =============================================================================
-- XN-Facture — fonctions
-- =============================================================================
-- Ces trois fonctions sont en `security definer`, c'est-à-dire qu'elles
-- s'exécutent avec les droits de leur propriétaire et contournent la RLS.
-- C'est délibéré et nécessaire dans les trois cas, mais chacune re-vérifie
-- elle-même les droits : une fonction qui contourne la RLS sans contrôler ce
-- qu'elle fait est une porte ouverte.
--
-- `set search_path = public` n'est pas décoratif : sans lui, un appelant
-- pourrait interposer un schéma et détourner la résolution des noms de table.
-- =============================================================================

-- --- Appartenance ------------------------------------------------------------
-- Raison d'être : une politique RLS posée SUR company_members qui interrogerait
-- company_members provoque une récursion infinie. C'est le piège classique de
-- Supabase. En passant par une fonction `security definer`, le test
-- d'appartenance échappe à la RLS et la récursion disparaît.

create or replace function public.is_company_member(p_company uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select exists (
    select 1
    from public.company_members
    where company_id = p_company
      and user_id = auth.uid()
  );
$fn$;

-- --- Entreprise courante -----------------------------------------------------
-- L'application est mono-entreprise à l'usage : on retient la plus ancienne
-- appartenance. Le jour où l'on basculera d'une entreprise à l'autre, c'est
-- ici que se posera le choix, et nulle part ailleurs.

create or replace function public.current_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $fn$
  select company_id
  from public.company_members
  where user_id = auth.uid()
  order by created_at, company_id
  limit 1;
$fn$;

-- --- Numérotation atomique ---------------------------------------------------
-- `insert ... on conflict ... do update ... returning` s'exécute en une seule
-- instruction : deux envois simultanés obtiennent nécessairement deux valeurs
-- distinctes, sans verrou explicite ni transaction sérialisable.
--
-- Un rollback laisse un trou dans la séquence. C'est le prix de l'atomicité,
-- et il est très inférieur au risque de deux factures partageant un numéro.

create or replace function public.next_document_number(
  p_company uuid,
  p_kind    public.document_kind,
  p_prefix  text,
  p_year    smallint
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_next integer;
begin
  -- La fonction contourne la RLS : le contrôle d'accès doit être fait ici.
  if not public.is_company_member(p_company) then
    raise exception 'Accès refusé à cette entreprise.' using errcode = '42501';
  end if;

  if p_prefix !~ '^[A-Z0-9-]{2,10}$' then
    raise exception 'Préfixe invalide : %', p_prefix using errcode = '22023';
  end if;

  insert into public.document_counters (company_id, kind, year, last_value)
  values (p_company, p_kind, p_year, 1)
  on conflict (company_id, kind, year)
  do update set last_value = public.document_counters.last_value + 1
  returning last_value into v_next;

  return p_prefix || '-' || p_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$fn$;

-- --- Création d'entreprise à l'inscription -----------------------------------
-- L'entreprise et l'appartenance sont créées dans la MÊME transaction. Un
-- compte sans entreprise serait un cul-de-sac : l'utilisateur se retrouverait
-- connecté, sans rien pouvoir lire ni écrire, et sans moyen de s'en sortir.

create or replace function public.create_company_for_current_user(
  p_name       text,
  p_legal_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Le nom de l''entreprise est obligatoire.' using errcode = '22023';
  end if;

  -- Un compte, une entreprise : on ne recrée pas si l'utilisateur en a déjà une.
  select company_id into v_id
  from public.company_members
  where user_id = v_user
  order by created_at, company_id
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.companies (name, legal_name)
  values (
    btrim(p_name),
    coalesce(nullif(btrim(p_legal_name), ''), btrim(p_name))
  )
  returning id into v_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_id, v_user, 'owner');

  return v_id;
end;
$fn$;

-- --- Droits d'exécution ------------------------------------------------------
-- Par défaut, PostgreSQL accorde l'exécution à `public`, ce qui inclut le rôle
-- anonyme. On restreint aux comptes authentifiés.

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.current_company_id() from public;
revoke all on function public.next_document_number(uuid, public.document_kind, text, smallint) from public;
revoke all on function public.create_company_for_current_user(text, text) from public;

grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.next_document_number(uuid, public.document_kind, text, smallint) to authenticated;
grant execute on function public.create_company_for_current_user(text, text) to authenticated;
