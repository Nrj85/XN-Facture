-- 0019 — `admin_actors` devient une FONCTION. Étape 1 sur 2.
--
-- ⚠️ **LA VUE N'EST PAS SUPPRIMÉE ICI, ET C'EST DÉLIBÉRÉ.** L'application
-- déployée lit encore `from('admin_actors')` : la retirer avant que le code
-- neuf ne soit en ligne casserait `/admin` entre la migration et la fin du
-- déploiement Vercel. La fonction et la vue **coexistent sans conflit** —
-- PostgreSQL range les relations et les routines dans deux espaces de noms
-- distincts, et PostgREST les expose à deux adresses différentes
-- (`/admin_actors` contre `/rpc/admin_actors`). La suppression est en 0020.
--
-- **Pourquoi une fonction plutôt qu'une vue.** Les deux avis CRITICAL de
-- Supabase visent `admin_actors`, et le linter ne détecte que les **vues** :
--
--   « Detects if auth.users is exposed to anon or authenticated roles
--     VIA A VIEW OR MATERIALIZED VIEW in schemas exposed to PostgREST. »
--
-- Mais ce n'est pas la raison principale, et ce serait un mauvais motif à lui
-- seul — faire taire un linter n'est pas corriger.
--
-- ⚠️ **LA VRAIE RAISON : UNE FONCTION NE PEUT PAS ÊTRE AUTO-MODIFIABLE.** Le
-- défaut corrigé la veille par 0018 tenait à ce qu'une vue à un seul `from`,
-- sans `group by` ni `distinct`, propage `delete` et `update` jusqu'à la table
-- sous-jacente — ici `auth.users`. Combiné au `alter default privileges …
-- grant all on tables to anon, authenticated` de Supabase, un administrateur
-- de plateforme supprimait de VRAIS comptes en une requête REST. 0018 l'a
-- refermé par des `revoke` ; **une future migration pourrait les rouvrir sans
-- bruit**. Avec une fonction, le chemin n'existe plus du tout.

create or replace function public.admin_actors()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirme boolean
)
language sql
-- `security definer` est TOUJOURS nécessaire, et pour la même raison qu'avant :
-- un compte `authenticated`, même administrateur, n'a aucun droit sur
-- `auth.users`. C'est la clause `where` qui autorise, pas le rôle appelant.
security definer
-- ⚠️ `search_path` vide — discipline de 0015. Conséquence directe : **tout
-- doit être qualifié**, `auth.users` comme `public.is_platform_admin()`.
-- L'oublier ne casse pas la création, seulement l'exécution.
set search_path = ''
stable
as $fn$
  select
    u.id,
    -- `auth.users.email` est un `character varying` : sans ce cast, le type de
    -- retour déclaré ne correspond pas et la fonction échoue À L'EXÉCUTION,
    -- pas à la création.
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null
  from auth.users u
  -- ⚠️ **LA GARDE EST ICI, exactement comme dans la vue.** Sans session,
  -- `auth.uid()` est nul, `is_platform_admin()` rend `false`, et la fonction
  -- ne rend aucune ligne — jamais une erreur, jamais une fuite.
  where public.is_platform_admin();
$fn$;

-- ⚠️ **LES DEUX FORMES DE RÉVOCATION SONT NÉCESSAIRES — leçon de 0015, et le
-- piège se répète à l'identique sur les fonctions.** Supabase pose un
-- `alter default privileges … grant execute on functions to anon,
-- authenticated, service_role` : la fonction naît donc exécutable par `anon`,
-- par un droit **nominatif** qui s'ajoute au droit implicite de `public`.
-- Révoquer `public` laisse le nominatif ; révoquer les rôles laisse celui de
-- `public`, dont ils sont membres. **Aucune des deux ne remplace l'autre.**
revoke all on function public.admin_actors() from public;
revoke all on function public.admin_actors() from anon;

-- Seuls les comptes authentifiés peuvent l'appeler ; la clause `where` décide
-- ensuite s'ils voient quelque chose. Le refus vient donc de la couche de
-- DROITS pour un visiteur anonyme, et du corps pour un client ordinaire.
grant execute on function public.admin_actors() to authenticated;

-- ⚠️ **LE CONTRÔLE QUI TRANCHE N'EST PAS LA LECTURE DE CE FICHIER**, mais
-- l'ACL brute — une entrée sans rôle à gauche désigne PUBLIC :
--
--   select proacl from pg_proc where proname = 'admin_actors';
--     =X/postgres           ⇒ PUBLIC a EXECUTE       (encore ouvert)
--     postgres=X/postgres   ⇒ nominatif seulement    (fermé)
--
-- Le fichier de migration a déjà dit vrai sur son intention et faux sur son
-- effet pendant des semaines : c'est tout l'objet de 0015.
