-- =============================================================================
-- XN-Facture — Durcissement des droits d'exécution
-- =============================================================================
-- Suite aux avis de sécurité Supabase du 26 sept. 2026. **Aucune faille
-- exploitable n'a été trouvée** : chaque fonction porte sa garde interne, et
-- toutes ont été essayées depuis l'extérieur avec la clé `anon` avant d'écrire
-- cette migration. Ce fichier retire une SURFACE, il ne répare pas une porte
-- ouverte. Relevé des essais, à titre de preuve :
--
--     rpc create_company_for_current_user   401  « Authentification requise. »
--     rpc next_document_number              401  « Accès refusé à cette entreprise. »
--     rpc attach_payment_links              401  « Aucune entreprise pour ce compte. »
--     rpc start_subscription_order          401  « Aucune entreprise pour ce compte. »
--     GET admin_actors                      401  permission denied for view
--
-- ⚠️ **CE QUE `revoke all ... from public` NE FAIT PAS — le défaut réel.**
-- Les migrations 0002, 0006, 0009 et 0010 écrivent, avec un commentaire qui
-- l'affirme : « Par défaut, PostgreSQL accorde l'exécution à `public`, ce qui
-- inclut le rôle anonyme. On restreint aux comptes authentifiés. »
--
-- **C'est faux sur un projet Supabase, et cela a été mesuré.** Supabase pose
-- un `alter default privileges ... grant execute on functions to anon,
-- authenticated, service_role` : chaque nouvelle fonction reçoit donc un droit
-- **nominatif** pour `anon`, en plus du droit implicite de `public`. Révoquer
-- `public` retire le second et laisse le premier intact. Résultat mesuré avant
-- cette migration : `has_function_privilege('anon', …)` valait **`true` sur 14
-- fonctions `security definer`**, dont toutes celles que ces commentaires
-- déclaraient réservées.
--
-- Les migrations 0005 et 0012 s'en sortaient, parce qu'elles nomment `anon`
-- explicitement (`revoke all on … from public, anon`). C'est la seule forme qui
-- fonctionne ici, et celle employée ci-dessous.
--
-- ⚠️ **POURQUOI CE N'ÉTAIT PAS EXPLOITABLE, et pourquoi on le corrige quand
-- même.** Sans session, `auth.uid()` est nul : `current_company_id()` rend
-- `null` et `is_company_member()` rend `false`, donc chaque fonction lève son
-- exception avant d'écrire. La défense en profondeur a tenu. Mais elle tenait
-- **seule**, et une seule fonction future qui oublierait sa garde serait
-- ouverte à l'internet entier. Le droit d'exécution est la ceinture ; la garde
-- interne est les bretelles. On remet la ceinture.
-- =============================================================================

begin;

-- --- 1. Fonctions qui exigent une session ------------------------------------
-- `anon` n'a aucune raison de les appeler : elles agissent toutes sur
-- l'entreprise de l'appelant, et sans appelant il n'y a rien à faire.
--
-- ⚠️ **`set_marketing_preference` N'EST PAS DANS CETTE LISTE, et ne doit pas y
-- entrer.** Le désabonnement se clique depuis une boîte mail, sur un appareil
-- sans session : son autorisation vient du jeton porté par l'URL (0012). La lui
-- retirer supprimerait la page de désabonnement pour tout le monde — et la
-- seule issue offerte au destinataire d'une campagne serait le bouton
-- « courrier indésirable », qui abîme la réputation du domaine d'envoi.
--
-- ⚠️ **`is_company_member`, `current_company_id` et `is_platform_admin` sont
-- appelées DANS les politiques RLS.** Une politique évalue ses fonctions avec
-- les droits du rôle qui interroge : leur retirer l'exécution à un rôle qui
-- doit lire ferait échouer la requête au lieu de la rendre vide. **Vérifié
-- avant de les inclure : les 26 politiques du schéma `public` sont TOUTES
-- `to authenticated`**, aucune ne s'applique à `anon`, donc `anon` n'évalue
-- jamais ces fonctions par ce chemin.

revoke execute on function public.is_company_member(uuid) from anon;
revoke execute on function public.current_company_id() from anon;
revoke execute on function public.is_platform_admin() from anon;
revoke execute on function public.create_company_for_current_user(text, text) from anon;
revoke execute on function public.next_document_number(uuid, public.document_kind, text, smallint) from anon;
revoke execute on function public.request_plan(text) from anon;
revoke execute on function public.start_subscription_order(text, text) from anon;
revoke execute on function public.cancel_subscription_order() from anon;
revoke execute on function public.attach_payment_links(text, text, jsonb) from anon;

-- --- 2. Fonctions de déclencheur ---------------------------------------------
-- Elles ne sont appelables par personne, jamais : leur place est au bout d'un
-- `create trigger`. PostgreSQL ne vérifie le droit d'exécution qu'à la
-- CRÉATION du déclencheur, pas à chaque déclenchement — retirer le droit ne
-- peut donc pas empêcher un déclencheur de faire son travail. **Vérifié après
-- migration, et non supposé** : insertion, mise à jour et plafond de factures
-- continuent de fonctionner.
--
-- ⚠️ **PostgREST ne les exposait déjà pas**, une fonction qui rend `trigger`
-- n'ayant pas de signature appelable : les trois répondaient `404 PGRST202`
-- avant cette migration. On ferme quand même, parce que cela ne coûte rien et
-- que la protection ne repose alors plus sur un détail d'implémentation de
-- PostgREST.

