-- =============================================================================
-- XN-Facture — Espace administrateur de plateforme
-- =============================================================================
-- Deux ajouts, et une règle qui les gouverne tous les deux :
--
--   1. `platform_admins` + `is_platform_admin()` : un administrateur de
--      plateforme voit les données de TOUTES les entreprises.
--   2. `activity_log` : un journal horodaté de ce qui se passe, alimenté par
--      des déclencheurs plutôt que par le code applicatif.
--
-- **AUCUNE POLITIQUE EXISTANTE N'EST MODIFIÉE.** Les droits d'administrateur
-- sont accordés par de NOUVELLES politiques `for select`, que PostgreSQL
-- combine avec les anciennes par un OU. Trois raisons :
--
--   - l'isolation entre entreprises reste exactement ce qu'elle était, et une
--     relecture de ce fichier montre d'un coup d'œil ce qui a été ajouté ;
--   - `invoice_items_all` et `quote_items_all` sont des politiques `for all` :
--     y glisser `or is_platform_admin()` aurait ouvert l'ÉCRITURE en même temps
--     que la lecture, ce que personne n'aurait vu venir ;
--   - l'espace est en LECTURE SEULE. Aucune politique d'insertion, de mise à
--     jour ou de suppression n'est accordée à un administrateur, nulle part.
--
-- L'accès est donc appliqué par la BASE, pas par l'interface. La clé
-- `service_role`, qui contourne toute la RLS, reste inutilisée et absente du
-- serveur web — voir la section « Déploiement Vercel » de CLAUDE.md.
-- =============================================================================

begin;

-- --- Qui est administrateur de plateforme ------------------------------------
--
-- Table volontairement pauvre : un identifiant, une date, une note. Aucune
-- colonne « actif » — retirer un administrateur, c'est supprimer sa ligne.
-- Un drapeau qu'on oublie de basculer est pire qu'une ligne qu'on supprime.

create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  note       text
);

comment on table public.platform_admins is
  'Comptes autorisés à consulter toutes les entreprises. Écriture impossible par l''API : la table n''a aucune politique d''insertion, de mise à jour ni de suppression. On n''y ajoute quelqu''un que depuis la console SQL.';

alter table public.platform_admins enable row level security;

-- --- La fonction de contrôle -------------------------------------------------
--
-- `security definer` : elle lit `platform_admins`, dont la RLS bloquerait la
-- lecture pour un utilisateur ordinaire — et c'est justement ce qu'il faut,
-- puisque la fonction doit pouvoir répondre « non » sans que l'appelant ait le
-- droit de consulter la table.
--
-- `stable` : appelée une fois par ligne dans les politiques, elle doit pouvoir
-- être mise en cache le temps de la requête. Sans cela, une liste de deux
-- cents factures déclencherait deux cents requêtes.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$fn$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Posée ICI et non plus haut : une politique ne peut pas référencer une
-- fonction qui n'existe pas encore.
--
-- Un administrateur voit la liste des administrateurs ; personne d'autre ne la
-- voit, et PERSONNE ne l'écrit par l'API. L'absence de politique d'écriture
-- n'est pas un oubli : c'est la protection principale de tout ce fichier.
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());


-- --- Lecture transversale ----------------------------------------------------
--
-- Une politique par table, toutes identiques, toutes `for select`.

create policy companies_admin_select on public.companies
  for select to authenticated using (public.is_platform_admin());

create policy company_members_admin_select on public.company_members
  for select to authenticated using (public.is_platform_admin());

create policy clients_admin_select on public.clients
  for select to authenticated using (public.is_platform_admin());

create policy invoices_admin_select on public.invoices
  for select to authenticated using (public.is_platform_admin());

create policy invoice_items_admin_select on public.invoice_items
  for select to authenticated using (public.is_platform_admin());

create policy quotes_admin_select on public.quotes
  for select to authenticated using (public.is_platform_admin());

create policy quote_items_admin_select on public.quote_items
  for select to authenticated using (public.is_platform_admin());

create policy document_counters_admin_select on public.document_counters
  for select to authenticated using (public.is_platform_admin());

-- --- Journal d'activité ------------------------------------------------------
--
-- **Pas de clé étrangère sur `company_id`.** C'est délibéré : une contrainte
-- ferait disparaître l'historique d'une entreprise en même temps qu'elle, or
-- c'est précisément le moment où l'on veut pouvoir le relire. Un journal qui
-- s'efface avec ce qu'il journalise ne sert à rien.
--
-- `actor_id` n'a pas de clé étrangère non plus, pour la même raison : la trace
-- doit survivre à la suppression du compte qui l'a produite.

create table public.activity_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  company_id  uuid,
  actor_id    uuid,
  -- 'company' | 'client' | 'invoice' | 'quote'
  entity      text not null,
  entity_id   uuid,
  -- 'created' | 'updated' | 'status_changed' | 'deleted'
  action      text not null,
  -- Ce qui a changé, en clair : numéro, client, montant, ancien et nouveau
  -- statut. Le détail exact dépend de l'entité, d'où le `jsonb`.
  details     jsonb
);

comment on table public.activity_log is
  'Journal horodaté, alimenté par des déclencheurs. En lecture seule : aucune politique d''écriture, et les déclencheurs y écrivent en security definer.';

