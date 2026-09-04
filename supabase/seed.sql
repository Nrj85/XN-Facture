-- =============================================================================
-- XN-Facture — jeu de démonstration
-- =============================================================================
-- GÉNÉRÉ par scripts/gen-seed.ts depuis lib/mock-data.ts.
-- Ne pas modifier à la main : régénérer.
--
-- Rejouable : le TRUNCATE en tête permet de repartir d'un état connu.
-- Les identifiants sont déterministes, pour que les contrôles chiffrés
-- restent vérifiables d'une exécution à l'autre.
-- =============================================================================

begin;

truncate table public.quote_items, public.quotes, public.invoice_items,
               public.invoices, public.clients, public.document_counters,
               public.company_members, public.companies cascade;

-- --- Entreprise -------------------------------------------------------------
insert into public.companies (
  id, name, legal_name, niu, rccm, address, city, country, phone, email,
  currency, vat_rate, payment_terms_days, invoice_prefix, default_notes,
  bank_name, bank_account, momo_mtn, momo_orange
) values (
  '00000000-0000-4000-8000-000000000001', 'Atelier Nkolo', 'Atelier Nkolo Sarl',
  'M071812345678X', 'RC/YAO/2019/B/1204', 'Rue 1.086, Bastos — BP 4521', 'Yaoundé',
  'Cameroun', '+237 6 78 90 12 34', 'contact@ateliernkolo.cm',
  'XAF', 19.25, 30, 'FAC',
  'Règlement par virement ou Mobile Money. Tout retard de paiement entraîne des pénalités au taux légal.',
  'Afriland First Bank', 'CM21 10005 00023 09876543210 87', '+237 6 78 90 12 34', '+237 6 90 12 34 56'
);

-- --- Clients ----------------------------------------------------------------
insert into public.clients (id, company_id, name, contact_name, email, phone, address, city) values
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000001', 'Sotrabat Sarl', 'Alice Ngo Bat', 'contact@sotrabat.cm', '+237 6 99 41 20 08', 'Zone industrielle Bassa, BP 1204', 'Douala'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Nkolo Digital', 'Paul Amougou', 'facturation@nkolodigital.cm', '+237 6 77 12 45 33', 'Avenue Kennedy, immeuble Sawa, 3e étage', 'Yaoundé'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Cabinet Mbarga Conseil', 'Sylvie Mbarga', 's.mbarga@cabinet-mbarga.cm', '+237 6 94 80 17 62', 'Rue 1.750, Quartier Nlongkak', 'Yaoundé'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Groupe Fotso Distribution', 'Éric Fotso', 'compta@fotso-dist.cm', '+237 6 55 03 91 74', 'Boulevard de la Liberté, Akwa', 'Douala'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'Ets Kamdem & Fils', 'Bertrand Kamdem', 'kamdem.ets@gmail.com', '+237 6 71 62 38 45', 'Marché A, avenue des Banques', 'Bafoussam'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'Clinique Essomba', 'Dr. Aline Essomba', 'admin@clinique-essomba.cm', '+237 6 90 27 55 10', 'Route de la Plage, BP 318', 'Kribi'),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'Afriland Logistique', 'Marc Tchoumi', 'achats@afriland-log.cm', '+237 6 78 44 09 21', 'Port autonome, zone 4', 'Douala'),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'Mballa Agro SA', 'Georges Mballa', 'g.mballa@mballaagro.cm', '+237 6 96 15 73 80', 'Route de Sangmélima, PK 7', 'Ebolowa');

