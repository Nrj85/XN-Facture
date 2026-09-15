-- ============================================================================
-- 0009 — Commander une formule
--
-- `/abonnement` affichait les trois formules sans le moindre moyen d'en
-- prendre une : trois cartes à regarder, aucun bouton. La fenêtre de plafond
-- y menait, et le parcours s'arrêtait là.
--
-- ⚠️ UNE COMMANDE N'EST PAS UN PAIEMENT, et c'est pour ça qu'elle a sa propre
-- table. `subscription_payments` journalise de l'argent RÉELLEMENT encaissé ;
-- `subscription_orders` note une intention, avant tout règlement. Les
-- confondre aurait fait figurer dans le journal des sommes jamais reçues.
--
-- ⚠️ **La commande ne porte AUCUN montant.** Le prix vit dans `lib/plans.ts`,
-- source unique ; le stocker ici en ferait une seconde, et un jour la
-- commande réclamerait un prix que la grille tarifaire n'annonce plus. Le
-- montant est recalculé à l'affichage à partir de `plan` et `period`.
--
-- C'est aussi ce qui règle un problème de sécurité : la fonction ci-dessous
-- est appelable directement par n'importe quel client authentifié. Si elle
-- prenait un montant en paramètre, on pourrait se commander la formule Pro à
-- 1 FCFA. Elle n'en prend pas.
-- ============================================================================

create type public.billing_period as enum ('monthly', 'yearly');
create type public.order_status  as enum ('pending', 'paid', 'cancelled');

create table public.subscription_orders (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  plan       public.plan_code not null,
  period     public.billing_period not null,

  -- Référence communiquée à l'utilisateur et rappelée dans son règlement.
  -- Hexadécimale en majuscules : pas de « O » ni de « I », donc rien à
  -- confondre avec un zéro ou un un quand on la recopie sur un téléphone.
  reference  text not null unique
               check (reference ~ '^XN-[A-Z]{3}-[0-9A-F]{6}$'),

  status     public.order_status not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscription_orders_touch before update on public.subscription_orders
  for each row execute function public.touch_updated_at();

-- Une seule commande en attente par entreprise : la référence affichée à
-- l'écran doit être LA référence à rappeler, pas une parmi cinq.
create unique index subscription_orders_une_en_attente
  on public.subscription_orders (company_id)
  where status = 'pending';

create index subscription_orders_company_idx
  on public.subscription_orders (company_id, created_at desc);

alter table public.subscription_orders enable row level security;

create policy subscription_orders_select on public.subscription_orders
  for select to authenticated
  using (public.is_company_member(company_id));

-- ⚠️ AUCUNE politique d'écriture, comme pour `subscriptions`. Passer une
-- commande se fait par la fonction ci-dessous, et rien d'autre. Une politique
-- d'`update` aurait permis de faire passer sa propre commande en « payée ».
create policy subscription_orders_admin_select on public.subscription_orders
  for select to authenticated
  using (public.is_platform_admin());

-- --- Passer commande ---------------------------------------------------------

create or replace function public.start_subscription_order(p_plan text, p_period text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_company uuid := public.current_company_id();
  v_ref     text;
  v_exist   public.subscription_orders%rowtype;
begin
  if v_company is null then
    raise exception 'Aucune entreprise pour ce compte.' using errcode = '42501';
  end if;

  -- La formule gratuite ne se commande pas : c'est celle qu'on a déjà.
  if p_plan is null or p_plan not in ('pro', 'business') then
    raise exception 'Cette formule ne peut pas être commandée.' using errcode = '22023';
  end if;

  if p_period is null or p_period not in ('monthly', 'yearly') then
    raise exception 'Période de facturation inconnue.' using errcode = '22023';
  end if;

  -- Reprendre la commande en attente si elle porte déjà le même choix :
  -- recliquer « Choisir Pro » ne doit pas changer la référence sous les yeux
  -- de quelqu'un qui est en train de la recopier dans son téléphone.
  select * into v_exist
  from public.subscription_orders
  where company_id = v_company and status = 'pending';

  if found then
    if v_exist.plan = p_plan::public.plan_code
       and v_exist.period = p_period::public.billing_period then
      return v_exist.reference;
    end if;
    -- Choix différent : l'ancienne commande n'a plus lieu d'être.
    update public.subscription_orders
    set status = 'cancelled'
    where id = v_exist.id;
  end if;

  -- Hexadécimal : l'alphabet 0-9A-F ne contient ni O ni I.
  v_ref := 'XN-' || upper(left(p_plan, 3)) || '-'
           || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.subscription_orders (company_id, plan, period, reference)
  values (v_company, p_plan::public.plan_code, p_period::public.billing_period, v_ref);

  -- La formule demandée, pour que `/abonnement` et l'espace administrateur
  -- disent la même chose. Elle n'accorde toujours rien.
  update public.subscriptions set requested = p_plan::public.plan_code
  where company_id = v_company;

  return v_ref;
end;
$fn$;

revoke all on function public.start_subscription_order(text, text) from public;
grant execute on function public.start_subscription_order(text, text) to authenticated;

-- --- Annuler sa commande -----------------------------------------------------

create or replace function public.cancel_subscription_order()
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

  -- `status = 'pending'` dans la clause : on ne peut annuler qu'une commande
  -- en attente, jamais en revenir sur une déjà réglée.
  update public.subscription_orders
  set status = 'cancelled'
  where company_id = v_company and status = 'pending';
end;
$fn$;

revoke all on function public.cancel_subscription_order() from public;
grant execute on function public.cancel_subscription_order() to authenticated;