create index activity_log_time_idx    on public.activity_log (occurred_at desc);
create index activity_log_company_idx on public.activity_log (company_id, occurred_at desc);

alter table public.activity_log enable row level security;

-- Les administrateurs lisent tout le journal ; une entreprise lit le sien.
-- Aucune politique d'écriture : seul le déclencheur écrit, et il le fait en
-- `security definer`, donc hors RLS.
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));

-- --- Le déclencheur ----------------------------------------------------------
--
-- Une seule fonction pour les quatre tables. `TG_TABLE_NAME` dit laquelle, et
-- `TG_OP` dit quoi. Écrire quatre fonctions presque identiques aurait garanti
-- qu'un jour l'une d'elles n'enregistre plus la même chose que les autres.
--
-- `auth.uid()` rend NULL quand l'écriture ne vient pas d'une requête
-- authentifiée — un seed, une correction en console. La colonne est donc
-- nullable, et un acteur inconnu se lit « système » à l'affichage.

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_entity  text;
  v_company uuid;
  v_id      uuid;
  v_action  text;
  v_details jsonb;
begin
  v_action := case tg_op
    when 'INSERT' then 'created'
    when 'DELETE' then 'deleted'
    else 'updated'
  end;

  -- ⚠️ **Une branche par table, et jamais de condition combinée.**
  --
  -- PL/pgSQL ne garantit AUCUN court-circuit dans un `and` : il compile
  -- l'expression entière en une requête SQL, et les champs y sont résolus même
  -- dans les termes qui ne seront jamais atteints. Une première version testait
  -- `tg_op = 'UPDATE' and new.status is distinct from old.status` : l'insertion
  -- d'un CLIENT échouait aussitôt avec
  --
  --     record "new" has no field "status"
  --
  -- Même piège avec `old` sur un INSERT, où il n'est pas affecté. D'où les
  -- `if` imbriqués plutôt qu'une condition unique : c'est plus long, et c'est
  -- la seule forme qui ne référence un champ que là où il existe.

  if tg_table_name = 'companies' then
    v_entity := 'company';
    if tg_op = 'DELETE' then
      v_company := old.id;
      v_id      := old.id;
      v_details := jsonb_build_object('name', old.name);
    else
      v_company := new.id;
      v_id      := new.id;
      v_details := jsonb_build_object('name', new.name);
    end if;

  elsif tg_table_name = 'clients' then
    v_entity := 'client';
    if tg_op = 'DELETE' then
      v_company := old.company_id;
      v_id      := old.id;
      v_details := jsonb_build_object('name', old.name);
    else
      v_company := new.company_id;
      v_id      := new.id;
      v_details := jsonb_build_object('name', new.name);
    end if;

  elsif tg_table_name = 'invoices' then
    v_entity := 'invoice';
    if tg_op = 'DELETE' then
      v_company := old.company_id;
      v_id      := old.id;
      v_details := jsonb_build_object('number', old.number, 'status', old.status);
    else
      v_company := new.company_id;
      v_id      := new.id;
      v_details := jsonb_build_object(
        'number', new.number,
        'status', new.status,
        'amount_paid', new.amount_paid
      );
      -- Un changement de statut mérite son propre verbe : c'est l'événement
      -- qu'on cherche en priorité dans un journal de facturation.
      if tg_op = 'UPDATE' then
        if new.status is distinct from old.status then
          v_action  := 'status_changed';
          v_details := v_details || jsonb_build_object('previous_status', old.status);
        end if;
      end if;
    end if;

  elsif tg_table_name = 'quotes' then
    v_entity := 'quote';
    if tg_op = 'DELETE' then
      v_company := old.company_id;
      v_id      := old.id;
      v_details := jsonb_build_object('number', old.number, 'status', old.status);
    else
      v_company := new.company_id;
      v_id      := new.id;
      v_details := jsonb_build_object('number', new.number, 'status', new.status);
      if tg_op = 'UPDATE' then
        if new.status is distinct from old.status then
          v_action  := 'status_changed';
          v_details := v_details || jsonb_build_object('previous_status', old.status);
        end if;
      end if;
    end if;

  else
    -- Table inconnue : on ne journalise rien plutôt que d'écrire une ligne
    -- que personne ne saura relire.
    return null;
  end if;

  insert into public.activity_log (company_id, actor_id, entity, entity_id, action, details)
  values (v_company, auth.uid(), v_entity, v_id, v_action, v_details);

  -- `after` : la valeur de retour est ignorée, mais PL/pgSQL en exige une.
  return null;
end;
$fn$;

revoke all on function public.log_activity() from public;

-- `after` et non `before` : on ne journalise que ce qui a réellement abouti.
-- Une écriture refusée par une contrainte ne doit pas laisser de trace.

create trigger companies_log
  after insert or update or delete on public.companies
  for each row execute function public.log_activity();

create trigger clients_log
  after insert or update or delete on public.clients
  for each row execute function public.log_activity();

create trigger invoices_log
  after insert or update or delete on public.invoices
  for each row execute function public.log_activity();

create trigger quotes_log
  after insert or update or delete on public.quotes
  for each row execute function public.log_activity();

commit;