-- ⚠️ **IL FAUT LES DEUX RÉVOCATIONS, `public` ET `anon` — payé ici même.** Un
-- premier jet ne retirait que `anon, authenticated`. Résultat mesuré juste
-- après : `log_activity` était bien fermée, les trois autres **toujours
-- ouvertes**. L'explication est dans l'ACL brute, lue plutôt que devinée :
--
--     log_activity           postgres=X/postgres | service_role=X/postgres
--     enforce_invoice_quota  =X/postgres | postgres=X/postgres | service_role=X/postgres
--                            ↑ cette entrée sans rôle à gauche, c'est PUBLIC
--
-- 0004 avait révoqué `public` sur `log_activity`, les migrations 0001, 0006 et
-- 0007 ne l'avaient jamais fait sur les leurs. `anon` étant membre de `public`,
-- retirer son droit nominatif ne lui retire rien tant que `public` en a un.
-- **Les deux formes sont nécessaires, et aucune ne remplace l'autre** : c'est
-- le miroir exact du défaut décrit en tête de ce fichier. Contrôle qui tranche,
-- et le seul qui tranche :
--
--     select proacl from pg_proc where proname = '…';   -- « =X/ » ⇒ PUBLIC

revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.enforce_invoice_quota() from public, anon, authenticated;
revoke execute on function public.create_default_subscription() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- --- 3. `search_path` figé ---------------------------------------------------
-- Les deux seules fonctions du schéma qui l'avaient encore mutable. Un
-- `search_path` non figé laisse un appelant qui peut créer des objets placer un
-- homonyme dans un schéma consulté plus tôt, et détourner ce que la fonction
-- croit appeler. Aucune des deux n'est `security definer`, donc le risque était
-- faible — mais « faible » n'est pas « nul », et le coût est d'une ligne.
--
-- ⚠️ **`alter function`, et non `create or replace`.** Rien ne touche au corps
-- des fonctions : les récrire pour ajouter un réglage, c'est prendre le risque
-- de les récrire mal. Les deux corps sont conservés à l'octet près.
--
-- `search_path = ''` et non `public` : ni l'une ni l'autre ne référence le
-- moindre objet de schéma. `touch_updated_at` n'appelle que `now()`, qui vit
-- dans `pg_catalog` — toujours consulté implicitement, quel que soit le
-- réglage. `plan_label` ne fait qu'un `case` sur une valeur.

alter function public.touch_updated_at() set search_path = '';
alter function public.plan_label(public.plan_code) set search_path = '';

commit;

-- --- 4. `pg_net` — tentative, et pourquoi elle peut échouer -------------------
-- `net.http_post`, `net.http_get` et `net.http_delete` sont exécutables par
-- `anon` et `authenticated` : c'est le réglage par défaut de Supabase. Une
-- fonction qui fait émettre une requête HTTP arbitraire par la base est un
-- SSRF si on peut l'atteindre.
--
-- ⚠️ **ON NE PEUT PAS L'ATTEINDRE AUJOURD'HUI, et c'est la mesure qui le dit** :
--
--     POST /rest/v1/rpc/http_post                     404  PGRST202
--     POST /rest/v1/rpc/http_post  (Content-Profile: net)
--       406  « Only the following schemas are exposed: public, graphql_public »
--
-- Le schéma `net` n'est pas exposé par PostgREST. La vraie protection est là,
-- et elle ne dépend pas de ce bloc.
--
-- ⚠️ **DEUX RAISONS POUR QUE CE BLOC NE TIENNE PAS, à connaître avant de s'y
-- fier :**
--
-- 1. ces fonctions appartiennent à **`supabase_admin`**, pas à `postgres` :
--    selon les droits du rôle qui rejoue la migration, la révocation peut être
--    refusée. D'où le `do` et son `exception when others` — un durcissement
--    facultatif ne doit pas faire échouer une migration ;
-- 2. Supabase porte un déclencheur d'événement **`issue_pg_net_access` →
--    `grant_pg_net_access`**, qui réaccorde ces droits à chaque DDL touchant
--    l'extension. Une mise à jour de `pg_net` peut donc **annuler
--    silencieusement** ce qui suit. Ne pas conclure d'une régression du lint
--    que quelqu'un est revenu dessus à la main.
--
-- `send_expiry_reminders()` n'est pas concernée : elle est `security definer` et
-- appartient à `postgres`, qui conserve son droit. **Vérifié après migration.**

do $$
begin
  -- Signatures relevées dans `pg_proc`, et non devinées : `http_delete` porte un
  -- cinquième argument (`body jsonb`) que les trois autres n'ont pas, et
  -- `http_collect_response` est la quatrième fonction du schéma — oubliée à la
  -- première rédaction, c'est elle qui relit la réponse d'un appel.
  revoke execute on function net.http_post(text, jsonb, jsonb, jsonb, integer) from public, anon, authenticated;
  revoke execute on function net.http_get(text, jsonb, jsonb, integer) from public, anon, authenticated;
  revoke execute on function net.http_delete(text, jsonb, jsonb, integer, jsonb) from public, anon, authenticated;
  revoke execute on function net.http_collect_response(bigint, boolean) from public, anon, authenticated;
  raise notice 'pg_net : droits retirés à anon et authenticated.';
exception
  when others then
    raise notice 'pg_net : révocation impossible (%), sans conséquence — le schéma net n''est pas exposé par PostgREST.', sqlerrm;
end;
$$;
