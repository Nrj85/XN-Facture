-- =============================================================================
-- 0022 — Un administrateur de plateforme peut OCTROYER une formule
--
-- Demande de l'utilisateur : « que je puisse, depuis mon compte
-- administrateur, octroyer une nouvelle formule à un client qui est par
-- exemple à Découverte, le faire passer à Pro ou à Entreprise ».
--
-- ⚠️ **CETTE CAPACITÉ EXISTE DÉJÀ — ce fichier ne l'invente pas, il la sort de
-- la console SQL.** CLAUDE.md documente depuis le 9 sept. 2026 la procédure
-- manuelle d'activation après paiement : un `update` sur `subscriptions`, un
-- autre sur `subscription_orders`. Le risque n'augmente donc pas : il se
-- déplace d'un endroit sans trace vers un endroit qui en laisse une.
--
-- ⚠️ **CE FICHIER ROUVRE LA DÉCISION « LECTURE SEULE » DU §8**, et il faut le
-- dire. L'espace d'administration est en lecture seule par décision explicite
-- de l'utilisateur ; 0016 l'avait rouverte pour les SEULS témoignages, avec
-- l'avertissement « ne pas en faire un précédent — pour une facture, une
-- formule ou un journal, la réponse est tout autre ». C'est précisément une
-- formule. La décision est reprise **par l'utilisateur, explicitement**, et
-- elle reste bornée à ce qui suit :
--
--   * aucune politique RLS d'écriture n'est ajoutée sur `subscriptions` —
--     la table reste sans `insert`, `update` ni `delete` pour QUI QUE CE SOIT ;
--   * le seul chemin est cette fonction, `security definer`, dont la garde
--     `is_platform_admin()` est à l'intérieur ;
--   * `subscription_payments` n'est PAS touchée — voir en fin de fichier,
--     c'est un choix de fond.
--
-- ⚠️ **POURQUOI PAS UNE POLITIQUE RLS.** Une politique `update … using
-- (is_platform_admin())` sur `subscriptions` laisserait un administrateur
-- écrire **n'importe quelle colonne, sur n'importe quelle ligne, par un simple
-- `PATCH` REST** — y compris poser une échéance en 2099, ou réécrire
-- `requested` pour brouiller la piste. Une fonction, elle, ne peut faire que
-- ce qu'elle fait : trois écritures nommées, bornées, et journalisées.
-- =============================================================================

begin;

-- ⚠️ **LES NOMS DE SORTIE NE REPRENNENT PAS CEUX DES COLONNES.** `returns
-- table (plan …, expires_at …)` déclarerait des VARIABLES homonymes des
-- colonnes de `subscriptions`, et `set plan = …` deviendrait ambigu : la
-- fonction échouerait **à l'exécution**, pas à la création. C'est le piège
-- `42702` déjà payé en 0012.
create or replace function public.admin_set_plan(
  p_company uuid,
  p_plan    text,
  p_months  integer default 1
)
returns table (
  formule_posee   public.plan_code,
  echeance_posee  date,
  commande_soldee boolean
)
language plpgsql
security definer
-- ⚠️ `search_path` vide — discipline de 0015. Tout est donc qualifié, y
-- compris `auth.uid()` et `public.is_platform_admin()`.
set search_path = ''
as $fn$
declare
  -- ⚠️ **LA DATE EST CALCULÉE EN `Africa/Douala`**, comme `lib/today.ts`,
  -- comme 0011 et comme `plan_effectif()` en 0021. En UTC, une formule
  -- octroyée un soir porterait l'échéance du lendemain.
  v_today  date := (now() at time zone 'Africa/Douala')::date;
  v_plan   public.plan_code;
  v_avant  public.subscriptions%rowtype;
  v_depart date;
  v_fin    date;
  v_solde  boolean := false;
