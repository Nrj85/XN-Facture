-- =============================================================================
-- XN-Facture — 0028 : pilote_stats renvoie aussi les candidats testeurs
-- =============================================================================
-- Demande de l'utilisateur, 13 nov. 2026 (XN-Pilote-Marketing, phase 5) : le
-- pilote propose chaque semaine d'inviter des utilisateurs de XN-Facture à
-- tester XN-RelancePro (l'application de relance des devis). Critère choisi par
-- l'utilisateur : **au moins 2 devis créés**, quelle que soit la date
-- d'inscription.
--
-- Ce que change cette version par rapport à 0027 :
--   · `candidats_testeurs` : entreprises avec 2 devis ou plus (entreprise,
--     téléphone, e-mail, devis, factures émises, date d'inscription) ;
--   · `company_id` ajouté dans `a_relancer` et `candidats_testeurs`, pour que le
--     pilote ne propose pas la même entreprise deux semaines de suite ;
--   · les entreprises dont un membre est **administrateur de plateforme** sont
--     exclues des deux listes (ce sont nos comptes de test : on ne s'invite pas
--     soi-même). Elles restent comptées dans `total`, qui doit rester identique
--     à /admin.
--
-- ⚠️ Tout le reste est inchangé : même clé (empreinte SHA-256 dans
-- `pilote_cles`), mêmes droits (`anon` seul), mêmes règles que /admin.
-- `create or replace` garde la signature `pilote_stats(text)` : la credential
-- n8n et le workflow n'ont rien à changer.
-- =============================================================================

begin;

create or replace function public.pilote_stats(p_cle text)
returns jsonb
language plpgsql
security definer
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
  emises as (
    select f.company_id, min(f.issue_date) as premiere_facture, count(*) as factures
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
           e.premiere_facture,
           coalesce(e.factures, 0) as factures,
           public.plan_effectif(c.id) as formule,
           coalesce(s.libelle, 'directe') as source,
           (select count(*) from public.quotes q where q.company_id = c.id) as devis,
           exists (
             select 1 from public.company_members m
             join public.platform_admins pa on pa.user_id = m.user_id
             where m.company_id = c.id
           ) as compte_admin,
           coalesce(nullif(c.email, ''), (
             select u.email from public.company_members m
             join auth.users u on u.id = m.user_id
             where m.company_id = c.id and m.role = 'owner'
             limit 1)) as email_contact
    from public.companies c
    left join emises e on e.company_id = c.id
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
    'places_fondateurs_restantes', greatest(0, 20 - (
      select count(distinct sp.company_id) from public.subscription_payments sp
      where sp.plan = 'pro' and sp.amount = 2500 and sp.status = 'succeeded'
    )),
    'a_relancer', coalesce((
      select jsonb_agg(jsonb_build_object(
               'company_id', id,
               'entreprise', name,
               'telephone',  nullif(phone, ''),
               'email',      email_contact,
               'inscrit_le', inscrit_le,
               'source',     source,
               'devis',      devis)
             order by created_at desc)
      from ent
      where inscrit_le >= v_debut and premiere_facture is null and not compte_admin
    ), '[]'::jsonb),
    'candidats_testeurs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'company_id', id,
               'entreprise', name,
               'telephone',  nullif(phone, ''),
               'email',      email_contact,
               'inscrit_le', inscrit_le,
               'devis',      devis,
               'factures',   factures)
             order by devis desc, created_at desc)
      from (select * from ent where devis >= 2 and not compte_admin
            order by devis desc, created_at desc limit 50) t
    ), '[]'::jsonb)
  ) into v_resultat;

  return v_resultat;
end;
$fn$;

-- `create or replace` conserve les droits, mais on les repose pour que ce
-- fichier se suffise à lui-même (leçon de 0015 : les DEUX révocations).
revoke all on function public.pilote_stats(text) from public;
revoke all on function public.pilote_stats(text) from authenticated;
revoke all on function public.pilote_stats(text) from anon;
grant execute on function public.pilote_stats(text) to anon;

commit;
