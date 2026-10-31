-- =============================================================================
-- XN-Facture — 0026 : une source ne garde pas la ponctuation qui l'entoure
-- =============================================================================
-- Constaté le 31 oct. 2026 lors du parcours réel de 0025 : la source a été
-- enregistrée `test-jacques.` — le lien copié emportait le point de la phrase.
-- Un lien recopié dans un message WhatsApp ou un post produira le même effet,
-- et `cabinet-ndoumbe` et `cabinet-ndoumbe.` seraient comptés comme deux
-- sources différentes.
--
-- Correctif : après le nettoyage de 0025, on retire les `.`, `-` et `_` en
-- DÉBUT et en FIN de valeur. Ceux du milieu restent (`cabinet-ndoumbe`,
-- `lancement.nov`).
--
-- ⚠️ **AUCUNE DONNÉE À REPRENDRE** : la table était vide au moment du correctif
-- (la seule ligne, celle du test, a été supprimée). La contrainte `check` de la
-- table n'a pas à changer : une valeur sans ponctuation en bout la respecte.
-- =============================================================================

begin;

create or replace function public.normalize_acquisition_value(p_value text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select nullif(
    regexp_replace(
      left(
        regexp_replace(
          regexp_replace(
            translate(lower(trim(coalesce(p_value, ''))),
                      'àâäáãçéèêëíìîïñóòôöõúùûüýÿ',
                      'aaaaaceeeeiiiinooooouuuuyy'),
            '\s+', '-', 'g'),
          '[^a-z0-9._-]', '', 'g'),
        60),
      '^[._-]+|[._-]+$', '', 'g'),
    '');
$fn$;

-- `create or replace` conserve les droits existants, mais on les repose pour
-- que ce fichier se suffise à lui-même (piège de 0015 : les DEUX révocations).
revoke all on function public.normalize_acquisition_value(text) from public;
revoke all on function public.normalize_acquisition_value(text) from anon;
grant execute on function public.normalize_acquisition_value(text) to authenticated;

commit;