begin
  -- --- La garde, DANS la fonction --------------------------------------------
  --
  -- `security definer` fait tomber la RLS : sans ce test, tout compte
  -- authentifié pourrait s'octroyer Entreprise d'un seul appel REST. C'est la
  -- même discipline que `marketing_recipients()` en 0012.
  if not public.is_platform_admin() then
    raise exception 'Réservé aux administrateurs de plateforme.'
      using errcode = '42501';
  end if;

  -- --- Validation --------------------------------------------------------------
  --
  -- Liste fermée, revalidée ici : la fonction est appelable directement par
  -- tout client authentifié, le paramètre ne vient donc jamais d'un écran de
  -- confiance.
  if p_plan is null or p_plan not in ('discovery', 'pro', 'business') then
    raise exception 'Formule inconnue.' using errcode = '22023';
  end if;
  v_plan := p_plan::public.plan_code;

  if p_months is null or p_months < 0 or p_months > 24 then
    raise exception 'Durée hors bornes : de 1 à 24 mois.' using errcode = '22023';
  end if;

  select * into v_avant from public.subscriptions s where s.company_id = p_company;
  if not found then
    raise exception 'Aucune formule pour cette entreprise.' using errcode = '23503';
  end if;

  -- --- Le cas Découverte -------------------------------------------------------
  --
  -- ⚠️ **REDESCENDRE EST TOUJOURS PERMIS, et l'échéance est effacée.**
  -- Découverte n'expire pas : elle EST l'état d'expiration. Lui laisser une
  -- `expires_at` ferait mentir `/abonnement`, qui afficherait une date de fin
  -- sur une formule gratuite. `p_months` est ignoré ici, délibérément.
  if v_plan = 'discovery'::public.plan_code then
    update public.subscriptions s
      set plan = v_plan, expires_at = null
      where s.company_id = p_company;
    v_fin := null;

  else
    if p_months < 1 then
      raise exception 'Une formule payante demande au moins un mois.'
        using errcode = '22023';
    end if;

    -- ⚠️ **PROLONGER OU REPARTIR : LA RÈGLE DÉPEND DU CHANGEMENT DE FORMULE.**
    --
    --   * même formule, échéance encore valable  -> on PROLONGE depuis elle.
    --     C'est la règle déjà retenue pour le webhook Tara : renouveler une
    --     semaine avant le terme ferait sinon PERDRE cette semaine — on
    --     paierait pour se faire retirer du temps ;
    --   * formule différente, ou échéance déjà passée -> on repart
    --     d'aujourd'hui. Prolonger un Pro expiré depuis trois mois offrirait
    --     ces trois mois ; prolonger un Pro en cours par du Entreprise
    --     surclasserait gratuitement la période déjà payée.
    if v_avant.plan = v_plan
       and v_avant.expires_at is not null
       and v_avant.expires_at > v_today then
      v_depart := v_avant.expires_at;
    else
      v_depart := v_today;
    end if;

    v_fin := (v_depart + (p_months || ' months')::interval)::date;

    update public.subscriptions s
      set plan       = v_plan,
          expires_at = v_fin,
          -- ⚠️ **`requested` N'EST EFFACÉE QUE SI ELLE EST EXAUCÉE.** C'est
          -- l'intention commerciale du client : la vider en lui accordant
          -- autre chose effacerait la seule trace de ce qu'il était venu
          -- chercher.
          requested  = case when s.requested = v_plan then null else s.requested end
      where s.company_id = p_company;
  end if;

  -- --- La commande en attente ---------------------------------------------------
  --
  -- ⚠️ **ON NE SOLDE QUE LA COMMANDE QUI CORRESPOND À LA FORMULE OCTROYÉE.**
  -- L'index unique partiel de 0009 garantit au plus UNE commande en attente
  -- par entreprise — mais rien ne dit qu'elle porte la même formule. Octroyer
  -- Pro en marquant « payée » une commande Entreprise écrirait une contre-
  -- vérité dans la seule table qui trace les intentions d'achat.
  update public.subscription_orders o
    set status = 'paid'
    where o.company_id = p_company
      and o.status = 'pending'
      and o.plan = v_plan;
  v_solde := found;

  -- --- Le journal -----------------------------------------------------------------
  --
  -- ⚠️ **C'EST LA CONTREPARTIE DE L'OUVERTURE, PAS UN ORNEMENT.** Le geste vaut
  -- de l'argent et ne laissait aucune trace tant qu'il se faisait en console
  -- SQL. `actor_id` porte l'administrateur : on sait QUI a octroyé QUOI, à QUI,
  -- et jusqu'à QUAND.
  --
  -- `action = 'status_changed'` plutôt qu'un verbe neuf : l'écran
  -- d'administration sait déjà peindre cette valeur, et `entity =
  -- 'subscription'` suffit à distinguer la ligne. Inventer une action aurait
  -- demandé de toucher au rendu pour un gain nul.
  insert into public.activity_log
    (company_id, actor_id, entity, entity_id, action, details)
  values (
    p_company,
    auth.uid(),
    'subscription',
    p_company,
    'status_changed',
    jsonb_build_object(
      'previous_status',   v_avant.plan::text,
      'status',            v_plan::text,
      'previous_expires',  v_avant.expires_at,
      'expires_at',        v_fin,
      'months',            case when v_plan = 'discovery'::public.plan_code
                                then null else p_months end,
      'order_marked_paid', v_solde,
      'granted_by_admin',  true
    )
  );

  return query select v_plan, v_fin, v_solde;
end;
$fn$;

-- ⚠️ **LES DEUX RÉVOCATIONS SONT NÉCESSAIRES, AUCUNE NE REMPLACE L'AUTRE.**
-- Supabase pose un `alter default privileges … grant execute … to anon,
-- authenticated` : révoquer `public` laisse le droit NOMINATIF d'`anon`, et
-- révoquer `anon` laisse le droit implicite de PUBLIC. C'est le piège de 0015,
-- reproduit à l'identique sur les fonctions en 0019.
--
-- Le juge est l'ACL brute, jamais ce fichier :
--   select proacl from pg_proc where proname = 'admin_set_plan';
--   -- une entrée nue « =X/postgres » signifierait que PUBLIC a encore EXECUTE
revoke all on function public.admin_set_plan(uuid, text, integer) from public;
revoke all on function public.admin_set_plan(uuid, text, integer) from anon;
grant execute on function public.admin_set_plan(uuid, text, integer) to authenticated;

comment on function public.admin_set_plan(uuid, text, integer) is
  'Octroi d''une formule par un administrateur de plateforme. Garde interne is_platform_admin(). N''ecrit JAMAIS dans subscription_payments : ce journal ne porte que de l''argent reellement encaisse.';

commit;

-- =============================================================================
-- ⚠️ CE QUI N'EST VOLONTAIREMENT PAS FAIT ICI
--
-- **Aucune écriture dans `subscription_payments`.** Ce serait le réflexe — « on
-- active, donc on a été payé » — et ce serait faux. Cette table journalise de
-- l'argent RÉELLEMENT encaissé, avec son montant, son canal et sa référence de
-- prestataire. Un octroi administratif peut suivre un virement, un geste
-- commercial, une correction d'erreur ou un essai : y inscrire un montant
-- inventé polluerait la seule source du chiffre d'affaires réel, et la ferait
-- diverger de ce que l'agrégateur confirmera le jour où il sera branché.
-- La trace de l'octroi est dans `activity_log`, à sa place.
--
-- **Aucune règle d'expiration nouvelle.** Elle existe déjà en TROIS exemplaires
-- — `effectivePlan()` (lib/plans.ts), `enforce_invoice_quota()` (0007/0008) et
-- `public.plan_effectif()` (0021). Cette fonction POSE une échéance ; elle ne
-- décide jamais si une formule est expirée. Un quatrième exemplaire aurait
-- garanti la divergence.
-- =============================================================================
