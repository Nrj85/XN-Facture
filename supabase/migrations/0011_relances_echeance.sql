-- ============================================================================
-- 0011 — Relance avant échéance d'abonnement
--
-- Le mobile money ne sait pas prélever automatiquement : chaque renouvellement
-- est un paiement MANUEL, que rien ne déclenche. Sans relance, un abonné perd
-- sa formule en silence, un matin, sans avoir rien décidé — et c'est ainsi
-- qu'on perd un client qui était content du produit.
--
-- ⚠️ POURQUOI TOUT VIT DANS LA BASE, ET RIEN SUR VERCEL.
-- Un traitement périodique n'a PAS de session et doit pourtant lire les
-- abonnements de TOUTES les entreprises. Le faire depuis l'application
-- imposerait d'y poser `SUPABASE_SERVICE_ROLE_KEY`, c'est-à-dire une clé qui
-- contourne la RLS, sur un serveur web exposé — ce que ce projet s'interdit
-- (voir « Déploiement » dans CLAUDE.md). `pg_cron` déclenche donc depuis
-- Postgres, `pg_net` appelle Resend, et la clé d'API dort dans le coffre
-- chiffré `vault`. Aucun secret ne quitte la base.
--
-- ⚠️ LA CLÉ RESEND N'EST PAS DANS CE FICHIER, et ne doit jamais y être : ce
-- dépôt est public. Elle est déposée séparément dans `vault` :
--
--     select vault.create_secret('<la clé>', 'resend_api_key',
--                                'Clé d''API Resend — relances d''échéance');
--
-- Tant qu'elle est absente, la fonction n'envoie rien et le dit en `warning` :
-- elle ne tombe pas, et surtout elle ne marque rien comme envoyé.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- --- Le journal des relances -------------------------------------------------
--
-- Ce n'est pas un confort : c'est le mécanisme d'idempotence. Le travail tourne
-- tous les jours, et rien n'empêche qu'il tourne deux fois — reprise après
-- incident, exécution manuelle pendant une mise au point. Une clé unique sur
-- (entreprise, type, échéance) garantit qu'un abonné reçoit chaque relance
-- UNE fois. Le jour où il renouvelle, `expires_at` change : la nouvelle période
-- porte donc ses propres relances, sans qu'on ait rien à purger.

create table public.subscription_reminders (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  -- 'j7' : une semaine avant · 'j1' : la veille · 'j0' : le jour même.
  kind       text not null check (kind in ('j7', 'j1', 'j0')),

  -- L'échéance VISÉE, pas la date d'envoi. C'est elle qui rend la clé unique
  -- utile : elle change à chaque renouvellement.
  expires_at date not null,

  recipient  text not null,

  -- `pg_net` est asynchrone : il rend un identifiant de requête, la réponse
  -- arrive plus tard dans `net._http_response`. On le garde pour pouvoir
  -- constater après coup ce que Resend a répondu — sans quoi un échec
  -- d'acheminement serait invisible.
  request_id bigint,

  sent_at    timestamptz not null default now()
);

create unique index subscription_reminders_once
  on public.subscription_reminders (company_id, kind, expires_at);

create index subscription_reminders_company
  on public.subscription_reminders (company_id, sent_at desc);

alter table public.subscription_reminders enable row level security;

-- Lecture réservée aux administrateurs de plateforme, comme le reste de
-- l'espace d'administration. AUCUNE politique d'écriture : seule la fonction
-- `security definer` ci-dessous insère ici. Une politique d'insertion
-- permettrait à un client de se déclarer « déjà relancé » et de supprimer
-- silencieusement ses propres rappels.
create policy subscription_reminders_admin_select on public.subscription_reminders
  for select to authenticated
  using (public.is_platform_admin());

-- --- Le nom lisible d'une formule --------------------------------------------
--
-- ⚠️ Volontairement limité au NOM. Le PRIX n'apparaît nulle part ici : il vit
-- dans `lib/plans.ts`, source unique du montant. L'inscrire aussi en SQL en
-- ferait une seconde vérité, et le jour où le tarif bougerait, la relance
-- annoncerait un prix que la caisse ne pratique plus. Le message renvoie donc
-- vers /abonnement, où le prix est celui qui sera réellement demandé.

create or replace function public.plan_label(p public.plan_code)
returns text
language sql
immutable
as $$
  select case p
    when 'pro' then 'Pro'
    when 'business' then 'Entreprise'
    else 'Découverte'
  end;
$$;

-- --- L'envoi des relances ----------------------------------------------------

create or replace function public.send_expiry_reminders()
returns integer
language plpgsql
security definer
set search_path = public, net, vault, extensions
as $$
declare
  cle        text;
  aujourdhui date;
  ligne      record;
  marque     uuid;
  sujet      text;
  titre      text;
  message    text;
  bouton     text;
  corps      text;
  rid        bigint;
  envoyes    integer := 0;
