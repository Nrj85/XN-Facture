import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeTotals } from '@/lib/invoice-calc';

/**
 * Lectures de l'espace administrateur — **transversales à toutes les
 * entreprises**.
 *
 * ⚠️ Elles passent par le client Supabase ORDINAIRE, celui qui porte la session
 * de l'utilisateur. Rien n'y contourne la RLS : c'est la base qui décide, grâce
 * aux politiques `*_admin_select` de la migration 0004. Un utilisateur non
 * administrateur qui appellerait ces fonctions n'obtiendrait que ses propres
 * lignes — le pire cas est un écran vide, jamais une fuite.
 *
 * **La clé `service_role` n'est utilisée nulle part**, et ne doit pas l'être :
 * elle contournerait toute la RLS, et un seul défaut d'autorisation exposerait
 * l'intégralité des données de tous les clients.
 */

export interface AdminSummary {
  companies: number;
  members: number;
  clients: number;
  invoices: number;
  quotes: number;
  /** Total TTC facturé, brouillons et annulations exclus, toutes entreprises. */
  invoiced: number;
  collected: number;
  outstanding: number;
}

export interface AdminCompanyRow {
  id: string;
  name: string;
  legalName: string;
  city: string;
  createdAt: string;
  members: number;
  clients: number;
  invoices: number;
  quotes: number;
  /** Facturé TTC — recalculé depuis les lignes, jamais lu d'un total stocké. */
  invoiced: number;
  collected: number;
  lastActivity: string | null;
}

export interface AdminActivityRow {
  id: number;
  occurredAt: string;
  companyId: string | null;
  companyName: string | null;
  actorEmail: string | null;
  entity: string;
  action: string;
  details: Record<string, unknown> | null;
}

/**
 * Garde de l'espace administrateur.
 *
 * ⚠️ **Elle n'exige PAS d'entreprise.** `getSession()`, qui sert partout
 * ailleurs, renvoie `sans-entreprise` pour un compte sans société — et
 * l'appelant redirige alors vers `/bienvenue`. Or un administrateur de
 * plateforme n'appartient à aucune entreprise : construite sur `getSession()`,
 * cette garde lui interdisait son propre espace. Constaté en conditions
 * réelles — la base répondait `is_platform_admin() = true` pendant que la page
 * renvoyait un 307 vers `/bienvenue`.
 *
 * Le contrôle est **doublé** : la base refuse déjà les lignes des autres
 * entreprises à un non-administrateur. Cette garde ne fait qu'éviter un écran
 * vide sans explication, et renvoyer la personne là où elle a quelque chose à
 * faire.
 */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const supabase = createClient();

  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) redirect('/connexion');

  const { data: estAdmin, error: rpcError } = await supabase.rpc('is_platform_admin');
  if (rpcError || estAdmin !== true) redirect('/dashboard');

  return { userId: auth.user.id, email: auth.user.email ?? '' };
}

/** Vrai si la session courante est administrateur. Sans redirection. */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('is_platform_admin');
  return !error && data === true;
}

/**
 * Vue d'ensemble de la plateforme.
 *
 * ⚠️ **Les totaux sont calculés en TypeScript, jamais en SQL.** C'est la règle
 * de la section 5 du projet : réécrire `roundHalfUp` en PL/pgSQL garantirait
 * qu'un jour les deux versions divergent, sur de l'argent. On lit donc les
 * lignes et on appelle `computeTotals`, exactement comme le tableau de bord.
 *
 * ⚠️ **Cette lecture ne passe pas à l'échelle telle quelle** : elle charge
 * toutes les factures de toutes les entreprises avec leurs lignes. C'est sans
 * conséquence à ce stade (quelques entreprises, quelques dizaines de factures)
 * et parfaitement exact. Le jour où le volume l'exigera, il faudra une vue
 * matérialisée — et ce jour-là, l'arrondi devra rester en TypeScript.
 */