-- --- Factures ---------------------------------------------------------------
insert into public.invoices (
  id, company_id, number, client_id, issue_date, due_date, vat_rate,
  address, notes, amount_paid, status, created_at
) values
  ('00000000-0000-4000-8000-000000000200', '00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000103', '2026-08-31', '2026-09-30', 19.25, 'Boulevard de la Liberté, Akwa, Douala', null, 0, 'draft', '2026-08-31T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000105', '2026-08-30', '2026-09-29', 19.25, 'Route de la Plage, BP 318, Kribi', null, 0, 'draft', '2026-08-30T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0051', '00000000-0000-4000-8000-000000000100', '2026-08-28', '2026-09-27', 19.25, 'Zone industrielle Bassa, BP 1204, Douala', null, 0, 'sent', '2026-08-28T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0050', '00000000-0000-4000-8000-000000000101', '2026-08-24', '2026-09-23', 19.25, 'Avenue Kennedy, immeuble Sawa, 3e étage, Yaoundé', null, 0, 'sent', '2026-08-24T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0049', '00000000-0000-4000-8000-000000000102', '2026-08-20', '2026-09-04', 19.25, 'Rue 1.750, Quartier Nlongkak, Yaoundé', null, 954000, 'paid', '2026-08-20T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0048', '00000000-0000-4000-8000-000000000103', '2026-08-14', '2026-08-29', 19.25, 'Boulevard de la Liberté, Akwa, Douala', null, 1200000, 'partially_paid', '2026-08-14T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0047', '00000000-0000-4000-8000-000000000104', '2026-08-05', '2026-08-20', 19.25, 'Marché A, avenue des Banques, Bafoussam', null, 0, 'sent', '2026-08-05T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0046', '00000000-0000-4000-8000-000000000105', '2026-07-30', '2026-08-14', 19.25, 'Route de la Plage, BP 318, Kribi', null, 1168650, 'paid', '2026-07-30T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0045', '00000000-0000-4000-8000-000000000106', '2026-07-18', '2026-08-02', 19.25, 'Port autonome, zone 4, Douala', null, 0, 'sent', '2026-07-18T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0044', '00000000-0000-4000-8000-000000000107', '2026-07-02', '2026-07-17', 19.25, 'Route de Sangmélima, PK 7, Ebolowa', null, 0, 'sent', '2026-07-02T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0043', '00000000-0000-4000-8000-000000000100', '2026-06-20', '2026-07-05', 19.25, 'Zone industrielle Bassa, BP 1204, Douala', null, 400000, 'partially_paid', '2026-06-20T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0042', '00000000-0000-4000-8000-000000000101', '2026-05-28', '2026-06-12', 19.25, 'Avenue Kennedy, immeuble Sawa, 3e étage, Yaoundé', null, 0, 'sent', '2026-05-28T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0041', '00000000-0000-4000-8000-000000000104', '2026-05-10', '2026-05-25', 19.25, 'Marché A, avenue des Banques, Bafoussam', null, 0, 'sent', '2026-05-10T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0040', '00000000-0000-4000-8000-000000000102', '2026-04-15', '2026-04-30', 19.25, 'Rue 1.750, Quartier Nlongkak, Yaoundé', null, 4173750, 'paid', '2026-04-15T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-000000000001', 'FAC-2026-0039', '00000000-0000-4000-8000-000000000106', '2026-03-20', '2026-04-04', 19.25, 'Port autonome, zone 4, Douala', null, 3315150, 'paid', '2026-03-20T08:00:00.000Z');

