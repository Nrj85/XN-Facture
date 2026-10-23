-- =============================================================================
-- 0024 — L'octroi avec versement devient ATOMIQUE, et la référence cesse
--        d'être unique au monde
--
-- Deux défauts de 0023, trouvés par la revue du 23 oct. 2026 et laissés en
-- attente parce qu'ils exigeaient du SQL, donc une décision.
--
-- ⚠️ **DÉFAUT 1 — DEUX APPELS, DONC DEUX TRANSACTIONS.**
-- `grantPlanAction` appelait `admin_record_payment` puis `admin_set_plan` en
-- deux allers-retours PostgREST. Chacun est atomique pour lui-même ; **leur
-- SÉQUENCE ne l'est pas.** Si le second échoue — formule refusée, entreprise
-- disparue entre-temps, réseau coupé — alors :
--
--   * le versement est écrit, donc le chiffre d'affaires le compte ;
--   * la formule n'est PAS posée, donc le client n'a rien reçu ;
--   * et la reprise est **refusée à jamais**, puisque la référence est déjà
--     prise par la ligne orpheline.
--
-- L'exploitant est alors coincé : il ne peut ni réessayer, ni corriger, et le
-- seul recours est la console SQL — c'est-à-dire précisément ce que 0022
-- cherchait à faire disparaître.
--
-- ⚠️ **DÉFAUT 2 — `unique (provider, provider_reference)` EST GLOBAL.**
-- `provider` vaut la constante `'manuel'` pour toute saisie à la main. La clé
-- se réduit donc à la référence seule, **que l'exploitant tape librement**.
-- Deux entreprises qui règlent le même mois et qu'on note toutes deux
-- « MoMo octobre » se bloquent mutuellement — et le message dédié de 0023
-- annonce « ce versement est déjà enregistré » pour un versement qui ne l'est
-- pas. Un refus juste dans sa forme et faux sur le fond.
--
-- ⚠️⚠️ **CE QUI A ÉTÉ VÉRIFIÉ AVANT DE TOUCHER À CETTE CONTRAINTE, parce
-- qu'elle est LA SEULE PROTECTION DU WEBHOOK TARA contre un renvoi.**
-- Un rejeu Tara porte le **même `paymentId`**, donc le même `productId` —
-- c'est-à-dire notre référence de commande —, donc la **même entreprise** :
-- la clé `(company_id, provider, provider_reference)` est identique, et le
-- doublon reste refusé exactement comme avant. La portée par entreprise
-- n'affaiblit la déduplication **sur aucun chemin réel**. Elle ne retire
-- qu'une chose : l'interdiction qu'un même identifiant serve à deux
-- entreprises différentes, ce qui n'arrive jamais puisqu'un `productId`
-- n'appartient qu'à une commande, donc à une entreprise.
--
-- ⚠️ **NE JAMAIS SUPPRIMER CETTE CONTRAINTE, seulement la rescoper.** C'est
-- elle qui attrape la saisie en double **avant** de prolonger deux fois un
-- abonnement, et c'est le seul filet du webhook. La retirer rendrait les deux
-- dispositifs inopérants d'un coup.
--
-- ⚠️ **AUCUNE DONNÉE N'EST MIGRÉE, et c'est mesuré, pas supposé** :
-- `select count(*) from public.subscription_payments` rendait **0** le
-- 23 oct. 2026. Le remplacement de la contrainte ne peut donc rien casser.
-- **Si cette migration est rejouée un jour sur une base peuplée**, la nouvelle
-- clé étant plus PERMISSIVE que l'ancienne, aucune ligne existante ne peut la
-- violer : le `add constraint` passera.
-- =============================================================================

begin;

-- ⚠️ **GARDE D'ORDRE — et elle MORD, contrairement à une consigne en
-- commentaire.** 0024 suppose les deux fonctions de 0022 et 0023 en place :
-- appliquée seule, elle créerait une fonction qui appelle le vide, et l'erreur
-- n'apparaîtrait qu'au premier octroi réel, devant un client. C'est la leçon
-- de 0020 : « une consigne qu'on peut ignorer sans conséquence visible n'est
-- pas une protection ».
do $garde$
begin
  if to_regprocedure('public.admin_set_plan(uuid, text, integer)') is null then
    raise exception '0024 exige 0022 : la fonction admin_set_plan est absente.'
      using errcode = 'P0001';
  end if;
  if to_regprocedure('public.admin_record_payment(uuid, text, bigint, text, text)') is null then
    raise exception '0024 exige 0023 : la fonction admin_record_payment est absente.'
      using errcode = 'P0001';
  end if;
end;
$garde$;

-- --- 1. La référence redevient unique PAR ENTREPRISE --------------------------

alter table public.subscription_payments
  drop constraint if exists subscription_payments_reference_unique;

alter table public.subscription_payments
  add constraint subscription_payments_reference_unique
  unique (company_id, provider, provider_reference);

