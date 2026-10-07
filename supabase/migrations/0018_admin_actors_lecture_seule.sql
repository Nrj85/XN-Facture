-- 0018 — `admin_actors` redevient une vue de LECTURE.
--
-- ⚠️ **CE N'ÉTAIT PAS UN FAUX POSITIF.** Les deux avis CRITICAL de Supabase
-- (`auth_users_exposed`, `security_definer_view`) visaient cette vue, et
-- CLAUDE.md les classait sans suite depuis le 26 sept. 2026 au motif que la
-- garde vit dans la clause `where`. L'analyse d'alors avait regardé la
-- LECTURE, et seulement elle.
--
-- ⚠️ **MESURÉ LE 7 oct. 2026, avec deux comptes jetables :** un administrateur
-- de plateforme pouvait supprimer de VRAIS comptes `auth.users` en une seule
-- requête REST.
--
--     DELETE /rest/v1/admin_actors?id=eq.<uuid>   ->  HTTP 200, ligne rendue
--     le compte cible n'existait plus
--
-- Trois faits se combinaient :
--
--   1. la vue est **SECURITY DEFINER** (`security_invoker` non posé), donc
--      elle s'exécute avec les droits de son propriétaire et atteint
--      `auth.users` ;
--   2. elle est **auto-modifiable** : un seul `from`, pas de `group by` ni de
--      `distinct`, donc PostgreSQL y propage `delete` et `update` ;
--   3. `authenticated` détenait **INSERT, UPDATE, DELETE, TRUNCATE,
--      REFERENCES, TRIGGER** dessus.
--
-- La clause `where is_platform_admin()` filtrait bien — mais pour un
-- administrateur elle est VRAIE, et le `delete` portait alors sur toutes les
-- lignes visées. Un compte ordinaire, lui, touchait zéro ligne : la fuite
-- n'était pas externe, c'était une **élévation à l'intérieur de l'espace
-- d'administration**, qui est en LECTURE SEULE par décision explicite (§8).
--
-- ⚠️ **L'ORIGINE EST LE RÉGLAGE PAR DÉFAUT DE SUPABASE**, exactement comme
-- pour les droits d'exécution corrigés en 0015 : `alter default privileges …
-- grant all on tables to anon, authenticated`. Toute vue créée sans révocation
-- explicite naît donc modifiable. **Une vue `security definer` sur une table
-- système doit systématiquement se faire retirer ses droits d'écriture.**
--
-- ⚠️ **LES DEUX FORMES DE RÉVOCATION SONT NÉCESSAIRES** — leçon de 0015.
-- Révoquer `public` laisse le droit nominatif d'`anon` et d'`authenticated` ;
-- révoquer les deux rôles laisse celui de `public`, dont ils sont membres.
revoke all on public.admin_actors from public;
revoke all on public.admin_actors from anon;
revoke all on public.admin_actors from authenticated;

-- La lecture reste ouverte aux comptes authentifiés : la vue porte sa propre
-- garde, et c'est elle qui alimente l'écran `/admin`. `anon` n'a rien, et ne
-- doit rien avoir.
grant select on public.admin_actors to authenticated;

-- ⚠️ **ON NE PASSE PAS LA VUE EN `security_invoker` — ce serait la casser.**
-- Un compte `authenticated`, même administrateur, n'a aucun droit sur
-- `auth.users` : la vue ne rendrait plus rien et l'écran `/admin` afficherait
-- une liste vide sans la moindre erreur. Le `security definer` est ce qui lui
-- permet de lire ; la garde `where` est ce qui l'autorise. Les deux se tiennent.
--
-- Le lint continuera donc de signaler `security_definer_view`. **Celui-là est
-- bien un faux positif**, et le dire n'excuse pas l'autre : les droits
-- d'écriture, eux, étaient réels.
