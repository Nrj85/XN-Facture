-- ============================================================================
-- 0007 — Le plafond de la formule Découverte
--
-- La page d'accueil promet « 5 factures par mois » depuis le début, et rien ne
-- l'appliquait : tout le monde avait tout. C'était à la fois un mensonge
-- (§6.1 : pas de contrôle mort) et la raison pour laquelle personne n'aurait
-- payé — la formule gratuite donnait déjà la formule payante.
--
-- ⚠️ POURQUOI DANS LA BASE, ET PAS DANS LES SERVER ACTIONS.
-- `invoices_insert` et `invoices_update` (0003_rls.sql) autorisent tout membre
-- à écrire ses propres factures. Un contrôle posé dans `lib/actions/` serait
-- donc contournable par un simple appel REST : `PATCH /invoices?id=eq.…` avec
-- `status=sent`. Un plafond qu'on peut sauter en une commande curl n'est pas un
-- plafond. Ici, c'est la base qui refuse — et elle refuse sur TOUS les chemins
-- à la fois : création envoyée, envoi d'un brouillon, changement de statut, et
-- même l'encaissement, qui attribue un numéro à une facture qui n'en avait pas.
-- ============================================================================

create or replace function public.enforce_invoice_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_plan    public.plan_code;
  v_expires date;
  v_limite  int;
  v_emises  int;
begin
  -- Un brouillon ne consomme rien. C'est la même règle que la numérotation :
  -- « un brouillon ne consomme pas de numéro ». Le plafond ne mord qu'au
  -- moment où la facture devient un document émis.
  if new.status = 'draft' then
    return new;
  end if;

  -- Une facture DÉJÀ émise qu'on modifie ne repasse pas à la caisse. La
  -- modification d'une facture envoyée est libre (décision verrouillée, §8) :
  -- la bloquer ici reviendrait à revenir dessus par la bande.
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    return new;
  end if;

  select plan, expires_at into v_plan, v_expires
  from public.subscriptions
  where company_id = new.company_id;

  -- Entreprise sans ligne d'abonnement : on ne bloque pas. Le déclencheur
  -- `companies_default_subscription` en crée une pour toute nouvelle
  -- entreprise, donc ce cas n'arrive pas — mais refuser une facture à cause
  -- d'une ligne manquante serait une punition pour un défaut interne.
  if v_plan is null then
    return new;
  end if;

  -- ⚠️ Une formule payée mais EXPIRÉE redescend en Découverte. On ne ferme
  -- jamais la porte : les factures d'un entrepreneur sont sa comptabilité, et
  -- la lecture, l'export PDF et les devis restent ouverts. Seule la création
  -- de nouvelles factures retrouve le plafond gratuit.
  if v_plan <> 'discovery' and v_expires is not null and v_expires < current_date then
    v_plan := 'discovery';
  end if;

  if v_plan <> 'discovery' then
    return new;
  end if;

  v_limite := 5;

  -- Le mois est celui de la DATE D'ÉMISSION, pas celui d'aujourd'hui : c'est
  -- elle qui rattache une facture à une période, partout ailleurs dans le
  -- produit (tableau de bord, filtres). Compter sur `now()` ferait basculer le
  -- quota d'une facture antidatée dans le mauvais mois.
  select count(*) into v_emises
  from public.invoices
  where company_id = new.company_id
    and status <> 'draft'
    and date_trunc('month', issue_date) = date_trunc('month', new.issue_date)
    and id <> new.id;

  if v_emises >= v_limite then
    -- Ce message est celui que lit l'utilisateur : `describeDbError` retombe
    -- sur `error.message`. Il est donc rédigé en français, et il dit quoi
    -- faire — une erreur qui ne propose pas de suite est une impasse.
    raise exception
      'Formule Découverte : % factures par mois au maximum, et vous y êtes. Passez à la formule Pro pour des factures illimitées, ou attendez le mois prochain.',
      v_limite
      using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

create trigger invoices_quota
  before insert or update on public.invoices
  for each row execute function public.enforce_invoice_quota();
