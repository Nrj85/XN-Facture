import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { toClient, toCompany, toInvoice, toQuote } from '@/lib/db/mappers';
import type { ClientRow, CompanyRow, InvoiceWithItemsRow, QuoteWithItemsRow } from '@/lib/db/types';
import { sortByRecency, toView } from '@/lib/invoices';
import { sortQuotesByRecency, toQuoteView } from '@/lib/quotes';
import { today } from '@/lib/today';
import type { Client, Company, InvoiceView, QuoteView } from '@/lib/types';
import { DEFAULT_PLAN, parsePlan, type PlanCode } from '@/lib/plans';

/**
 * Lectures serveur.
 *
 * Toutes passent par le client porteur de la session, donc **sous RLS**. Le
 * filtre `company_id` explicite est une ceinture par-dessus les bretelles : la
 * politique suffirait, mais l'index s'en sert et l'intention reste lisible.
 *
 * Les vues (`InvoiceView`, `QuoteView`) sont assemblées ici par `toView` /
 * `toQuoteView` — les mêmes fonctions qu'en phase 2. Aucun total n'est calculé
 * en SQL.
 */

export interface Session {
  userId: string;
  email: string;
  /** Nom affiché, tiré des métadonnées du compte. Retombe sur l'email. */
  displayName: string;
  /**
   * Le nom tel qu'il est réellement enregistré — **vide s'il ne l'est pas**.
   *
   * `displayName` retombe sur l'email, ce qui est juste pour AFFICHER mais faux
   * pour ÉDITER : le formulaire de paramètres aurait préchargé une adresse email
   * dans le champ « Votre nom », et le premier enregistrement l'aurait gravée
   * comme nom. Les deux champs disent donc deux choses différentes.
   */
  fullName: string;
  companyId: string;
  company: Company;
}

/**
 * Résultat de `getSession` : la session, ou la raison de son absence.
 *
 * Deux raisons distinctes, parce que ce sont deux problèmes distincts : pas de
 * session → connexion ; session mais aucune entreprise → création d'entreprise.
 * Renvoyer les deux au même endroit enfermerait l'utilisateur dans une boucle.
 */
export type SessionResult =
  | { ok: true; session: Session }
  | { ok: false; raison: 'anonyme' | 'sans-entreprise' };

/**
 * Session courante, sans redirection.
 *
 * Une route d'API ne peut pas se contenter de `requireSession` : `redirect()`
 * y produit un 307 vers une page HTML, que `fetch` suit sans broncher. Le
 * client reçoit alors du HTML avec `response.ok` à vrai et croit tenir un PDF.
 * D'où cette variante, qui laisse l'appelant choisir son code de retour.
 */
export async function getSession(): Promise<SessionResult> {
  const supabase = createClient();

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false, raison: 'anonyme' };

  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member) return { ok: false, raison: 'sans-entreprise' };

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', member.company_id)
    .single<CompanyRow>();

  if (error || !company) return { ok: false, raison: 'sans-entreprise' };

  const metadata = auth.user.user_metadata as { full_name?: string } | null;

  return {
    ok: true,
    session: {
      userId: auth.user.id,
      email: auth.user.email ?? '',
      displayName: metadata?.full_name?.trim() || (auth.user.email ?? 'Utilisateur'),
      fullName: metadata?.full_name?.trim() ?? '',
      companyId: company.id,
      company: toCompany(company),
    },
  };
}

/** Contexte exigé par toute page applicative. Redirige plutôt que d'échouer. */
export async function requireSession(): Promise<Session> {
  const result = await getSession();
  if (result.ok) return result.session;
  redirect(result.raison === 'anonyme' ? '/connexion' : '/bienvenue');
}

export async function getClients(companyId: string): Promise<Client[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true })
    .returns<ClientRow[]>();

  if (error) throw new Error(`Lecture des clients impossible : ${error.message}`);
  return (data ?? []).map(toClient);
}

