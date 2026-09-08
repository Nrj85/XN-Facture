-- =============================================================================
-- XN-Facture — Comptes visibles par l'administrateur
-- =============================================================================
-- `auth.users` n'est pas exposé par PostgREST : seul le schéma `public` l'est.
-- Sans cette vue, le journal d'activité ne pourrait afficher qu'un identifiant
-- technique — « qui a fait quoi » resterait sans réponse, ce qui vide de son
-- sens un espace d'administration.
--
-- **Le filtre est DANS la vue.** Une vue ne porte pas de politique RLS ; c'est
-- donc sa clause `where` qui fait office de garde. `public.is_platform_admin()`
-- y est évaluée à chaque requête : pour tout autre compte, la vue est vide.
--
-- La vue est en `security definer` (le défaut pour une vue) : elle lit
-- `auth.users` avec les droits de son propriétaire, puisque l'appelant n'y a
-- aucun accès. C'est exactement pour cela que la garde ne peut pas être
-- oubliée — sans elle, la vue exposerait tous les comptes du projet.
--
-- Aucune donnée sensible n'y figure : ni mot de passe, ni jeton, ni métadonnée
-- de session. Seulement de quoi identifier un compte et savoir s'il est actif.
-- =============================================================================

begin;

create or replace view public.admin_actors as
select
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  u.email_confirmed_at is not null as email_confirme
from auth.users u
where public.is_platform_admin();

comment on view public.admin_actors is
  'Comptes du projet, visibles des seuls administrateurs de plateforme. La garde est la clause where de la vue : une vue ne porte pas de politique RLS.';

revoke all on public.admin_actors from public, anon;
grant select on public.admin_actors to authenticated;

commit;
