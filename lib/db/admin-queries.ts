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

export interface AdminAccountRow {
  id: string;
  email: string;
  /**
   * ⚠️ **PEUT ÊTRE ABSENTE, et ce n'est pas une précaution théorique.**
   * `auth.users.created_at` est `is_nullable = YES` — mesuré sur le projet, et
   * non déduit. Un `createdAt.localeCompare()` sur `null` lève une `TypeError`
   * qui, dans un composant serveur, emporte **toute** la page `/admin`. Aucune
   * des 8 lignes actuelles n'est dans ce cas : le défaut est **latent, pas
   * constaté** — mais il ne coûte rien de le rendre impossible.
   */
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmed: boolean;
}

/**
 * Résultat d'une lecture de l'espace administrateur.
 *
 * ⚠️ **UN `rows` VIDE ET UN `failure` SONT DEUX CHOSES DIFFÉRENTES, et c'est
 * tout l'objet de ce type.** Jusqu'au 8 oct. 2026 ces lectures ignoraient leur
 * `error` : une RPC en échec rend `data = null`, donc un tableau vide, donc un
 * écran qui annonçait « 0 compte » **sans la moindre alerte**. Un décompte faux
 * est pire qu'une absence de décompte — celui qui le lit en tire des
 * conclusions. Pour que l'écran puisse dire « je n'ai pas pu lire », il faut
 * d'abord qu'il le sache.
 *
 * ⚠️ **On ne LÈVE pas, et c'est délibéré.** `/admin` fait quatre lectures
 * indépendantes en `Promise.all` : une exception emporterait les trois autres,
 * donc la liste des entreprises et le journal, qui n'ont rien. Chaque carte
 * porte son propre échec.
 */
export interface AdminRead<T> {
  rows: T[];
  /** Phrase française si la LECTURE a échoué. `null` quand tout va bien. */
  failure: string | null;
}

/** Une chaîne non vide, ou `null`. Les cinq colonnes de la RPC sont nullables. */
function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur !== '' ? valeur : null;
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

/**
 * Comptes du projet, avec leur dernière connexion.
 *
 * ⚠️ **L'ÉCHEC EST RAPPORTÉ, PLUS AVALÉ.** `tsc` ne peut rien ici : le client
 * Supabase n'est pas typé (§4), donc `.rpc('nom_inexistant')` compile. Le seul
 * filet est de regarder `error` — sans quoi une RPC révoquée, renommée ou
 * absente produit un écran qui affiche sereinement « 0 compte ».
 */
export async function getAdminAccounts(): Promise<AdminRead<AdminAccountRow>> {
  const supabase = createClient();
  // ⚠️ **`admin_actors` EST UNE FONCTION, PLUS UNE VUE** (migration 0019).
  // Elle rend les cinq colonnes d'un bloc : une signature `returns table`
  // est fixe, on ne choisit pas un sous-ensemble.
  const { data, error } = await supabase.rpc('admin_actors');

  if (error) {
    // Le journal du serveur est le seul endroit où le MOTIF survit : l'écran
    // n'en dira rien à l'administrateur, et il ne doit rien en dire — un
    // message de Postgres y arriverait en anglais, avec son SQLSTATE.
    console.error('[admin] lecture des comptes impossible :', error.code, error.message);
    return { rows: [], failure: 'La liste des comptes n’a pas pu être lue.' };
  }

  const lignes = (data ?? []) as Array<Record<string, unknown>>;

  // ⚠️ **LE TRI EST FAIT ICI, et non par `.order()`.** PostgREST accepte
  // d'ordonner le résultat d'une fonction, mais la vue le faisait en SQL et
  // je ne veux pas que le classement de cet écran dépende de ce détail de
  // comportement : neuf lignes se trient en mémoire pour rien du tout.
  //
  // ⚠️ **ET IL DOIT SURVIVRE À UNE DATE ABSENTE.** `created_at` est nullable
  // (voir `AdminAccountRow`) : le repli sur `''` range les comptes sans date
  // en FIN de liste, là où `null` faisait lever le comparateur.
  const rows = lignes
    .map((row) => ({
      id: texte(row.id) ?? '',
      email: texte(row.email) ?? '',
      createdAt: texte(row.created_at),
      lastSignInAt: texte(row.last_sign_in_at),
      confirmed: Boolean(row.email_confirme),
    }))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return { rows, failure: null };
}