insert into public.invoice_items (invoice_id, position, description, qty_milli, unit_price) values
  ('00000000-0000-4000-8000-000000000200', 0, 'Refonte du site e-commerce', 1000, 1800000),
  ('00000000-0000-4000-8000-000000000200', 1, 'Intégration du catalogue produits', 1000, 450000),
  ('00000000-0000-4000-8000-000000000200', 2, 'Formation de l’équipe (jours)', 2000, 150000),
  ('00000000-0000-4000-8000-000000000201', 0, 'Signalétique intérieure — conception', 1000, 380000),
  ('00000000-0000-4000-8000-000000000201', 1, 'Déclinaison des supports d’impression', 4000, 45000),
  ('00000000-0000-4000-8000-000000000202', 0, 'Identité visuelle complète', 1000, 1500000),
  ('00000000-0000-4000-8000-000000000202', 1, 'Charte graphique (document de référence)', 1000, 900000),
  ('00000000-0000-4000-8000-000000000202', 2, 'Déclinaisons supports', 3000, 250000),
  ('00000000-0000-4000-8000-000000000203', 0, 'Community management — août 2026', 1000, 450000),
  ('00000000-0000-4000-8000-000000000203', 1, 'Production de visuels réseaux sociaux', 12000, 35000),
  ('00000000-0000-4000-8000-000000000204', 0, 'Refonte de la plaquette institutionnelle', 1000, 520000),
  ('00000000-0000-4000-8000-000000000204', 1, 'Séance photo — portraits des associés', 1000, 280000),
  ('00000000-0000-4000-8000-000000000205', 0, 'Campagne d’affichage — création', 1000, 1200000),
  ('00000000-0000-4000-8000-000000000205', 1, 'Déclinaisons formats (4x3, abribus)', 6000, 180000),
  ('00000000-0000-4000-8000-000000000205', 2, 'Suivi de fabrication', 1000, 250000),
  ('00000000-0000-4000-8000-000000000206', 0, 'Logo et papeterie', 1000, 480000),
  ('00000000-0000-4000-8000-000000000206', 1, 'Enseigne — fichiers de production', 1000, 120000),
  ('00000000-0000-4000-8000-000000000207', 0, 'Brochure patients — conception', 1000, 640000),
  ('00000000-0000-4000-8000-000000000207', 1, 'Traduction et relecture', 1000, 160000),
  ('00000000-0000-4000-8000-000000000207', 2, 'Suivi d’impression (tirages)', 2000, 90000),
  ('00000000-0000-4000-8000-000000000208', 0, 'Habillage de flotte — création', 1000, 950000),
  ('00000000-0000-4000-8000-000000000208', 1, 'Gabarits par véhicule', 8000, 85000),
  ('00000000-0000-4000-8000-000000000209', 0, 'Packaging gamme jus — design', 1000, 880000),
  ('00000000-0000-4000-8000-000000000209', 1, 'Déclinaisons par parfum', 5000, 90000),
  ('00000000-0000-4000-8000-000000000210', 0, 'Audit de marque', 1000, 450000),
  ('00000000-0000-4000-8000-000000000210', 1, 'Ateliers de positionnement (jours)', 2500, 180000),
  ('00000000-0000-4000-8000-000000000211', 0, 'Site vitrine — conception et intégration', 1000, 1100000),
  ('00000000-0000-4000-8000-000000000211', 1, 'Rédaction de contenus (pages)', 6000, 45000),
  ('00000000-0000-4000-8000-000000000212', 0, 'Catalogue produits — mise en page', 1000, 380000),
  ('00000000-0000-4000-8000-000000000212', 1, 'Retouche photo (visuels)', 17000, 8500),
  ('00000000-0000-4000-8000-000000000213', 0, 'Identité visuelle et charte', 1000, 1750000),
  ('00000000-0000-4000-8000-000000000213', 1, 'Site vitrine bilingue', 1000, 1400000),
  ('00000000-0000-4000-8000-000000000213', 2, 'Formation rédaction web (jours)', 2000, 175000),
  ('00000000-0000-4000-8000-000000000214', 0, 'Refonte de l’identité de marque', 1000, 1600000),
  ('00000000-0000-4000-8000-000000000214', 1, 'Charte et guide d’application', 1000, 700000),
  ('00000000-0000-4000-8000-000000000214', 2, 'Déploiement des supports', 4000, 120000);

