-- ============================================================================
-- 0012 — Refus des emails de prospection
--
-- L'export CSV de l'espace d'administration sert des campagnes commerciales.
-- Sans moyen de dire « ne m'écrivez plus », ces campagnes seraient du
-- démarchage sans issue : le destinataire n'aurait d'autre recours que de
-- classer l'expéditeur en indésirable, ce qui abîme la réputation du domaine
-- bien au-delà de la personne concernée.
--
-- ⚠️ **LE REFUS NE COUVRE QUE LE COMMERCIAL.** Confirmation d'adresse, mot de
-- passe oublié et **avis d'échéance d'abonnement** continuent de partir : ce
-- sont des messages liés à l'exécution du service. Laisser quelqu'un perdre sa
-- formule faute d'avoir été prévenu serait lui nuire, pas le respecter.
--
-- ⚠️ **LE LIEN DOIT MARCHER SANS SESSION.** On clique depuis sa boîte mail, sur
-- le téléphone, souvent dans une application qui n'a aucun cookie du site.
-- D'où un jeton aléatoire par personne, porté par l'URL — le même mécanisme
-- que les liens de confirmation, et la seule forme utilisable ici.
-- ============================================================================

create table public.email_preferences (
  user_id   uuid primary key references auth.users(id) on delete cascade,

  -- Vrai par défaut : quelqu'un qui s'inscrit accepte de recevoir des
  -- nouvelles du service auquel il souscrit. C'est le refus qui est enregistré,
  -- pas l'accord.
  marketing boolean not null default true,

  -- Identifiant d'URL, distinct de `user_id`. Publier l'identifiant de compte
  -- dans un lien d'email le ferait fuiter vers tout intermédiaire qui lit
  -- l'URL — passerelle antispam, historique de navigation, capture d'écran
  -- partagée. Ce jeton-ci n'ouvre qu'une seule porte : changer une préférence
  -- d'envoi.
  token     uuid not null default gen_random_uuid() unique,

  updated_at timestamptz not null default now()
);

alter table public.email_preferences enable row level security;

-- Lecture réservée aux administrateurs de plateforme. **Aucune politique
-- d'écriture** : seules les fonctions `security definer` ci-dessous écrivent.
-- Une politique d'`update` permettrait de remettre à `true` le refus de
-- quelqu'un d'autre — c'est-à-dire de le réabonner contre son gré.
create policy email_preferences_admin_select on public.email_preferences
  for select to authenticated
  using (public.is_platform_admin());

-- --- Changer sa préférence depuis un lien d'email ----------------------------

create or replace function public.set_marketing_preference(p_token uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_email text;
begin
  update public.email_preferences p
  set marketing = p_accept, updated_at = now()
  where p.token = p_token;

  if not found then
    -- Jeton inconnu, expiré ou compte supprimé : on rend `null` et la page
    -- affiche un message neutre. Distinguer « jeton faux » de « jeton d'un
    -- compte supprimé » n'apprendrait rien d'utile à la personne, et
    -- transformerait cette fonction en oracle pour qui essaierait des jetons.
    return null;
  end if;

  select u.email into v_email
  from public.email_preferences p
  join auth.users u on u.id = p.user_id
  where p.token = p_token;

  return v_email;
end;
$fn$;

-- Exécutable SANS session : c'est tout l'objet du jeton. `anon` est le rôle
-- d'un visiteur qui arrive depuis sa boîte mail.
revoke all on function public.set_marketing_preference(uuid, boolean) from public;
grant execute on function public.set_marketing_preference(uuid, boolean) to anon, authenticated;

-- --- La liste pour les campagnes ---------------------------------------------
--
-- Une seule fonction rend ce dont l'export a besoin : le jeton de chacun, pour
-- composer son lien de désabonnement, et son choix, pour l'écarter s'il a
-- refusé. Elle crée au passage les lignes manquantes — les comptes existaient
-- avant cette table.

create or replace function public.marketing_recipients()
returns table (user_id uuid, token uuid, marketing boolean)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- ⚠️ La garde est ICI, et elle est indispensable : `security definer` fait
  -- tomber la RLS, donc sans ce test n'importe quel compte authentifié
  -- obtiendrait les jetons de tout le monde — et pourrait désabonner autrui.
  if not public.is_platform_admin() then
    raise exception 'Réservé aux administrateurs de plateforme'
      using errcode = 'P0001';
  end if;

  -- ⚠️ `on conflict ON CONSTRAINT`, et surtout pas `on conflict (user_id)`.
  -- `returns table (user_id …)` déclare une VARIABLE `user_id` ; nommer la
  -- colonne dans la clause de conflit devient alors ambigu, et PostgreSQL
  -- refuse la fonction à l'exécution :
  --
  --     42702  column reference "user_id" is ambiguous
  --
  -- Le nom de la contrainte, lui, ne peut désigner qu'une seule chose. Même
  -- vigilance pour toute colonne portant le nom d'un paramètre de sortie : le
  -- reste de la fonction qualifie systématiquement par l'alias `p`.
  insert into public.email_preferences (user_id)
  select u.id from auth.users u
  where u.deleted_at is null
  on conflict on constraint email_preferences_pkey do nothing;

  return query
    select p.user_id, p.token, p.marketing
    from public.email_preferences p;
end;
$fn$;

revoke all on function public.marketing_recipients() from public, anon;
grant execute on function public.marketing_recipients() to authenticated;