/**
 * Journal d'activité, du plus récent au plus ancien.
 *
 * Le nom de l'entreprise et l'email de l'acteur sont résolus ici plutôt que par
 * une jointure : `activity_log.company_id` n'a **pas** de clé étrangère — c'est
 * délibéré, pour que l'historique survive à la suppression de ce qu'il
 * journalise — et PostgREST ne sait pas joindre sans relation déclarée.
 */
export async function getAdminActivity(limit = 60): Promise<AdminRead<AdminActivityRow>> {
  const supabase = createClient();

  const [journal, companies, comptes] = await Promise.all([
    supabase
      .from('activity_log')
      .select('id,occurred_at,company_id,actor_id,entity,entity_id,action,details')
      .order('occurred_at', { ascending: false })
      .limit(limit),
    supabase.from('companies').select('id,name'),
    // Fonction depuis 0019 : `.rpc()` et non `.from()`.
    supabase.rpc('admin_actors'),
  ]);

  // ⚠️ **SEUL L'ÉCHEC DU JOURNAL LUI-MÊME EST UN ÉCHEC D'ÉCRAN.** Sans ses
  // lignes, la carte annoncerait « Journal vide » — une affirmation, et fausse.
  if (journal.error) {
    console.error('[admin] lecture du journal impossible :', journal.error.code, journal.error.message);
    return { rows: [], failure: 'Le journal d’activité n’a pas pu être lu.' };
  }

  // ⚠️ **LES DEUX AUTRES NE FONT QUE RÉSOUDRE DES NOMS : elles se dégradent,
  // elles ne mentent pas.** Une ligne sans nom d'entreprise ni email d'acteur
  // reste vraie sur ce qu'elle rapporte — l'entité, l'action, l'instant — et
  // l'écran affiche déjà « entreprise supprimée » pour les lignes orphelines.
  // Échouer ici priverait l'exploitant d'un journal entièrement lisible.
  // **Mais le motif part au journal du serveur** : un repli muet masque la
  // panne qu'il amortit, c'est la leçon payée sur Tara le 6 oct.
  if (companies.error) {
    console.error('[admin] noms d’entreprise non résolus :', companies.error.message);
  }
  if (comptes.error) {
    console.error('[admin] emails d’acteur non résolus :', comptes.error.code, comptes.error.message);
  }

  const nomEntreprise = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const emailActeur = new Map(
    ((comptes.data ?? []) as Array<Record<string, unknown>>).map((u) => [
      texte(u.id) ?? '',
      texte(u.email) ?? '',
    ]),
  );

  const rows = (journal.data ?? []).map((row) => ({
    id: row.id as number,
    occurredAt: row.occurred_at as string,
    companyId: (row.company_id as string) ?? null,
    companyName: row.company_id ? (nomEntreprise.get(row.company_id as string) ?? null) : null,
    actorEmail: row.actor_id ? (emailActeur.get(row.actor_id as string) ?? null) : null,
    entity: row.entity as string,
    action: row.action as string,
    details: (row.details as Record<string, unknown> | null) ?? null,
  }));

  return { rows, failure: null };
}

/**
 * Nombre de titulaires ayant refusé la prospection.
 *
 * Il est affiché près du bouton d'export, parce qu'un fichier qui compte moins
 * de lignes qu'il n'y a d'entreprises doit s'expliquer. Sans ce chiffre,
 * l'écart passerait pour un défaut de l'export — et on chercherait un bug là
 * où le produit fait exactement ce qu'on lui demande.
 */
export async function getMarketingOptOutCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('email_preferences')
    .select('user_id', { count: 'exact', head: true })
    .eq('marketing', false);

  return error ? 0 : (count ?? 0);
}