begin
  select decrypted_secret into cle
  from vault.decrypted_secrets
  where name = 'resend_api_key';

  if cle is null or length(cle) < 10 then
    raise warning 'relances: aucune cle resend_api_key utilisable dans le coffre — rien envoye, rien marque';
    return 0;
  end if;

  -- Fuseau Africa/Douala, comme `lib/today.ts` et comme toute date métier du
  -- projet. En UTC, une échéance basculerait un jour trop tôt pour qui vit à
  -- Douala — et la relance « demain » arriverait le jour même.
  aujourdhui := (now() at time zone 'Africa/Douala')::date;

  for ligne in
    select s.company_id,
           s.plan,
           s.expires_at,
           c.name as entreprise,
           u.email as destinataire,
           case s.expires_at - aujourdhui
             when 7 then 'j7'
             when 1 then 'j1'
             when 0 then 'j0'
           end as kind
    from public.subscriptions s
    join public.companies c on c.id = s.company_id
    join public.company_members m on m.company_id = s.company_id and m.role = 'owner'
    join auth.users u on u.id = m.user_id
    where s.plan <> 'discovery'
      and s.expires_at is not null
      and (s.expires_at - aujourdhui) in (7, 1, 0)
      and u.email is not null
      and u.deleted_at is null
  loop
    -- On RÉSERVE d'abord, on envoie ensuite. Insérer avant l'appel réseau fait
    -- de la contrainte unique le verrou : deux exécutions simultanées ne
    -- peuvent pas produire deux envois. L'inverse — envoyer puis marquer —
    -- enverrait deux fois au moindre incident entre les deux.
    insert into public.subscription_reminders (company_id, kind, expires_at, recipient)
    values (ligne.company_id, ligne.kind, ligne.expires_at, ligne.destinataire)
    on conflict (company_id, kind, expires_at) do nothing
    returning id into marque;

    continue when marque is null;

    if ligne.kind = 'j7' then
      sujet   := format('Votre formule %s arrive à échéance dans 7 jours', public.plan_label(ligne.plan));
      titre   := 'Il vous reste une semaine';
      message := format(
        'La formule <strong>%s</strong> de %s prend fin le <strong>%s</strong>. '
        || 'Le renouvellement n''est pas automatique : le mobile money ne permet pas le prélèvement, '
        || 'c''est donc à vous de lancer le paiement.',
        public.plan_label(ligne.plan), ligne.entreprise, to_char(ligne.expires_at, 'DD/MM/YYYY'));
      bouton  := 'Renouveler maintenant';

    elsif ligne.kind = 'j1' then
      sujet   := format('Votre formule %s expire demain', public.plan_label(ligne.plan));
      titre   := 'Dernier rappel';
      message := format(
        'La formule <strong>%s</strong> de %s prend fin <strong>demain, le %s</strong>. '
        || 'Passé cette date, votre compte revient à la formule Découverte.',
        public.plan_label(ligne.plan), ligne.entreprise, to_char(ligne.expires_at, 'DD/MM/YYYY'));
      bouton  := 'Renouveler avant demain';

    else
      sujet   := format('Votre formule %s a pris fin aujourd''hui', public.plan_label(ligne.plan));
      titre   := 'Votre compte est revenu à la formule Découverte';
      -- ⚠️ Ce message doit RASSURER avant tout. Rien n'est fermé : la règle du
      -- projet est de redescendre en Découverte, jamais de verrouiller — les
      -- factures d'un entrepreneur sont sa comptabilité. Un message alarmant
      -- ferait croire à une perte de données qui n'a pas lieu.
      message := format(
        'La formule <strong>%s</strong> de %s s''est achevée le %s.<br><br>'
        || '<strong>Vous ne perdez rien.</strong> Toutes vos factures, vos devis et vos clients '
        || 'restent consultables et téléchargeables en PDF, et vos devis restent illimités. '
        || 'Seule l''émission de factures redevient plafonnée à cinq par mois, comme sur la formule gratuite.',
        public.plan_label(ligne.plan), ligne.entreprise, to_char(ligne.expires_at, 'DD/MM/YYYY'));
      bouton  := 'Reprendre ma formule';
    end if;

    corps := format(
      '<h2>%s</h2><p>%s</p>'
      || '<p><a href="https://www.xn-facture.com/abonnement">%s</a></p>'
      || '<p>Le règlement se fait par mobile money, à partir d''une référence de commande '
      || 'que la page vous indique. Votre accès est ouvert dès le paiement constaté.</p>'
      || '<p style="color:#7A7064;font-size:13px">Vous recevez ce message parce que vous êtes '
      || 'titulaire du compte %s sur XN-Facture.</p>',
      titre, message, bouton, ligne.entreprise);

    select net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
                   'Authorization', 'Bearer ' || cle,
                   'Content-Type', 'application/json'),
      body    := jsonb_build_object(
                   'from', 'XN-Facture <no-reply@xn-facture.com>',
                   'to', jsonb_build_array(ligne.destinataire),
                   'subject', sujet,
                   'html', corps),
      timeout_milliseconds := 15000
    ) into rid;

    update public.subscription_reminders set request_id = rid where id = marque;
    envoyes := envoyes + 1;
  end loop;

  return envoyes;
end;
$$;

revoke all on function public.send_expiry_reminders() from public, anon, authenticated;

-- --- Constater ce que Resend a répondu ---------------------------------------
--
-- `pg_net` étant asynchrone, la fonction ne peut pas savoir si l'envoi a
-- abouti : elle rend un identifiant, la réponse arrive après. Cette vue
-- rapproche les deux, pour qu'un échec d'acheminement ne reste pas invisible.

create or replace view public.subscription_reminders_status as
  select r.id,
         r.company_id,
         r.kind,
         r.expires_at,
         r.recipient,
         r.sent_at,
         rep.status_code,
         rep.error_msg
  from public.subscription_reminders r
  left join net._http_response rep on rep.id = r.request_id;

revoke all on public.subscription_reminders_status from anon, authenticated;

-- --- Le déclenchement quotidien ----------------------------------------------
--
-- 07:00 UTC, soit 08:00 à Douala : le message arrive en début de journée
-- ouvrée, pas au milieu de la nuit. Une seule exécution par jour suffit —
-- les échéances sont des dates civiles, pas des instants.

select cron.unschedule('relances-abonnement')
where exists (select 1 from cron.job where jobname = 'relances-abonnement');

select cron.schedule(
  'relances-abonnement',
  '0 7 * * *',
  $cron$ select public.send_expiry_reminders(); $cron$
);
