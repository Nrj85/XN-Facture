-- =============================================================================
-- 0023 — Enregistrer un paiement REÇU, à la main
--
-- Demande de l'utilisateur, le 21 oct. 2026 : « un endroit où le saisir ».
--
-- Le contexte : 0022 permet d'octroyer une formule, mais n'écrit **rien** dans
-- `subscription_payments` — délibérément, parce qu'un octroi peut suivre un
-- virement, un geste commercial, une correction ou un essai, et qu'inventer un
-- montant polluerait la seule source du chiffre d'affaires réel.
--
-- Conséquence assumée alors, et signalée à l'utilisateur : quand un client
-- envoie réellement 5 000 FCFA par mobile money, **cette somme n'était
-- enregistrée nulle part**. Ce fichier comble ce trou — sans revenir sur la
-- règle. La différence tient en une phrase : **ce n'est plus le logiciel qui
-- devine un montant, c'est l'exploitant qui déclare ce qu'il a reçu.**
--
-- ⚠️ **FONCTION SÉPARÉE, ET NON UN PARAMÈTRE DE PLUS SUR `admin_set_plan`.**
-- Ajouter des paramètres à une fonction qui en a déjà un à valeur par défaut
-- crée une SURCHARGE : deux fonctions de même nom, et tout appel à trois
-- arguments devient ambigu. C'est exactement le piège évité en 0006, où un
-- paramètre de plus sur `create_company_for_current_user` aurait rendu
-- ambigus tous les appels existants.
--
-- ⚠️ **L'APPELANT DOIT ENREGISTRER LE PAIEMENT AVANT D'OCTROYER.** C'est la
-- règle déjà retenue pour le webhook Tara : si l'insertion est refusée par
-- `unique (provider, provider_reference)`, c'est que ce versement a déjà été
-- traité — et on s'arrête **avant** de prolonger une seconde fois. L'ordre
-- inverse prolongerait l'abonnement une fois par saisie en double.
-- =============================================================================

begin;

create or replace function public.admin_record_payment(
  p_company   uuid,
  p_plan      text,
  p_amount    bigint,
  p_channel   text,
  p_reference text
)
returns uuid
language plpgsql
security definer
-- ⚠️ `search_path` vide — discipline de 0015. Tout est donc qualifié.
set search_path = ''
as $fn$
declare
  v_plan public.plan_code;
  v_ref  text := btrim(coalesce(p_reference, ''));
  v_id   uuid;
begin
  -- La garde est DANS la fonction : `security definer` fait tomber la RLS, et
  -- `subscription_payments` n'a aucune politique d'écriture pour personne.
  if not public.is_platform_admin() then
    raise exception 'Réservé aux administrateurs de plateforme.'
      using errcode = '42501';
  end if;

  if p_plan is null or p_plan not in ('discovery', 'pro', 'business') then
    raise exception 'Formule inconnue.' using errcode = '22023';
  end if;
  v_plan := p_plan::public.plan_code;

  -- ⚠️ **ENTIER DE FRANCS, ET STRICTEMENT POSITIF.** Le FCFA n'a pas de
  -- centimes (§5), et la table porte déjà `check (amount > 0)` : un paiement
  -- de zéro n'est pas un paiement, c'est une ligne qui fausse un total.
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant reçu doit être un nombre de francs supérieur à zéro.'
      using errcode = '22023';
  end if;

  -- Liste fermée. « autre » existe pour ne pas forcer un mensonge quand le
  -- canal n'est aucun des quatre — sans lui, on choisirait « bank » au hasard.
  if p_channel is null or p_channel not in
       ('mtn_momo', 'orange_money', 'bank', 'cash', 'autre') then
    raise exception 'Canal de règlement inconnu.' using errcode = '22023';
  end if;

  -- ⚠️ **LA RÉFÉRENCE EST OBLIGATOIRE, et c'est tout l'intérêt du dispositif.**
  -- C'est elle qui porte l'idempotence : `unique (provider,
  -- provider_reference)` refuse la même transaction deux fois. Une référence
  -- vide rendrait la contrainte inopérante et autoriserait les doublons.
  if v_ref = '' then
    raise exception 'La référence du versement est obligatoire : c’est elle qui empêche de saisir deux fois le même paiement.'
      using errcode = '22023';
  end if;
  if length(v_ref) > 100 then
    raise exception 'Référence trop longue : 100 caractères au maximum.'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company) then
    raise exception 'Entreprise inconnue.' using errcode = '23503';
  end if;

  begin
    insert into public.subscription_payments
      (company_id, plan, amount, currency, channel, provider, provider_reference, status)
    values
      -- `provider = 'manuel'` : ce n'est pas un agrégateur. Le jour où Tara
      -- encaissera, ses lignes porteront `provider = 'tara'`, et les deux
      -- sources resteront distinguables dans le même journal.
      (p_company, v_plan, p_amount, 'XAF'::public.currency_code,
       p_channel, 'manuel', v_ref, 'succeeded')
    returning id into v_id;
  exception when unique_violation then
    -- ⚠️ **MESSAGE DÉDIÉ.** Le cas générique `23505` du projet dit « Ce numéro
    -- est déjà attribué. Réessayez. » — une phrase écrite pour la numérotation
    -- des factures, qui inviterait ici à refaire une saisie qui échouera
    -- toujours, et qui tairait la seule chose utile : c'est déjà enregistré.
    raise exception 'Ce versement est déjà enregistré sous la référence « % ». Rien n’a été ajouté.', v_ref
      using errcode = 'P0001';
  end;

  -- ⚠️ **`period_start` ET `period_end` RESTENT NULLES, et c'est voulu.** La
  -- période couverte est portée par `subscriptions.expires_at`, que
  -- `admin_set_plan` calcule selon la règle « prolonger ou repartir ». La
  -- recopier ici en ferait une SECONDE vérité, qui divergerait le jour où la
  -- règle changerait — exactement ce que le projet évite pour les prix et pour
  -- l'expiration.

  insert into public.activity_log
    (company_id, actor_id, entity, entity_id, action, details)
  values (
    p_company, auth.uid(), 'subscription', p_company, 'updated',
    jsonb_build_object(
      'payment',   true,
      'amount',    p_amount,
      'channel',   p_channel,
      'reference', v_ref,
      'plan',      v_plan::text
    )
  );

  return v_id;
end;
$fn$;

-- ⚠️ **LES DEUX RÉVOCATIONS, aucune ne remplace l'autre** — piège de 0015.
-- Le juge est l'ACL brute : `select proacl from pg_proc where proname =
-- 'admin_record_payment'` ne doit porter AUCUNE entrée nue « =X/postgres ».
revoke all on function public.admin_record_payment(uuid, text, bigint, text, text) from public;
revoke all on function public.admin_record_payment(uuid, text, bigint, text, text) from anon;
grant execute on function public.admin_record_payment(uuid, text, bigint, text, text) to authenticated;

comment on function public.admin_record_payment(uuid, text, bigint, text, text) is
  'Enregistre un versement REELLEMENT recu, declare par un administrateur. L''idempotence tient sur unique (provider, provider_reference) : la reference est donc obligatoire. A appeler AVANT admin_set_plan.';

commit;
