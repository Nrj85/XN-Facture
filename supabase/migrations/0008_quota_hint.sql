-- ============================================================================
-- 0008 — Rendre le refus de quota reconnaissable par l'application
--
-- Le déclencheur 0007 refusait déjà correctement, mais son refus n'était
-- identifiable que par son TEXTE. L'interface ne pouvait donc rien en faire de
-- mieux qu'un bandeau rouge : impossible de distinguer « vous avez atteint
-- votre plafond, voici comment continuer » d'une panne quelconque sans
-- comparer des chaînes de caractères — ce qui casse à la première reformulation.
--
-- `errcode` ne pouvait pas servir de marqueur : PostgREST traduit `P0001` en
-- 400, et un code SQLSTATE inventé retomberait en 500. On passe donc par
-- `hint`, que PostgREST renvoie tel quel dans le corps JSON et que
-- `supabase-js` expose en `error.hint`.
--
-- ⚠️ `hint` sert ici d'ÉTIQUETTE MACHINE, pas de conseil affiché. Sa valeur est
-- lue par `failFromDb()` (`lib/actions/result.ts`) et ne doit pas être
-- traduite ni reformulée. Le texte destiné à l'utilisateur reste le `message`.
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
    -- `message` = ce que lit l'utilisateur si rien ne l'intercepte.
    -- `hint`    = l'étiquette que l'application reconnaît pour ouvrir la
    --             fenêtre d'invitation à changer de formule.
    raise exception
      'Formule Découverte : % factures par mois au maximum, et vous y êtes. Passez à la formule Pro pour des factures illimitées, ou attendez le mois prochain.',
      v_limite
      using errcode = 'P0001', hint = 'plan-limit';
  end if;

  return new;
end;
$fn$;
