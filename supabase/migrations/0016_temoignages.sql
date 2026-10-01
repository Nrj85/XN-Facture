-- =============================================================================
-- XN-Facture — Témoignages de la page d'accueil, modifiables par l'éditeur
-- =============================================================================
-- Demande de l'utilisateur, 1er oct. 2026 : *« je veux avoir la possibilité de
-- modifier les éléments sur le front par moi-même, par exemple les témoignages,
-- sans toutefois toujours passer par ici »*.
--
-- ⚠️ **CELA ROUVRE UNE DÉCISION VERROUILLÉE (§8), ET SEULEMENT POUR CETTE
-- TABLE.** L'espace d'administration est en lecture seule par décision
-- explicite : aucune politique d'écriture n'existe sur `platform_admins`,
-- `subscriptions`, `subscription_orders`, `activity_log` ni ailleurs, et c'est
-- la protection principale du produit. **Rien de cela ne change.** Ce qui est
-- accordé ici ne porte que sur `site_testimonials`, une table de **contenu
-- éditorial** : elle ne décide d'aucun droit, ne porte aucun montant, et son
-- pire détournement serait un texte déplacé sur une page publique. Ce n'est pas
-- la même nature de donnée qu'un abonnement ou qu'un journal d'activité.
--
-- ⚠️ **NE PAS PRENDRE CE FICHIER COMME PRÉCÉDENT** pour ouvrir l'écriture
-- ailleurs. La question à se poser reste : « que peut faire quelqu'un qui
-- obtient ce droit ? » Ici, changer un texte d'accroche. Pour une facture, un
-- plan ou un journal, la réponse est tout autre.
-- =============================================================================

begin;

create table if not exists public.site_testimonials (
  id          uuid primary key default gen_random_uuid(),

  -- ⚠️ **LES LONGUEURS SONT CONTRAINTES PAR LA BASE, pas seulement par le
  -- formulaire.** La grille des témoignages est réglée au pixel (§6.4) : un
  -- texte de 2 000 caractères ne la rend pas « moins jolie », il la casse, sur
  -- la page que voit un prospect en premier. Le formulaire compte les
  -- caractères à la saisie, mais un `PATCH` REST direct ne passe pas par lui —
  -- et l'auteur de ce `PATCH` est précisément quelqu'un qui a le droit
  -- d'écrire. La contrainte est donc ici, où rien ne la contourne.
  quote       text not null check (char_length(btrim(quote)) between 20 and 400),
  author_name text not null check (char_length(btrim(author_name)) between 2 and 60),
  author_role text not null check (char_length(btrim(author_role)) between 2 and 80),

  -- Rang d'affichage. Pas de contrainte d'unicité : deux témoignages au même
  -- rang s'ordonnent alors par date de création, ce qui est stable et sans
  -- surprise. Exiger l'unicité obligerait à réordonner toute la liste pour
  -- insérer au milieu — une complication pour aucun bénéfice visible.
  position    integer not null default 0,

  -- ⚠️ **`false` PAR DÉFAUT, et c'est délibéré.** Un témoignage à moitié saisi
  -- ne doit pas apparaître en ligne pendant qu'on le rédige. On écrit, on
  -- relit, puis on publie.
  published   boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists site_testimonials_publies
  on public.site_testimonials (position, created_at)
  where published;

create trigger site_testimonials_touch
  before update on public.site_testimonials
  for each row execute function public.touch_updated_at();

alter table public.site_testimonials enable row level security;

-- --- Lecture -----------------------------------------------------------------
-- ⚠️ **DEUX POLITIQUES DE LECTURE, ET LA SÉPARATION EST OBLIGATOIRE ICI.**
-- Partout ailleurs dans ce projet les politiques sont `to authenticated`
-- (0003). Celle-ci doit aussi servir `anon` : la page d'accueil est publique et
-- lue **sans session**.
--
-- On ne peut PAS écrire une seule politique `using (published or
-- public.is_platform_admin())` : la migration 0015 a retiré à `anon` le droit
-- d'exécuter `is_platform_admin()`, et une politique évalue ses fonctions avec
-- les droits du rôle qui interroge. Un visiteur anonyme recevrait donc
-- « permission denied for function » — c'est-à-dire **une page d'accueil en
-- erreur**, pour avoir voulu économiser une politique.
--
-- D'où la séparation : `anon` ne voit que le publié et n'appelle aucune
-- fonction ; `authenticated` peut en plus tout voir s'il est administrateur.
create policy site_testimonials_select_anon
  on public.site_testimonials for select to anon
  using (published);

create policy site_testimonials_select_auth
  on public.site_testimonials for select to authenticated
  using (published or public.is_platform_admin());

-- --- Écriture, réservée aux administrateurs de plateforme ---------------------
-- `with check` ET `using` sur l'update : sans le `using`, un administrateur
-- pourrait modifier une ligne qu'il ne peut pas voir ; sans le `with check`, il
-- pourrait la faire sortir de son périmètre. Les deux sont identiques ici, mais
-- les omettre est le défaut classique de ce couple.
create policy site_testimonials_insert
  on public.site_testimonials for insert to authenticated
  with check (public.is_platform_admin());

create policy site_testimonials_update
  on public.site_testimonials for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy site_testimonials_delete
  on public.site_testimonials for delete to authenticated
  using (public.is_platform_admin());

comment on table public.site_testimonials is
  'Témoignages de la page d''accueil. Lecture publique du seul contenu publié ; écriture réservée aux administrateurs de plateforme. Contenu éditorial — n''accorde aucun droit.';

-- --- Les trois textes existants, NON PUBLIÉS ---------------------------------
-- ⚠️ **ILS SONT INVENTÉS, et CLAUDE.md le signale depuis le 5 sept. 2026 comme
-- la dernière fabrication visible du produit.** Les insérer `published = false`
-- règle les deux problèmes d'un coup : ils **disparaissent de la page en ligne**
-- dès cette migration, et ils restent disponibles comme gabarit à réécrire —
-- la mise en page, le ton et la longueur utile sont déjà là.
--
-- Les noms sont déjà des espaces réservés (« Prénom Nom ») : rien de ce qui est
-- inséré ici ne prétend être une personne réelle.
insert into public.site_testimonials (quote, author_name, author_role, position, published)
values
  ('Avant, je faisais mes factures sur Word et je recalculais la TVA à la main. Là c''est fait tout seul, et mes clients me règlent plus vite parce que le document est net.',
   'Prénom Nom', 'Atelier de menuiserie — Yaoundé', 1, false),
  ('Ce que j''ouvre en premier le matin, c''est l''encours par ancienneté. Je sais qui relancer avant même d''avoir fini mon café.',
   'Prénom Nom', 'Cabinet de conseil — Douala', 2, false),
  ('Le NIU et le RCCM sont sur chaque facture sans que j''y pense. C''est exactement ce que mon comptable me réclamait chaque trimestre.',
   'Prénom Nom', 'Prestataire indépendante — Kribi', 3, false);

commit;
