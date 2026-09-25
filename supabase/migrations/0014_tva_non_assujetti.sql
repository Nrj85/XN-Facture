-- =============================================================================
-- 0014 — Facturer sans TVA, pour les entreprises qui n'y sont pas assujetties
-- =============================================================================
--
-- Toutes les entreprises d'Afrique centrale ne collectent pas la TVA : en
-- dessous des seuils, un entrepreneur relève d'un régime qui ne l'y assujettit
-- pas. Il facture pourtant, et sa facture ne doit PAS porter de ligne de TVA —
-- en afficher une, même à zéro, laisserait croire à une taxe collectée.
--
-- ⚠️ POURQUOI UN BOOLÉEN ET PAS SIMPLEMENT UN TAUX À ZÉRO.
-- Ce sont deux situations juridiquement distinctes :
--   * « non assujetti »  — hors du champ de la taxe, la facture porte une
--                          mention et aucune ligne de TVA ;
--   * « assujetti à 0 % » — dans le champ, taxé à taux nul (exportations,
--                          produits exonérés), la ligne « TVA 0 % » a un sens.
-- Un seul taux ne peut pas dire les deux. Et surtout : imprimer « TVA non
-- applicable » sur le document de quelqu'un qui a simplement saisi 0 serait
-- lui faire dire une chose fausse à l'administration.
--
-- ⚠️ LE DRAPEAU EST SUR LE DOCUMENT, PAS SEULEMENT SUR L'ENTREPRISE.
-- Règle déjà en vigueur pour `vat_rate` : « les documents existants gardent
-- leur propre taux ». Sans copie sur le document, une entreprise qui
-- s'assujettit plus tard verrait ses anciennes factures changer d'apparence
-- rétroactivement — des pièces comptables déjà remises à des clients.
--
-- Les valeurs par défaut préservent exactement le comportement actuel :
-- toute entreprise existante reste assujettie, tout document existant reste
-- taxé.
-- =============================================================================

-- --- L'entreprise : assujettie ou non ---------------------------------------

alter table public.companies
  add column if not exists vat_registered boolean not null default true;

comment on column public.companies.vat_registered is
  'L''entreprise collecte-t-elle la TVA ? Faux : les NOUVEAUX documents partent '
  'à 0 % et portent la mention « TVA non applicable ». Les documents déjà émis '
  'ne bougent pas.';

-- --- Le document : ce qui était vrai AU MOMENT DE SON ÉMISSION ---------------

alter table public.invoices
  add column if not exists vat_exempt boolean not null default false;

alter table public.quotes
  add column if not exists vat_exempt boolean not null default false;

comment on column public.invoices.vat_exempt is
  'Recopié depuis companies.vat_registered à la création. Gelé ensuite : une '
  'facture remise à un client ne change pas de nature parce que l''émetteur a '
  'changé de régime.';

-- --- La base garantit la cohérence, pas l'interface --------------------------
--
-- Un document « non assujetti » à 19,25 % serait une contradiction : il
-- n'afficherait aucune ligne de TVA tout en en ayant calculé une. Le total
-- imprimé et le total stocké divergeraient.
--
-- La contrainte est à SENS UNIQUE : elle interdit « exempt + taux non nul »,
-- mais autorise « assujetti + taux nul » — c'est le cas légitime de
-- l'exportation ou du produit exonéré.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_vat_exempt_rate') then
    alter table public.invoices
      add constraint invoices_vat_exempt_rate check (not vat_exempt or vat_rate = 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'quotes_vat_exempt_rate') then
    alter table public.quotes
      add constraint quotes_vat_exempt_rate check (not vat_exempt or vat_rate = 0);
  end if;
end $$;

-- --- Ce que cette migration ne prétend PAS faire -----------------------------
--
-- ⚠️ Aucune politique RLS n'est ajoutée ni modifiée. `invoices_insert` laisse
-- déjà un membre écrire ses propres factures, donc rien n'empêche quelqu'un de
-- poser `vat_exempt = true` par un appel direct à l'API REST. Ce n'est pas une
-- élévation de privilège : il ne touche que SES documents, et la question de
-- savoir s'il avait le droit de ne pas collecter la TVA se règle avec
-- l'administration fiscale, pas avec nous. Le produit enregistre ce que
-- l'entreprise déclare ; la contrainte ci-dessus garantit seulement que ce
-- qu'elle déclare reste cohérent avec ce qui est imprimé.
--
-- ⚠️ La MENTION imprimée est « TVA non applicable », sans référence à un
-- article de loi. Le projet n'invente pas de mention légale — même discipline
-- que pour le NIU et le RCCM. L'entreprise qui doit citer son régime précis
-- dispose du champ « mention par défaut » de ses paramètres, qui s'imprime sur
-- chaque document.
