-- ============================================================================
-- 0013 — Ne pas renouveler son abonnement
--
-- ⚠️ **IL N'Y A RIEN À INTERROMPRE, et c'est tout le sujet.** Le mobile money
-- ne sait pas prélever : il n'existe aucun débit récurrent à annuler. Un bouton
-- « Résilier » qui prétendrait couper quelque chose serait un contrôle mort,
-- proscrit par le §6.1.
--
-- Ce que la personne veut réellement dire est : « je ne compte pas renouveler ».
-- Cette déclaration a deux effets RÉELS, et c'est ce qui la distingue d'un
-- bouton décoratif :
--
--   1. **les relances J-7 et J-1 cessent** — continuer à réclamer un paiement
--      à quelqu'un qui a dit non est du harcèlement ;
--   2. **l'écran cesse de proposer le renouvellement** et annonce la date de
--      fin, pour que personne ne découvre le changement de formule par
--      surprise.
--
-- ⚠️ **`expires_at` N'EST PAS TOUCHÉE.** Ce qui est payé reste dû : quelqu'un
-- qui a réglé douze mois d'avance et renonce au mois suivant garde son accès
-- jusqu'au terme. Raccourcir la période serait lui reprendre son argent.
--
-- ⚠️ **LA RELANCE J-0 EST CONSERVÉE.** Elle ne réclame rien : elle constate le
-- retour en Découverte et rassure sur ce qui est conservé. La supprimer ferait
-- découvrir le plafond de cinq factures au milieu d'une saisie.
-- ============================================================================

alter table public.subscriptions
  add column if not exists renewal_declined boolean not null default false;

comment on column public.subscriptions.renewal_declined is
  'La personne a déclaré ne pas renouveler. N''avance PAS l''échéance : ce qui est payé reste dû.';

-- --- Déclarer son intention --------------------------------------------------
--
-- Même forme que `request_plan` : `security definer`, et **aucun identifiant
-- d'entreprise en paramètre**. La fonction agit sur celle de l'appelant, il n'y
-- a donc rien à falsifier. C'est ce qui permet d'ouvrir cette écriture alors
-- que `subscriptions` n'a aucune politique d'écriture.

create or replace function public.set_renewal_intent(p_renew boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_company uuid;
begin
  v_company := public.current_company_id();

  if v_company is null then
    raise exception 'Aucune entreprise rattachée à ce compte.'
      using errcode = 'P0001';
  end if;

  update public.subscriptions s
  set renewal_declined = not p_renew,
      updated_at = now()
  where s.company_id = v_company
    and s.plan <> 'discovery'
    and s.expires_at is not null;

  if not found then
    -- Message rédigé POUR ÊTRE LU À L'ÉCRAN : `describeDbError` relaie les
    -- exceptions `P0001` telles quelles. Toute nouvelle exception de ce type
    -- doit donc être écrite comme un texte d'interface.
    raise exception 'La formule Découverte n''a pas d''échéance : il n''y a rien à résilier.'
      using errcode = 'P0001';
  end if;
end;
$fn$;

revoke all on function public.set_renewal_intent(boolean) from public, anon;
grant execute on function public.set_renewal_intent(boolean) to authenticated;

-- --- Les relances tiennent compte du refus -----------------------------------
--
-- Seule la clause `where` change : on ajoute l'exclusion des J-7 et J-1 pour
-- qui a dit ne pas renouveler. Le reste de la fonction est identique à 0011.

create or replace function public.send_expiry_reminders()
returns integer
language plpgsql
security definer
set search_path = public, net, vault, extensions
as $fn$
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
      -- ⚠️ Qui a déclaré ne pas renouveler ne reçoit plus que le J-0. Les J-7
      -- et J-1 réclament un paiement ; les envoyer quand même reviendrait à
      -- ignorer une décision déjà prise.
      and (s.renewal_declined = false or (s.expires_at - aujourdhui) = 0)
  loop
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
$fn$;

revoke all on function public.send_expiry_reminders() from public, anon, authenticated;
