-- =============================================================================
-- XN-Facture — Row Level Security
-- =============================================================================
-- Modèle : tout est rattaché à une entreprise, et on ne voit que les
-- entreprises dont on est membre. Toutes les politiques sont posées `to
-- authenticated` — le rôle anonyme n'a aucun accès, même en lecture.
--
-- Le `with check` n'est pas une redite du `using` : `using` décide ce qu'on
-- peut LIRE ou toucher, `with check` décide de l'état RÉSULTANT. Sans lui, on
-- pourrait déplacer une de ses factures vers l'entreprise de quelqu'un d'autre.
-- =============================================================================

alter table public.companies        enable row level security;
alter table public.company_members  enable row level security;
alter table public.clients          enable row level security;
alter table public.invoices         enable row level security;
alter table public.invoice_items    enable row level security;
alter table public.quotes           enable row level security;
alter table public.quote_items      enable row level security;
alter table public.document_counters enable row level security;

-- --- Entreprises -------------------------------------------------------------
-- Pas de politique INSERT : la création passe obligatoirement par
-- create_company_for_current_user, qui crée l'appartenance dans la même
-- transaction. Pas de politique DELETE : supprimer une entreprise emporterait
-- toute sa comptabilité en cascade.

create policy companies_select on public.companies
  for select to authenticated
  using (public.is_company_member(id));

create policy companies_update on public.companies
  for update to authenticated
  using (public.is_company_member(id))
  with check (public.is_company_member(id));

-- --- Appartenance ------------------------------------------------------------
-- Lecture seule depuis l'application. La fonction d'inscription écrit ici en
-- `security definer` ; l'invitation d'un collaborateur sera une fonction
-- dédiée, pas une écriture directe.

create policy company_members_select on public.company_members
  for select to authenticated
  using (public.is_company_member(company_id));

-- --- Clients -----------------------------------------------------------------

create policy clients_select on public.clients
  for select to authenticated
  using (public.is_company_member(company_id));

create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.is_company_member(company_id));

create policy clients_update on public.clients
  for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy clients_delete on public.clients
  for delete to authenticated
  using (public.is_company_member(company_id));

-- --- Factures ----------------------------------------------------------------

create policy invoices_select on public.invoices
  for select to authenticated
  using (public.is_company_member(company_id));

create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (public.is_company_member(company_id));

create policy invoices_update on public.invoices
  for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy invoices_delete on public.invoices
  for delete to authenticated
  using (public.is_company_member(company_id));

-- --- Lignes de facture -------------------------------------------------------
-- La politique remonte au parent plutôt que de dupliquer company_id sur la
-- ligne. Une colonne dénormalisée serait plus rapide, mais elle finirait par
-- diverger de son parent — et une ligne rattachée à la mauvaise entreprise est
-- exactement le genre de faille qu'on ne remarque jamais.

create policy invoice_items_all on public.invoice_items
  for all to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and public.is_company_member(i.company_id)
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and public.is_company_member(i.company_id)
    )
  );

-- --- Devis -------------------------------------------------------------------

create policy quotes_select on public.quotes
  for select to authenticated
  using (public.is_company_member(company_id));

create policy quotes_insert on public.quotes
  for insert to authenticated
  with check (public.is_company_member(company_id));

create policy quotes_update on public.quotes
  for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy quotes_delete on public.quotes
  for delete to authenticated
  using (public.is_company_member(company_id));

create policy quote_items_all on public.quote_items
  for all to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and public.is_company_member(q.company_id)
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and public.is_company_member(q.company_id)
    )
  );

-- --- Compteurs ---------------------------------------------------------------
-- Lecture autorisée pour diagnostic ; aucune écriture directe. Le compteur ne
-- s'incrémente que par next_document_number, sans quoi la numérotation
-- pourrait être forcée à la main et produire des doublons.

create policy document_counters_select on public.document_counters
  for select to authenticated
  using (public.is_company_member(company_id));