export async function getInvoiceViews(companyId: string): Promise<InvoiceView[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('company_id', companyId)
    .returns<InvoiceWithItemsRow[]>();

  if (error) throw new Error(`Lecture des factures impossible : ${error.message}`);

  const clients = await getClients(companyId);
  const now = today();
  return sortByRecency((data ?? []).map((row) => toView(toInvoice(row), clients, now)));
}

export async function getInvoiceView(
  companyId: string,
  id: string,
): Promise<InvoiceView | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle<InvoiceWithItemsRow>();

  // Un identifiant absent n'est pas une erreur : c'est un écran « introuvable ».
  if (error || !data) return undefined;

  const clients = await getClients(companyId);
  return toView(toInvoice(data), clients, today());
}

export async function getQuoteViews(companyId: string): Promise<QuoteView[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('company_id', companyId)
    .returns<QuoteWithItemsRow[]>();

  if (error) throw new Error(`Lecture des devis impossible : ${error.message}`);

  const clients = await getClients(companyId);
  const now = today();
  return sortQuotesByRecency((data ?? []).map((row) => toQuoteView(toQuote(row), clients, now)));
}

export async function getQuoteView(companyId: string, id: string): Promise<QuoteView | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle<QuoteWithItemsRow>();

  if (error || !data) return undefined;

  const clients = await getClients(companyId);
  return toQuoteView(toQuote(data), clients, today());
}

/**
 * Nombre de documents rattachés à un client.
 *
 * Sert à expliquer un refus de suppression AVANT de tenter l'opération. La
 * base refuserait de toute façon (`on delete restrict`), mais un message qui
 * annonce « 3 factures » vaut mieux qu'une erreur de contrainte brute.
 */
export async function countDocumentsForClient(
  companyId: string,
  clientId: string,
): Promise<{ invoices: number; quotes: number }> {
  const supabase = createClient();

  const [invoices, quotes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('client_id', clientId),
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('client_id', clientId),
  ]);

  return { invoices: invoices.count ?? 0, quotes: quotes.count ?? 0 };
}

// --- Abonnement --------------------------------------------------------------

export interface Subscription {
  plan: PlanCode;
  /** Date civile `AAAA-MM-JJ`, ou `null` pour une formule qui n'expire pas. */
  expiresAt: string | null;
  /** La formule choisie sur la grille tarifaire. N'accorde rien. */
  requested: PlanCode | null;
}

export interface SubscriptionPaymentRow {
  id: string;
  plan: PlanCode;
  amount: number;
  channel: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

/**
 * Formule en cours.
 *
 * Le déclencheur `companies_default_subscription` garantit une ligne par
 * entreprise, et la migration a rattrapé les anciennes. Le repli sur Découverte
 * couvre malgré tout le cas manquant : une page d'abonnement qui plante vaut
 * moins qu'une page qui affiche la formule gratuite.
 */
export async function getSubscription(companyId: string): Promise<Subscription> {
  const supabase = createClient();

  const { data } = await supabase
    .from('subscriptions')
    .select('plan,expires_at,requested')
    .eq('company_id', companyId)
    .maybeSingle();

  const row = data as { plan?: string; expires_at?: string | null; requested?: string | null } | null;

  return {
    plan: parsePlan(row?.plan) ?? DEFAULT_PLAN,
    expiresAt: row?.expires_at ?? null,
    requested: parsePlan(row?.requested),
  };
}

/** Journal des paiements d'abonnement, le plus récent en tête. */
export async function getSubscriptionPayments(
  companyId: string,
): Promise<SubscriptionPaymentRow[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('subscription_payments')
    .select('id,plan,amount,channel,status,period_start,period_end,created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    plan: string;
    amount: number;
    channel: string;
    status: string;
    period_start: string | null;
    period_end: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    plan: parsePlan(row.plan) ?? DEFAULT_PLAN,
    amount: row.amount,
    channel: row.channel,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
  }));
}
