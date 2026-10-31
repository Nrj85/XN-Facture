-- =============================================================================
-- XN-Facture — 0025 : d'où viennent les inscrits ?
-- =============================================================================
-- Demande de l'utilisateur, 29 oct. 2026, pour la campagne de lancement du
-- 16 nov. au 15 déc. : savoir quel canal amène les inscriptions (un comptable
-- partenaire, une publicité, un post), et donner à chaque comptable un lien à
-- son nom — `xn-facture.com/?ref=cabinet-ndoumbe`.
--
-- Le parcours : le middleware garde dans un cookie le PREMIER `?ref=` ou
-- `utm_*` vu par le navigateur ; `createCompany` (et l'inscription directe) le
-- transmettent à `record_acquisition` une fois l'entreprise créée. Une
-- inscription par Google passe par `/bienvenue`, donc par `createCompany` :
-- les deux chemins sont couverts par le même appel.
--
-- ⚠️ **CETTE DONNÉE N'ACCORDE RIEN.** Une source est déclarée par le navigateur
-- de l'inscrit, donc falsifiable : quelqu'un peut se dire venu de n'importe quel
-- cabinet. C'est sans conséquence tant qu'elle ne sert qu'à compter. **Le jour
-- où une commission de parrainage sera versée sur cette base, il faudra un
-- contrôle humain** (le comptable connaît ses clients) — ne pas payer sur la
-- seule foi de cette table.
--
-- ⚠️ **AUCUNE POLITIQUE D'ÉCRITURE SUR LA TABLE.** On écrit uniquement par
-- `record_acquisition`, en `security definer`, qui prend l'entreprise de
-- l'appelant (`current_company_id()`) et non un identifiant fourni : personne ne
-- peut attribuer une source à l'entreprise d'un autre. **La première source
-- gagne** (`on conflict do nothing`) : rappeler la fonction ne réécrit rien.
--
-- ⚠️ **LECTURE RÉSERVÉE AUX ADMINISTRATEURS DE PLATEFORME.** L'utilisateur n'a
-- aucune raison de voir comment nous l'avons acquis.
-- =============================================================================

begin;

create table if not exists public.company_acquisition (
  company_id   uuid primary key references public.companies (id) on delete cascade,

  -- ⚠️ **LES VALEURS SONT NORMALISÉES ET BORNÉES PAR LA BASE**, pas seulement
  -- par l'application : minuscules, lettres, chiffres, point, tiret et
  -- soulignement, 60 caractères au plus. Une URL de campagne est saisie à la
  -- main dans un post ou un message WhatsApp ; « Cabinet Ndoumbé » et
  -- « cabinet-ndoumbe » doivent finir dans la même case pour être comptés
  -- ensemble.
  ref          text check (ref          ~ '^[a-z0-9._-]{1,60}$'),
  utm_source   text check (utm_source   ~ '^[a-z0-9._-]{1,60}$'),
  utm_medium   text check (utm_medium   ~ '^[a-z0-9._-]{1,60}$'),
  utm_campaign text check (utm_campaign ~ '^[a-z0-9._-]{1,60}$'),

  -- Première page vue avec ces paramètres. Un chemin, jamais une URL entière :
  -- pas d'hôte, pas de requête, donc rien de personnel.
  landing_path text check (landing_path ~ '^/[A-Za-z0-9/_-]{0,79}$'),

  created_at   timestamptz not null default now(),

  -- Une ligne sans aucune source ne dirait rien : on ne l'écrit pas.
  constraint company_acquisition_non_vide
    check (coalesce(ref, utm_source, utm_medium, utm_campaign) is not null)
);

alter table public.company_acquisition enable row level security;

create policy company_acquisition_admin_select on public.company_acquisition
  for select to authenticated
  using (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- Normalisation : minuscules, accents retirés à la main (pas d'extension
-- `unaccent` sur ce projet), espaces en tirets, tout le reste supprimé.
-- Une valeur vide après nettoyage devient NULL.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_acquisition_value(p_value text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select nullif(
    left(
      regexp_replace(
        regexp_replace(
          translate(lower(trim(coalesce(p_value, ''))),
                    'àâäáãçéèêëíìîïñóòôöõúùûüýÿ',
                    'aaaaaceeeeiiiinooooouuuuyy'),
          '\s+', '-', 'g'),
        '[^a-z0-9._-]', '', 'g'),
      60),
    '');
$fn$;

revoke all on function public.normalize_acquisition_value(text) from public;
revoke all on function public.normalize_acquisition_value(text) from anon;
grant execute on function public.normalize_acquisition_value(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Enregistrement, une seule fois par entreprise.
-- -----------------------------------------------------------------------------
create or replace function public.record_acquisition(
  p_ref          text,
  p_utm_source   text,
  p_utm_medium   text,
  p_utm_campaign text,
  p_landing_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_company uuid := public.current_company_id();
  v_ref      text := public.normalize_acquisition_value(p_ref);
  v_source   text := public.normalize_acquisition_value(p_utm_source);
  v_medium   text := public.normalize_acquisition_value(p_utm_medium);
  v_campaign text := public.normalize_acquisition_value(p_utm_campaign);
  v_landing  text;
begin
  if v_company is null then
    raise exception 'Aucune entreprise pour ce compte.' using errcode = '42501';
  end if;

  -- Rien d'exploitable : on ne fabrique pas une ligne vide.
  if coalesce(v_ref, v_source, v_medium, v_campaign) is null then
    return;
  end if;

  -- Un chemin malformé est simplement ignoré : il ne doit pas faire perdre la
  -- source elle-même, qui est l'information utile.
  v_landing := case
    when p_landing_path ~ '^/[A-Za-z0-9/_-]{0,79}$' then p_landing_path
    else null
  end;

  insert into public.company_acquisition
    (company_id, ref, utm_source, utm_medium, utm_campaign, landing_path)
  values
    (v_company, v_ref, v_source, v_medium, v_campaign, v_landing)
  on conflict (company_id) do nothing;
end;
$fn$;

-- ⚠️ Les DEUX révocations : piège de 0015, repayé en 0019 et 0024.
revoke all on function public.record_acquisition(text, text, text, text, text) from public;
revoke all on function public.record_acquisition(text, text, text, text, text) from anon;
grant execute on function public.record_acquisition(text, text, text, text, text) to authenticated;

comment on table public.company_acquisition is
  'Premiere source connue d''une entreprise (?ref= et utm_*), ecrite une fois par record_acquisition. Declarative et falsifiable : sert a compter, jamais a payer une commission sans controle humain.';

commit;
