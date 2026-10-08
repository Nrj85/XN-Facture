-- 0020 — la vue `admin_actors` est retirée. Étape 2 sur 2.
--
-- ⚠️ **À N'APPLIQUER QU'UNE FOIS LE CODE DE 0019 EN LIGNE.** L'application lit
-- désormais `rpc('admin_actors')` (commit 86f5750), mais tant que le
-- déploiement Vercel n'est pas terminé, la version servie appelle encore
-- `from('admin_actors')` : retirer la vue avant casserait `/admin` dans
-- l'intervalle.
--
-- **Marche arrière, si jamais :** recréer la vue telle qu'elle était suffit,
-- l'ancienne et la nouvelle lecture peuvent coexister.
--
--   create view public.admin_actors as
--     select id, email, created_at, last_sign_in_at,
--            email_confirmed_at is not null as email_confirme
--     from auth.users u
--     where public.is_platform_admin();
--   revoke all on public.admin_actors from public;
--   revoke all on public.admin_actors from anon;
--   revoke all on public.admin_actors from authenticated;   -- LA DECISIVE
--   grant select on public.admin_actors to authenticated;
--
-- ⚠️ **IL EN FAUT TROIS, ET LA TROISIÈME EST LA SEULE QUI COMPTE.** Ce bloc
-- annonçait d'abord « les DEUX revoke » et recopiait `from public, anon` —
-- **mot pour mot les lignes 37-38 de 0005**, celles qui ont laissé la vue
-- modifiable pendant des semaines. Suivre cette marche arrière rétablissait
-- donc exactement la faille que 0018 avait fermée : un administrateur
-- supprimant de VRAIS comptes `auth.users` par un `DELETE` REST.
--
-- Supabase pose `alter default privileges … grant all on tables to anon,
-- authenticated` : toute vue créée ici naît MODIFIABLE, et une vue à un seul
-- `from` propage `delete` jusqu'à `auth.users`. **Révoquer `public` et `anon`
-- ne retire RIEN à `authenticated`**, qui détient un droit nominatif — c'est
-- la leçon de 0015, et elle vaut ici au mot près.
--
-- **Ce que ce retrait obtient :**
--
--   1. les deux avis CRITICAL de Supabase disparaissent — `auth_users_exposed`
--      et `security_definer_view` ne détectent que les vues et vues
--      matérialisées ;
--   2. et surtout, **le chemin d'écriture n'existe plus du tout.** 0018 l'avait
--      refermé par des `revoke` ; une migration future pouvait les rouvrir sans
--      bruit. Une fonction n'est pas auto-modifiable : il n'y a plus rien à
--      refermer.
-- ⚠️ **LA GARDE CI-DESSOUS REMPLACE UNE SIMPLE CONSIGNE EN COMMENTAIRE.**
-- L'en-tête disait « à n'appliquer qu'une fois 0019 en ligne » — mais rien ne
-- l'empêchait. Appliquée seule, cette migration retire la seule source de
-- données de `/admin`, et comme les appels ne regardent pas leur erreur,
-- l'écran afficherait « 0 compte » **sans la moindre alerte**. Une consigne
-- qu'on peut ignorer sans conséquence visible n'est pas une protection.
do $garde$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_actors'
  ) then
    raise exception '0019 doit etre appliquee AVANT 0020 : la fonction admin_actors() n existe pas.';
  end if;
end
$garde$;

drop view if exists public.admin_actors;
