import { createClient } from '@/lib/supabase/server';

/**
 * Export des entreprises inscrites, pour les campagnes de prospection.
 *
 * ⚠️ **Lecture transversale, mais SANS `service_role`.** Comme tout l'espace
 * d'administration, cette lecture passe par le client ordinaire, porteur de la
 * session. C'est la base qui décide, grâce aux politiques `*_admin_select` de
 * la migration 0004 et à la clause `where` de la vue `admin_actors`. Un compte
 * non administrateur qui atteindrait cette route n'obtiendrait qu'un fichier
 * vide — jamais celui des autres.
 *
 * ⚠️ **Deux adresses email cohabitent, et il ne faut pas les confondre.**
 * `companies.email` est l'adresse de facturation que l'utilisateur saisit dans
 * ses paramètres et qui s'imprime sur ses factures : elle est souvent vide.
 * L'adresse du **titulaire** est celle de son compte : elle existe toujours,
 * puisqu'elle sert à se connecter. Pour une campagne, c'est la seconde qui est
 * exploitable — les deux figurent donc dans le fichier, sous des intitulés
 * distincts.
 */

export interface CompanyExportRow {
  name: string;
  legalName: string;
  ownerEmail: string;
  billingEmail: string;
  phone: string;
  city: string;
  country: string;
  plan: string;
  expiresAt: string;
  clients: number;
  invoices: number;
  quotes: number;
  createdAt: string;
  ownerLastSignIn: string;
}

const LIBELLES_FORMULE: Record<string, string> = {
  discovery: 'Découverte',
  pro: 'Pro',
  business: 'Entreprise',
};

/** Date civile en jj/mm/aaaa, fuseau de l'entreprise. Vide si absente. */
function jour(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Douala',
  }).format(new Date(iso));
}

/**
 * Compte les lignes par entreprise sans charger le détail.
 *
 * On ne lit que `company_id` : le fichier n'a pas besoin des montants, et
 * `getAdminOverview()` — qui charge toutes les lignes de toutes les factures
 * pour recalculer les totaux — serait ici un coût sans contrepartie.
 */
function tally(rows: { company_id: string }[] | null): Map<string, number> {
  const compte = new Map<string, number>();
  for (const r of rows ?? []) compte.set(r.company_id, (compte.get(r.company_id) ?? 0) + 1);
  return compte;
}

export async function getCompanyExportRows(): Promise<CompanyExportRow[]> {
  const supabase = createClient();

  const [companies, members, actors, subscriptions, clients, invoices, quotes] = await Promise.all([
    supabase
      .from('companies')
      .select('id,name,legal_name,email,phone,city,country,created_at')
      .order('created_at', { ascending: false }),
    supabase.from('company_members').select('company_id,user_id,role'),
    supabase.from('admin_actors').select('id,email,last_sign_in_at'),
    supabase.from('subscriptions').select('company_id,plan,expires_at'),
    supabase.from('clients').select('company_id'),
    supabase.from('invoices').select('company_id'),
    supabase.from('quotes').select('company_id'),
  ]);

  const parCompte = new Map(
    (actors.data ?? []).map((a) => [
      a.id as string,
      { email: (a.email as string) ?? '', lastSignIn: (a.last_sign_in_at as string) ?? null },
    ]),
  );

  // Le titulaire, c'est-à-dire le membre `owner`. Une entreprise en a
  // normalement un ; on prend le premier trouvé plutôt que de supposer.
  const titulaire = new Map<string, string>();
  for (const m of members.data ?? []) {
    if (m.role === 'owner' && !titulaire.has(m.company_id as string)) {
      titulaire.set(m.company_id as string, m.user_id as string);
    }
  }

  const abonnement = new Map(
    (subscriptions.data ?? []).map((s) => [
      s.company_id as string,
      { plan: (s.plan as string) ?? 'discovery', expiresAt: (s.expires_at as string) ?? null },
    ]),
  );

  const nbClients = tally(clients.data as { company_id: string }[] | null);
  const nbFactures = tally(invoices.data as { company_id: string }[] | null);
  const nbDevis = tally(quotes.data as { company_id: string }[] | null);

  return (companies.data ?? []).map((c) => {
    const id = c.id as string;
    const compte = parCompte.get(titulaire.get(id) ?? '');
    const abo = abonnement.get(id);

    return {
      name: (c.name as string) ?? '',
      legalName: (c.legal_name as string) ?? '',
      ownerEmail: compte?.email ?? '',
      billingEmail: (c.email as string) ?? '',
      phone: (c.phone as string) ?? '',
      city: (c.city as string) ?? '',
      country: (c.country as string) ?? '',
      plan: LIBELLES_FORMULE[abo?.plan ?? 'discovery'] ?? 'Découverte',
      expiresAt: jour(abo?.expiresAt),
      clients: nbClients.get(id) ?? 0,
      invoices: nbFactures.get(id) ?? 0,
      quotes: nbDevis.get(id) ?? 0,
      createdAt: jour(c.created_at as string),
      ownerLastSignIn: jour(compte?.lastSignIn),
    };
  });
}

