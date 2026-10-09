-- 0021 — le papier à en-tête devient une fonction des formules PAYANTES.
--
-- Demande de l'utilisateur, 9 oct. 2026 : « que l'option du papier en-tête
-- personnalisé ne soit disponible qu'à partir de la formule Pro et non pas à
-- la formule gratuite ».
--
-- ⚠️ **CE N'EST PAS UNE RESTRICTION NOUVELLE : C'EST UN ALIGNEMENT.** La
-- grille tarifaire VEND DÉJÀ cette fonction comme une ligne de la formule Pro
-- — « Votre papier à en-tête sur chaque facture et chaque devis »
-- (`lib/plans.ts`), servi en production — alors qu'elle était ouverte à
-- Découverte. C'est le défaut du 7 oct. 2026 dans l'autre sens : là-bas on
-- vendait ce qui n'existait pas, ici on donnait ce qu'on faisait payer.
--
-- ⚠️ **LE VERROU EST ICI, PAS DANS LA SERVER ACTION, et c'est la leçon de
-- 0007.** `companies_update` (0003) autorise un membre à modifier **n'importe
-- quelle colonne** de son entreprise, et `company_letterheads` a une politique
-- d'écriture pour les membres. Un contrôle purement applicatif se sauterait
-- donc d'un `PATCH /rest/v1/companies?id=eq.<uuid>` portant
-- `letterhead_mode=image`. Un verrou qu'on saute en une commande curl n'est
-- pas un verrou.
--
-- ============================================================================
-- CE QUI EST FERMÉ, ET CE QUI RESTE OUVERT — décision explicite de
-- l'utilisateur, 9 oct. 2026
-- ============================================================================
--
-- ⚠️ **ON FERME L'ÉCRITURE, PAS L'IMPRESSION.** Un en-tête déjà enregistré
-- continue d'être dessiné sur les PDF, même en Découverte. Trois raisons, et
-- la première est une règle du projet :
--
--   1. « À l'expiration, redescendre en Découverte, JAMAIS fermer : lecture,
--      export PDF et devis restent ouverts. » Arrêter le dessin fermerait.
--   2. **Un PDF est une pièce déjà remise à un client.** Le projet gèle
--      `vat_rate` et `vat_exempt` sur chaque document précisément pour qu'une
--      réimpression ressemble à ce que le client a reçu. Un en-tête qui
--      disparaîtrait rétroactivement contredirait cette discipline.
--   3. Mesuré avant d'écrire : **les 8 entreprises de la base sont en
--      Découverte, et une seule utilise la fonction** (mode `image`, image
--      posée). Fermer l'impression n'aurait eu, aujourd'hui, qu'un seul effet
--      observable : retirer son en-tête au seul utilisateur réel.
--
-- Contrepartie commerciale assumée : un mois de Pro suffit à poser un en-tête
-- qui restera. Mais il devient **figé** — le jour où l'entreprise change de
-- logo, d'adresse ou de marges, il faut repasser par une formule payante.
--
-- `getLetterhead()` et `letterheadIfUsed()` (`lib/db/letterhead.ts`) ne sont
-- donc PAS touchés, et leur commentaire le dit.

begin;

