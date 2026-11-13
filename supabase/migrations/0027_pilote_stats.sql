-- =============================================================================
-- XN-Facture — 0027 : les chiffres de la campagne pour le pilote marketing
-- =============================================================================
-- Demande de l'utilisateur, 13 nov. 2026 (projet XN-Pilote-Marketing, phase 1) :
-- chaque dimanche à 18 h, un workflow n8n poste dans Slack le bilan de la
-- campagne de lancement (16 nov. → 15 déc.) : inscrits, actifs, payants,
-- sources, places Fondateurs, et les inscrits qui n'ont pas encore émis leur
-- première facture (pour les relancer à la main).
--
-- ⚠️ **POURQUOI `anon` ET UNE CLÉ, ET PAS `service_role`.** Le projet n'utilise
-- pas `service_role` (0004) et ne doit pas commencer pour un robot qui n'a
-- besoin que de lire un résumé. n8n appelle donc `/rest/v1/rpc/pilote_stats`
-- avec la clé publique `anon` ET une clé secrète propre au pilote, passée en
-- paramètre. La base ne garde que l'EMPREINTE SHA-256 de cette clé
-- (`pilote_cles`), jamais la clé : un dump de la table ne permet pas d'appeler
-- la fonction.
--
-- ⚠️ **LA CLÉ N'EST PAS DANS CE FICHIER.** Elle est générée hors dépôt, son
-- empreinte est insérée à la main dans l'éditeur SQL (voir en bas), et la clé
-- elle-même va dans une credential n8n. Révocation : `update pilote_cles set
-- revoque_le = now()`.
--
-- ⚠️ **DONNÉES PERSONNELLES EN SORTIE.** La liste `a_relancer` contient nom
-- d'entreprise, téléphone et e-mail de contact. C'est la raison d'être de la
-- clé : sans elle, la fonction lève 42501 et ne renvoie rien.
--
-- ⚠️ **AUCUNE RÈGLE RECOPIÉE.**
--   · formule : `plan_effectif()` (0021), pas un cinquième exemplaire ;
--   · facture « émise » : statut ni `draft` ni `cancelled`, comme
--     `lib/db/admin-queries.ts` (`emise`), pour que les chiffres du bilan
--     soient identiques à ceux de /admin (critère n° 2 du PRD du pilote) ;
--   · source : `ref` d'abord, sinon `utm_source / utm_campaign`, même libellé
--     que /admin.
-- =============================================================================

begin;

create table if not exists public.pilote_cles (
  id          uuid primary key default gen_random_uuid(),
  libelle     text not null,
  empreinte   bytea not null unique,
  cree_le     timestamptz not null default now(),
  revoque_le  timestamptz
);

-- RLS active SANS aucune politique : personne ne lit ni n'écrit cette table
-- par l'API. Seule la fonction ci-dessous (security definer) la consulte.
alter table public.pilote_cles enable row level security;
-- Ceinture et bretelles : la RLS rend déjà une liste vide à `anon`, mais
-- aucun rôle client n'a la moindre raison d'atteindre cette table.
revoke all on table public.pilote_cles from anon, authenticated;

create or replace function public.pilote_stats(p_cle text)
returns jsonb
language plpgsql
security definer
-- ⚠️ `search_path` vide — discipline de 0015. Tout est qualifié.
set search_path = ''
stable
as $fn$
declare
  v_debut     constant date := date '2026-11-16';
  v_aujourdhui date := (now() at time zone 'Africa/Douala')::date;
  v_il_y_a_7j  timestamptz := now() - interval '7 days';
  v_resultat  jsonb;