const COLONNES: { titre: string; lire: (r: CompanyExportRow) => string | number }[] = [
  { titre: 'Entreprise', lire: (r) => r.name },
  { titre: 'Raison sociale', lire: (r) => r.legalName },
  { titre: 'Email du titulaire', lire: (r) => r.ownerEmail },
  { titre: 'Email de facturation', lire: (r) => r.billingEmail },
  { titre: 'Téléphone', lire: (r) => r.phone },
  { titre: 'Ville', lire: (r) => r.city },
  { titre: 'Pays', lire: (r) => r.country },
  { titre: 'Formule', lire: (r) => r.plan },
  { titre: 'Échéance', lire: (r) => r.expiresAt },
  { titre: 'Clients', lire: (r) => r.clients },
  { titre: 'Factures', lire: (r) => r.invoices },
  { titre: 'Devis', lire: (r) => r.quotes },
  { titre: 'Inscription', lire: (r) => r.createdAt },
  { titre: 'Dernière connexion', lire: (r) => r.ownerLastSignIn },
];

/**
 * Neutralise une cellule que le tableur prendrait pour une formule.
 *
 * ⚠️ **C'est une protection, pas une coquetterie.** Les noms d'entreprise sont
 * saisis par les utilisateurs. Excel et LibreOffice évaluent toute cellule
 * commençant par `=`, `+`, `-` ou `@` : quelqu'un qui nomme son entreprise
 * `=HYPERLINK("http://...","Cliquez")` — ou pire — attaquerait la machine de
 * celui qui ouvre l'export, c'est-à-dire précisément la nôtre. Le préfixe
 * apostrophe force le tableur à lire du texte. Les tabulations et retours
 * chariot de tête servent le même contournement, d'où leur présence ici.
 */
function neutraliser(valeur: string): string {
  return /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
}

/** Échappe une cellule au format CSV : guillemets doublés, champ encadré si besoin. */
function cellule(valeur: string | number): string {
  const texte = neutraliser(String(valeur ?? ''));
  return /[";\r\n]/.test(texte) || texte !== texte.trim()
    ? `"${texte.replace(/"/g, '""')}"`
    : texte;
}

/**
 * Compose le fichier.
 *
 * ⚠️ **Trois détails décident si le fichier s'ouvre proprement dans Excel** —
 * et les trois ont été choisis, pas subis :
 *
 * - **Le séparateur est le point-virgule.** Excel en configuration française
 *   attend `;` ; avec une virgule il empile tout dans une seule colonne et
 *   impose un assistant d'importation.
 * - **Le fichier commence par une marque d'ordre d'octets (BOM).** Sans elle,
 *   Excel lit l'UTF-8 comme du latin-1 : « Douala » passe encore, « Échéance »
 *   et « Société » deviennent illisibles.
 * - **Les fins de ligne sont en CRLF**, comme le veut la spécification CSV.
 */
export function toCsv(rows: CompanyExportRow[]): string {
  const lignes = [
    COLONNES.map((c) => cellule(c.titre)).join(';'),
    ...rows.map((r) => COLONNES.map((c) => cellule(c.lire(r))).join(';')),
  ];
  return `﻿${lignes.join('\r\n')}\r\n`;
}

/** `xn-facture-entreprises-2026-09-17.csv` */
export function exportFilename(now = new Date()): string {
  const jourIso = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Africa/Douala',
  }).format(now);
  return `xn-facture-entreprises-${jourIso}.csv`;
}