export async function getAdminOverview(): Promise<{
  summary: AdminSummary;
  companies: AdminCompanyRow[];
}> {
  const supabase = createClient();

  const [companies, members, clients, invoices, quotes] = await Promise.all([
    supabase.from('companies').select('id,name,legal_name,city,created_at'),
    supabase.from('company_members').select('company_id,user_id'),
    supabase.from('clients').select('id,company_id'),
    supabase
      .from('invoices')
      .select('id,company_id,status,amount_paid,vat_rate,updated_at,invoice_items(qty_milli,unit_price)'),
    supabase.from('quotes').select('id,company_id'),
  ]);

  type LigneBrute = { qty_milli: number; unit_price: number };
  type FactureBrute = {
    id: string;
    company_id: string;
    status: string;
    amount_paid: number;
    vat_rate: number;
    updated_at: string;
    invoice_items: LigneBrute[];
  };

  const factures = (invoices.data ?? []) as unknown as FactureBrute[];

  /** Total TTC d'une facture, par le moteur commun. */
  const totalTtc = (f: FactureBrute) =>
    computeTotals(
      (f.invoice_items ?? []).map((l) => ({
        quantity: l.qty_milli / 1000,
        unitPrice: l.unit_price,
      })),
      f.vat_rate,
    ).total;

  /** Une facture compte dans le chiffre d'affaires dès qu'elle est émise. */
  const emise = (f: FactureBrute) => f.status !== 'draft' && f.status !== 'cancelled';

  const compte = <T extends { company_id: string }>(rows: T[] | null) => {
    const par = new Map<string, number>();
    for (const row of rows ?? []) par.set(row.company_id, (par.get(row.company_id) ?? 0) + 1);
    return par;
  };

  const membresPar = compte(members.data);
  const clientsPar = compte(clients.data);
  const facturesPar = compte(factures);
  const devisPar = compte((quotes.data ?? []) as { company_id: string }[]);

  const factureePar = new Map<string, number>();
  const encaissePar = new Map<string, number>();
  const derniereAct = new Map<string, string>();

  let invoiced = 0;
  let collected = 0;

  for (const f of factures) {
    const precedent = derniereAct.get(f.company_id);
    if (!precedent || f.updated_at > precedent) derniereAct.set(f.company_id, f.updated_at);
    if (!emise(f)) continue;

    const ttc = totalTtc(f);
    invoiced += ttc;
    collected += f.amount_paid;
    factureePar.set(f.company_id, (factureePar.get(f.company_id) ?? 0) + ttc);
    encaissePar.set(f.company_id, (encaissePar.get(f.company_id) ?? 0) + f.amount_paid);
  }

  const lignes: AdminCompanyRow[] = (companies.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    legalName: c.legal_name,
    city: c.city,
    createdAt: c.created_at,
    members: membresPar.get(c.id) ?? 0,
    clients: clientsPar.get(c.id) ?? 0,
    invoices: facturesPar.get(c.id) ?? 0,
    quotes: devisPar.get(c.id) ?? 0,
    invoiced: factureePar.get(c.id) ?? 0,
    collected: encaissePar.get(c.id) ?? 0,
    lastActivity: derniereAct.get(c.id) ?? null,
  }));

  // De la plus active à la moins active : c'est l'ordre dans lequel on veut
  // lire une liste d'entreprises quand on exploite un service.
  lignes.sort((a, b) => b.invoiced - a.invoiced || a.name.localeCompare(b.name));

  return {
    summary: {
      companies: lignes.length,
      members: members.data?.length ?? 0,
      clients: clients.data?.length ?? 0,
      invoices: factures.length,
      quotes: quotes.data?.length ?? 0,
      invoiced,
      collected,
      outstanding: invoiced - collected,
    },
    companies: lignes,
  };
}

/** Comptes du projet, avec leur dernière connexion. */
export async function getAdminAccounts(): Promise<
  { id: string; email: string; createdAt: string; lastSignInAt: string | null; confirmed: boolean }[]
> {
  const supabase = createClient();
  const { data } = await supabase
    .from('admin_actors')
    .select('id,email,created_at,last_sign_in_at,email_confirme')
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: (row.email as string) ?? '',
    createdAt: row.created_at as string,
    lastSignInAt: (row.last_sign_in_at as string) ?? null,
    confirmed: Boolean(row.email_confirme),
  }));
}

/**
 * Journal d'activité, du plus récent au plus ancien.
 *
 * Le nom de l'entreprise et l'email de l'acteur sont résolus ici plutôt que par
 * une jointure : `activity_log.company_id` n'a **pas** de clé étrangère — c'est
 * délibéré, pour que l'historique survive à la suppression de ce qu'il
 * journalise — et PostgREST ne sait pas joindre sans relation déclarée.
 */
export async function getAdminActivity(limit = 60): Promise<AdminActivityRow[]> {
  const supabase = createClient();

  const [journal, companies, comptes] = await Promise.all([
    supabase
      .from('activity_log')
      .select('id,occurred_at,company_id,actor_id,entity,entity_id,action,details')
      .order('occurred_at', { ascending: false })
      .limit(limit),
    supabase.from('companies').select('id,name'),
    supabase.from('admin_actors').select('id,email'),
  ]);

  const nomEntreprise = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const emailActeur = new Map(
    (comptes.data ?? []).map((u) => [u.id as string, (u.email as string) ?? '']),
  );

  return (journal.data ?? []).map((row) => ({
    id: row.id as number,
    occurredAt: row.occurred_at as string,
    companyId: (row.company_id as string) ?? null,
    companyName: row.company_id ? (nomEntreprise.get(row.company_id as string) ?? null) : null,
    actorEmail: row.actor_id ? (emailActeur.get(row.actor_id as string) ?? null) : null,
    entity: row.entity as string,
    action: row.action as string,
    details: (row.details as Record<string, unknown> | null) ?? null,
  }));
}