begin
  if p_cle is null or length(p_cle) < 32 or not exists (
    select 1 from public.pilote_cles k
    where k.revoque_le is null
      and k.empreinte = extensions.digest(p_cle, 'sha256')
  ) then
    raise exception 'Clé du pilote refusée.' using errcode = '42501';
  end if;

  with
  premiere as (
    select f.company_id, min(f.issue_date) as premiere_facture
    from public.invoices f
    where f.status not in ('draft', 'cancelled')
    group by f.company_id
  ),
  source as (
    select a.company_id,
           coalesce(a.ref,
                    nullif(concat_ws(' / ', a.utm_source, a.utm_campaign), ''))
             as libelle
    from public.company_acquisition a
  ),
  ent as (
    select c.id, c.name, c.phone, c.email, c.created_at,
           (c.created_at at time zone 'Africa/Douala')::date as inscrit_le,
           p.premiere_facture,
           public.plan_effectif(c.id) as formule,
           coalesce(s.libelle, 'directe') as source,
           (select count(*) from public.quotes q where q.company_id = c.id) as devis
    from public.companies c
    left join premiere p on p.company_id = c.id
    left join source s on s.company_id = c.id
  )
  select jsonb_build_object(
    'genere_le',        now(),
    'aujourdhui',       v_aujourdhui,
    'debut_campagne',   v_debut,
    'total', jsonb_build_object(
      'inscrits', (select count(*) from ent),
      'actifs',   (select count(*) from ent where premiere_facture is not null),
      'payants',  (select count(*) from ent where formule <> 'discovery')
    ),
    'campagne', jsonb_build_object(
      'inscrits', (select count(*) from ent where inscrit_le >= v_debut),
      'actifs',   (select count(*) from ent where inscrit_le >= v_debut
                                            and premiere_facture is not null),
      'payants',  (select count(*) from ent where inscrit_le >= v_debut
                                            and formule <> 'discovery')
    ),
    'semaine', jsonb_build_object(
      'inscrits', (select count(*) from ent where created_at >= v_il_y_a_7j),
      'actifs',   (select count(*) from ent
                   where premiere_facture >= (v_il_y_a_7j at time zone 'Africa/Douala')::date),
      'payants',  (select count(distinct sp.company_id) from public.subscription_payments sp
                   where sp.status = 'succeeded' and sp.created_at >= v_il_y_a_7j)
    ),
    'sources', coalesce((
      select jsonb_object_agg(source, n)
      from (select source, count(*) as n from ent
            where inscrit_le >= v_debut group by source) t
    ), '{}'::jsonb),
    -- Prix Fondateurs « non codé » (CLAUDE.md) : un versement Pro de 2 500 FCFA
    -- enregistré par admin_record_payment. 20 places au total.
    'places_fondateurs_restantes', greatest(0, 20 - (
      select count(distinct sp.company_id) from public.subscription_payments sp
      where sp.plan = 'pro' and sp.amount = 2500 and sp.status = 'succeeded'
    )),
    'a_relancer', coalesce((
      select jsonb_agg(jsonb_build_object(
               'entreprise', name,
               'telephone',  nullif(phone, ''),
               'email',      coalesce(nullif(email, ''), (
                 select u.email from public.company_members m
                 join auth.users u on u.id = m.user_id
                 where m.company_id = ent.id and m.role = 'owner'
                 limit 1)),
               'inscrit_le', inscrit_le,
               'source',     source,
               'devis',      devis)
             order by created_at desc)
      from ent
      where inscrit_le >= v_debut and premiere_facture is null
    ), '[]'::jsonb)
  ) into v_resultat;

  return v_resultat;
end;
$fn$;

-- ⚠️ Les DEUX révocations (leçon de 0015), puis le droit pour `anon` seul :
-- n8n n'a pas de session utilisateur. `authenticated` n'en a aucun besoin.
revoke all on function public.pilote_stats(text) from public;
revoke all on function public.pilote_stats(text) from authenticated;
revoke all on function public.pilote_stats(text) from anon;
grant execute on function public.pilote_stats(text) to anon;

comment on function public.pilote_stats(text) is
  'Bilan de campagne pour le pilote marketing n8n. Exige une cle dont l''empreinte SHA-256 est dans pilote_cles (non revoquee). Renvoie des donnees personnelles (a_relancer).';

commit;

-- -----------------------------------------------------------------------------
-- À FAIRE À LA MAIN, HORS DÉPÔT, dans l'éditeur SQL (jamais dans un commit) :
--
--   insert into public.pilote_cles (libelle, empreinte)
--   values ('n8n pilote', extensions.digest('<CLÉ DE 48 CARACTÈRES>', 'sha256'));
--
-- Contre-épreuves après application :
--   · select public.pilote_stats('mauvaise-cle-mauvaise-cle-mauvaise-cle');  → 42501
--   · appel REST avec la clé anon et sans p_cle valide                       → 401/42501
--   · has_function_privilege('authenticated', 'public.pilote_stats(text)', 'execute') → false
-- -----------------------------------------------------------------------------