-- --- Devis ------------------------------------------------------------------
insert into public.quotes (
  id, company_id, number, client_id, issue_date, valid_until, vat_rate,
  address, notes, status, invoice_id, created_at
) values
  ('00000000-0000-4000-8000-000000000300', '00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000101', '2026-08-30', '2026-09-29', 19.25, 'Avenue Kennedy, immeuble Sawa, 3e étage, Yaoundé', 'Devis valable jusqu’à la date indiquée. Pour l’accepter, retournez-le signé avec la mention « Bon pour accord ».', 'draft', null, '2026-08-30T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'DEV-2026-0018', '00000000-0000-4000-8000-000000000106', '2026-08-25', '2026-09-24', 19.25, 'Port autonome, zone 4, Douala', 'Devis valable jusqu’à la date indiquée. Pour l’accepter, retournez-le signé avec la mention « Bon pour accord ».', 'sent', null, '2026-08-25T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', 'DEV-2026-0017', '00000000-0000-4000-8000-000000000102', '2026-08-20', '2026-09-19', 19.25, 'Rue 1.750, Quartier Nlongkak, Yaoundé', 'Devis valable jusqu’à la date indiquée. Pour l’accepter, retournez-le signé avec la mention « Bon pour accord ».', 'sent', null, '2026-08-20T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', 'DEV-2026-0016', '00000000-0000-4000-8000-000000000100', '2026-08-10', '2026-09-09', 19.25, 'Zone industrielle Bassa, BP 1204, Douala', 'Devis valable jusqu’à la date indiquée. Pour l’accepter, retournez-le signé avec la mention « Bon pour accord ».', 'accepted', null, '2026-08-10T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001', 'DEV-2026-0015', '00000000-0000-4000-8000-000000000104', '2026-07-05', '2026-08-04', 19.25, 'Marché A, avenue des Banques, Bafoussam', 'Devis valable jusqu’à la date indiquée. Pour l’accepter, retournez-le signé avec la mention « Bon pour accord ».', 'sent', null, '2026-07-05T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000001', 'DEV-2026-0014', '00000000-0000-4000-8000-000000000102', '2026-06-28', '2026-07-28', 19.25, 'Rue 1.750, Quartier Nlongkak, Yaoundé', 'Devis valable jusqu’à la date indiquée. Pour l’accepter, retournez-le signé avec la mention « Bon pour accord ».', 'accepted', '00000000-0000-4000-8000-000000000204', '2026-06-28T08:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000001', 'DEV-2026-0013', '00000000-0000-4000-8000-000000000107', '2026-06-18', '2026-07-18', 19.25, 'Route de Sangmélima, PK 7, Ebolowa', 'Devis valable jusqu’à la date indiquée. Pour l’accepter, retournez-le signé avec la mention « Bon pour accord ».', 'refused', null, '2026-06-18T08:00:00.000Z');

insert into public.quote_items (quote_id, position, description, qty_milli, unit_price) values
  ('00000000-0000-4000-8000-000000000300', 0, 'Application mobile — cadrage et maquettes', 1000, 1250000),
  ('00000000-0000-4000-8000-000000000300', 1, 'Développement iOS et Android', 1000, 4800000),
  ('00000000-0000-4000-8000-000000000300', 2, 'Recette et mise en ligne (jours)', 6000, 180000),
  ('00000000-0000-4000-8000-000000000301', 0, 'Refonte du portail de suivi des expéditions', 1000, 3200000),
  ('00000000-0000-4000-8000-000000000301', 1, 'Connecteur avec le système douanier', 1000, 1450000),
  ('00000000-0000-4000-8000-000000000301', 2, 'Maintenance annuelle', 1000, 960000),
  ('00000000-0000-4000-8000-000000000302', 0, 'Identité visuelle du cabinet', 1000, 1100000),
  ('00000000-0000-4000-8000-000000000302', 1, 'Papeterie et supports de rendez-vous', 1000, 340000),
  ('00000000-0000-4000-8000-000000000303', 0, 'Signalétique de chantier — conception', 1000, 620000),
  ('00000000-0000-4000-8000-000000000303', 1, 'Production des panneaux', 12000, 85000),
  ('00000000-0000-4000-8000-000000000304', 0, 'Catalogue produits — direction artistique', 1000, 480000),
  ('00000000-0000-4000-8000-000000000304', 1, 'Prises de vue en studio (journées)', 2000, 260000),
  ('00000000-0000-4000-8000-000000000305', 0, 'Audit de l’image de marque', 1000, 400000),
  ('00000000-0000-4000-8000-000000000305', 1, 'Restitution et recommandations', 1000, 400000),
  ('00000000-0000-4000-8000-000000000306', 0, 'Campagne d’affichage régionale', 1000, 2400000),
  ('00000000-0000-4000-8000-000000000306', 1, 'Achat d’espace (mois)', 3000, 750000);

-- --- Compteurs de numérotation ----------------------------------------------
-- Sans ces valeurs, la prochaine facture repartirait à 0001 et heurterait
-- l'index unique sur (company_id, number).
insert into public.document_counters (company_id, kind, year, last_value) values
  ('00000000-0000-4000-8000-000000000001', 'invoice', 2026, 51),
  ('00000000-0000-4000-8000-000000000001', 'quote',   2026, 18);

-- --- Rattachement au compte -------------------------------------------------
-- Le seed ne peut pas créer de compte : auth.users est alimenté par Supabase
-- Auth. On rattache donc l'entreprise au premier utilisateur existant. Si la
-- base n'en a aucun, créez un compte puis rejouez ce seul bloc.
do $seed$
declare
  v_user uuid;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise notice 'Aucun utilisateur : creez un compte, puis rejouez ce bloc.';
  else
    insert into public.company_members (company_id, user_id, role)
    values ('00000000-0000-4000-8000-000000000001', v_user, 'owner')
    on conflict (company_id, user_id) do nothing;
    raise notice 'Entreprise de demonstration rattachee a %', v_user;
  end if;
end
$seed$;

commit;

-- =============================================================================
-- Contrôles de référence, calculés par computeTotals à la génération.
-- Ils doivent se retrouver à l'identique sur le tableau de bord.
--
--   Clients                 : 8
--   Factures                : 15 (36 lignes)
--   Devis                   : 7 (16 lignes)
--   Factures émises         : 13
--   Montant facturé         : 25000166 FCFA
--   Montant encaissé        : 11211550 FCFA
--   Reste à encaisser       : 13788616 FCFA
-- =============================================================================