comment on constraint subscription_payments_reference_unique
  on public.subscription_payments is
  'Idempotence des encaissements, PAR ENTREPRISE. Un rejeu Tara porte le meme paymentId donc la meme commande donc la meme entreprise : la deduplication tient. La portee globale, elle, faisait collisionner deux references saisies a la main par deux clients differents.';

-- --- 2. Un seul appel, donc une seule transaction -----------------------------

-- ⚠️ **FONCTION NOUVELLE, ET SURTOUT PAS UN PARAMÈTRE DE PLUS.** Ajouter des
-- arguments à `admin_set_plan`, qui en porte déjà un à valeur par défaut,
-- créerait une **surcharge ambiguë** : deux fonctions de même nom, et tout
-- appel devient indécidable. C'est le piège évité en 0006, puis de nouveau en
-- 0023 — on ne le repaiera pas ici.
--
-- ⚠️ **ELLE NE RÉÉCRIT NI L'UNE NI L'AUTRE : elle les APPELLE.** Recopier la
-- règle « prolonger ou repartir » ou les cinq validations du versement en
-- ferait un troisième exemplaire, qui divergerait au premier ajustement. Les
-- gardes `is_platform_admin()` des deux fonctions appelées restent donc
-- actives — `auth.uid()` traverse l'appel —, et la garde ci-dessous n'est là
-- que pour refuser **tôt**, avec la bonne phrase.
create or replace function public.admin_grant_with_payment(
  p_company   uuid,
  p_plan      text,
  p_months    integer,
  p_amount    bigint,
  p_channel   text,
  p_reference text
)
returns table (
  formule_posee   public.plan_code,
  echeance_posee  date,
  commande_soldee boolean,
  paiement_id     uuid
)
language plpgsql
security definer
-- `search_path = ''` oblige à tout qualifier — `public.`, `auth.` — et son
-- oubli ne casse pas la création, seulement l'exécution.
set search_path = ''
as $fn$
declare
  v_paiement uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Réservé aux administrateurs de plateforme.'
      using errcode = '42501';
  end if;

  -- ⚠️ **LE VERSEMENT D'ABORD, ET L'ORDRE N'EST PAS INDIFFÉRENT.** Si
  -- l'insertion est refusée par l'unicité, ce versement a déjà été traité : on
  -- s'arrête **avant** de prolonger une seconde fois. L'ordre inverse
  -- prolongerait l'abonnement une fois par saisie en double — et c'est la
  -- saisie en double qu'on cherche à attraper. C'est la règle déjà retenue
  -- pour le webhook Tara.
  --
  -- La différence avec 0023 appelée depuis l'application tient en un mot :
  -- **ici, une exception annule AUSSI le versement.** Plus de ligne orpheline,
  -- plus de référence consommée pour rien, et la reprise reste possible.
  v_paiement := public.admin_record_payment(
    p_company, p_plan, p_amount, p_channel, p_reference
  );

  -- ⚠️ **QUALIFIER PAR L'ALIAS EST OBLIGATOIRE ICI.** `returns table (...)`
  -- déclare des variables homonymes des colonnes rendues par
  -- `admin_set_plan` : sans le préfixe `octroi.`, PostgreSQL ne saurait pas
  -- laquelle on désigne et lèverait `42702 column reference is ambiguous` —
  -- **à l'exécution, pas à la création**. C'est le piège payé en 0012.
  return query
    select
      octroi.formule_posee,
      octroi.echeance_posee,
      octroi.commande_soldee,
      v_paiement
    from public.admin_set_plan(p_company, p_plan, p_months) as octroi;
end;
$fn$;

-- ⚠️ **LES DEUX RÉVOCATIONS, aucune ne remplace l'autre** — piège de 0015,
-- repayé en 0019. Supabase pose un `alter default privileges … grant execute
-- … to anon`, donc chaque fonction naît avec un droit NOMINATIF pour `anon`
-- en plus du droit implicite de `public` : révoquer l'un laisse l'autre.
-- Le juge est l'ACL brute, jamais ce fichier :
--   select proacl from pg_proc where proname = 'admin_grant_with_payment';
-- aucune entrée nue « =X/postgres » ne doit y figurer.
revoke all on function
  public.admin_grant_with_payment(uuid, text, integer, bigint, text, text) from public;
revoke all on function
  public.admin_grant_with_payment(uuid, text, integer, bigint, text, text) from anon;
grant execute on function
  public.admin_grant_with_payment(uuid, text, integer, bigint, text, text) to authenticated;

comment on function
  public.admin_grant_with_payment(uuid, text, integer, bigint, text, text) is
  'Enregistre un versement PUIS octroie la formule, EN UNE SEULE TRANSACTION. A utiliser des qu''un paiement accompagne l''octroi : les deux appels separes laissaient, en cas d''echec du second, un versement orphelin dont la reference bloquait toute reprise. Sans paiement, appeler admin_set_plan directement.';

commit;