-- ============================================================================
-- 1. La formule qui s'applique VRAIMENT
-- ============================================================================
--
-- ⚠️ **LA RÈGLE D'EXPIRATION EXISTAIT EN DEUX EXEMPLAIRES ; CETTE FONCTION EN
-- EST LE TROISIÈME, ET IL FAUT LE DIRE.** Les deux autres sont
-- `effectivePlan()` (`lib/plans.ts`, pour l'affichage) et le corps de
-- `enforce_invoice_quota()` (0007/0008, qui l'inline). **Toute modification de
-- la règle doit toucher les trois.**
--
-- Pourquoi ne pas avoir unifié tout de suite : brancher 0007 sur cette
-- fonction obligerait à REMPLACER `enforce_invoice_quota()` en entier — il
-- n'existe pas de modification partielle d'une fonction PL/pgSQL — donc à
-- réécrire le verrou principal du produit, celui qui tient le plafond de cinq
-- factures. C'est faisable et souhaitable, mais avec son propre plan de
-- contrôle (5 acceptées / la 6ᵉ refusée / brouillons libres / `PATCH` sur une
-- facture déjà émise accepté / plafond levé en Pro / retrouvé à l'expiration).
-- **Tâche à part entière, pas en passant.**
--
-- Elle existe malgré tout, parce que le prochain verrou de formule — export
-- comptable, multi-utilisateur — ne doit pas inliner la règle une QUATRIÈME
-- fois, et parce qu'un nom est l'endroit où l'on regarde.
create or replace function public.plan_effectif(p_company_id uuid)
returns public.plan_code
language sql
-- `security definer` : les déclencheurs ci-dessous l'appellent en tant que
-- propriétaire, et personne d'autre n'a besoin de la joindre.
security definer
-- ⚠️ `search_path` vide — discipline de 0015. Tout est donc qualifié.
set search_path = ''
stable
as $fn$
  select case
           -- La gratuite n'expire pas : elle EST l'état d'expiration.
           when s.plan = 'discovery'::public.plan_code
             then 'discovery'::public.plan_code
           -- ⚠️ **LA DATE EST CALCULÉE EN `Africa/Douala`**, comme
           -- `lib/today.ts` et comme 0011. En UTC, une formule expirerait un
           -- jour trop tôt ou trop tard pour qui vit à Douala — et ce décalage
           -- ne se verrait que chez l'utilisateur, un soir.
           when s.expires_at is not null
                and s.expires_at < (now() at time zone 'Africa/Douala')::date
             then 'discovery'::public.plan_code
           else s.plan
         end
  from public.subscriptions s
  where s.company_id = p_company_id;
$fn$;

-- ⚠️ **LES DEUX FORMES DE RÉVOCATION SONT NÉCESSAIRES — leçon de 0015.**
-- Supabase pose `alter default privileges … grant execute on functions to
-- anon, authenticated, service_role` : la fonction naît exécutable par `anon`
-- par un droit **nominatif**, qui s'ajoute au droit implicite de `public`.
-- Révoquer l'un laisse l'autre. **Aucune ne remplace l'autre.**
--
-- Ici on révoque aussi à `authenticated` : aucun client n'a besoin d'appeler
-- cette fonction, les déclencheurs l'atteignent en `security definer`.
revoke all on function public.plan_effectif(uuid) from public;
revoke all on function public.plan_effectif(uuid) from anon;
revoke all on function public.plan_effectif(uuid) from authenticated;

-- ============================================================================
-- 2. Le réglage sur `companies`
-- ============================================================================
create or replace function public.enforce_letterhead_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_plan    public.plan_code;
  v_touche  boolean;
begin
  -- ⚠️ **REVENIR À « aucun » RESTE TOUJOURS PERMIS, et ce n'est pas une
  -- politesse : sans cette sortie, l'écran serait un PIÈGE.** Quelqu'un en
  -- Découverte qui bascule sur « Aucun » par curiosité ne pourrait plus jamais
  -- revenir en arrière, et aurait perdu son en-tête d'un clic. On n'empêche
  -- jamais de RÉDUIRE son usage.
  if new.letterhead_mode = 'none' then
    return new;
  end if;

  -- ⚠️ **ON NE REFUSE QUE SI L'UNE DES QUATRE COLONNES D'EN-TÊTE CHANGE
  -- RÉELLEMENT — c'est le point le plus important de ce déclencheur.** Sans
  -- cette garde, une entreprise en Découverte dont le mode vaut `image` ne
  -- pourrait **plus enregistrer aucun réglage d'entreprise** : ni son nom, ni
  -- son adresse, ni son taux de TVA. Le formulaire d'entreprise ne nomme pas
  -- ces colonnes (`fromCompany` les exclut), donc elles arrivent inchangées —
  -- et un refus porterait alors sur une écriture qui ne touche pas l'en-tête.
  --
  -- `is distinct from` et non `<>` : l'un des champs pourrait être nul sur une
  -- base où 0017 vient d'être appliquée, et `null <> null` ne vaut pas `true`.
  if tg_op = 'UPDATE' then
    v_touche := (
      new.letterhead_mode,
      new.letterhead_top_mm,
      new.letterhead_bottom_mm,
      new.letterhead_keep_legal
    ) is distinct from (
      old.letterhead_mode,
      old.letterhead_top_mm,
      old.letterhead_bottom_mm,
      old.letterhead_keep_legal
    );

    if not v_touche then
      return new;
    end if;
  end if;

  v_plan := public.plan_effectif(new.id);

  -- Entreprise sans ligne d'abonnement : on ne bloque pas. Même raisonnement
  -- que 0007 — le déclencheur `companies_default_subscription` en crée une
  -- pour toute nouvelle entreprise, donc le cas n'arrive pas ; et refuser un
  -- réglage à cause d'une ligne interne manquante serait punir l'utilisateur
  -- d'un défaut qui n'est pas le sien. C'est aussi ce qui laisse passer
  -- l'INSERT d'une entreprise, dont l'abonnement n'existe pas encore.
  if v_plan is null or v_plan <> 'discovery'::public.plan_code then
    return new;
  end if;

  -- ⚠️ **CE MESSAGE EST CELUI QUE L'UTILISATEUR LIT.** `describeDbError` a un
  -- cas `P0001` qui relaie le texte tel quel : il est donc rédigé en français,
  -- et il dit quoi faire — un refus qui ne propose aucune suite est une
  -- impasse (§6.1).
  --
  -- ⚠️ **PAS de `hint = 'plan-limit'`**, contrairement à 0008. Ce `hint`
  -- déclenche la fenêtre `plan-limit.tsx`, dont tout le texte parle du plafond
  -- de cinq factures par mois : elle répondrait à côté. Sans `hint`,
  -- `failFromDb` retombe sur `fail(message)` et la phrase ci-dessous
  -- s'affiche sur la carte, là où le geste a été fait.
  raise exception
    'Le papier à en-tête personnalisé est réservé aux formules Pro et Entreprise. Passez à une formule payante pour le régler.'
    using errcode = 'P0001';
end;
$fn$;

revoke all on function public.enforce_letterhead_plan() from public;
revoke all on function public.enforce_letterhead_plan() from anon;
revoke all on function public.enforce_letterhead_plan() from authenticated;

drop trigger if exists companies_letterhead_plan on public.companies;
create trigger companies_letterhead_plan
  before insert or update on public.companies
  for each row execute function public.enforce_letterhead_plan();

-- ============================================================================
-- 3. L'image elle-même
-- ============================================================================
--
-- ⚠️ **LE DEUXIÈME DÉCLENCHEUR N'EST PAS REDONDANT.** `company_letterheads`
-- porte sa propre politique d'écriture pour les membres (0017) : sans lui, une
-- entreprise en Découverte ne pourrait pas activer le MODE, mais pourrait
-- quand même déposer ou remplacer son image par un
-- `POST /rest/v1/company_letterheads`. Le réglage et l'image sont deux portes.
create or replace function public.enforce_letterhead_image_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_plan public.plan_code;
begin
  v_plan := public.plan_effectif(new.company_id);

  if v_plan is null or v_plan <> 'discovery'::public.plan_code then
    return new;
  end if;

  raise exception
    'Le papier à en-tête personnalisé est réservé aux formules Pro et Entreprise. Passez à une formule payante pour en téléverser un.'
    using errcode = 'P0001';
end;
$fn$;

revoke all on function public.enforce_letterhead_image_plan() from public;
revoke all on function public.enforce_letterhead_image_plan() from anon;
revoke all on function public.enforce_letterhead_image_plan() from authenticated;

-- ⚠️ **`before insert or update` — PAS `delete`.** Retirer son en-tête doit
-- rester possible en Découverte : c'est une réduction d'usage, et l'interdire
-- enfermerait quelqu'un avec une image qu'il ne veut plus. Même règle que la
-- sortie « aucun » du déclencheur précédent.
drop trigger if exists company_letterheads_plan on public.company_letterheads;
create trigger company_letterheads_plan
  before insert or update on public.company_letterheads
  for each row execute function public.enforce_letterhead_image_plan();

commit;

-- ============================================================================
-- Marche arrière
-- ============================================================================
--
-- Retirer les deux déclencheurs suffit : cette migration ne modifie aucune
-- donnée, elle n'ajoute que des refus.
--
--   drop trigger if exists companies_letterhead_plan on public.companies;
--   drop trigger if exists company_letterheads_plan on public.company_letterheads;
--
-- ⚠️ **NE PAS supprimer `public.plan_effectif(uuid)` sans vérifier qui
-- l'appelle** — elle est faite pour servir aux verrous de formule suivants.
--
-- ⚠️ **ET NE PAS LA RECRÉER SANS LES TROIS `revoke`.** C'est la faute payée le
-- 8 oct. 2026 sur 0020 : un bloc de marche arrière qui révoque `public` et
-- `anon` seulement laisse intact le droit NOMINATIF que Supabase accorde par
-- défaut — ici à `authenticated`, qui est précisément le rôle de tout client
-- connecté. Les trois, ou aucune.
