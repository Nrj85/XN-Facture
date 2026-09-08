'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  FileText,
  Receipt,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/dashboard/stat-card';
import { formatAmount, formatMoney } from '@/lib/money';
import type {
  AdminActivityRow,
  AdminCompanyRow,
  AdminSummary,
} from '@/lib/db/admin-queries';

/**
 * Espace administrateur de plateforme — **lecture seule**.
 *
 * Il réemploie les primitives de l'application (`Card`, `StatCard`,
 * `EmptyState`) plutôt que d'inventer un style « back-office » à part : c'est
 * le même produit, et un second design système aurait divergé du premier au
 * bout de deux écrans.
 *
 * Aucun bouton n'écrit quoi que ce soit. Ce n'est pas une omission mais la
 * décision prise avec l'utilisateur : la migration 0004 n'accorde aux
 * administrateurs que des politiques `for select`, et l'interface ne propose
 * donc rien que la base refuserait.
 *
 * Les montants passent par `lib/money.ts`, comme partout. Ils agrègent
 * plusieurs entreprises, donc plusieurs devises possibles à terme — pour
 * l'instant toutes sont en XAF, et l'unité est affichée en clair pour que
 * l'ambiguïté se voie le jour où elle apparaîtra.
 */

/** Un instant ISO en date et heure lisibles, fuseau de l'entreprise. */
function instant(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Douala',
  }).format(new Date(iso));
}

/** Date seule, pour les colonnes où l'heure n'apprend rien. */
function jour(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Douala',
  }).format(new Date(iso));
}

const ENTITES: Record<string, string> = {
  company: 'Entreprise',
  client: 'Client',
  invoice: 'Facture',
  quote: 'Devis',
};

const ACTIONS: Record<string, { label: string; ton: 'neutre' | 'vert' | 'rouge' | 'ambre' }> = {
  created: { label: 'Créé', ton: 'vert' },
  updated: { label: 'Modifié', ton: 'neutre' },
  status_changed: { label: 'Statut changé', ton: 'ambre' },
  deleted: { label: 'Supprimé', ton: 'rouge' },
};

const TONS = {
  neutre: 'bg-status-draft-bg text-status-draft',
  vert: 'bg-status-paid-bg text-status-paid',
  ambre: 'bg-status-sent-bg text-status-sent',
  rouge: 'bg-status-overdue-bg text-status-overdue',
} as const;

function ActionBadge({ action }: { action: string }) {
  const info = ACTIONS[action] ?? { label: action, ton: 'neutre' as const };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONS[info.ton]}`}
    >
      {info.label}
    </span>
  );
}

/** Résumé lisible d'une ligne de journal, à partir de son `details` jsonb. */
function resume(row: AdminActivityRow): string {
  const d = row.details ?? {};
  const numero = typeof d.number === 'string' ? d.number : null;
  const nom = typeof d.name === 'string' ? d.name : null;

  if (row.action === 'status_changed') {
    const avant = typeof d.previous_status === 'string' ? d.previous_status : '?';
    const apres = typeof d.status === 'string' ? d.status : '?';
    return `${numero ?? 'Sans numéro'} · ${avant} → ${apres}`;
  }
  return nom ?? numero ?? 'Sans numéro';
}

export function AdminView({
  summary,
  companies,
  accounts,
  activity,
  adminEmail,
}: {
  summary: AdminSummary;
  companies: AdminCompanyRow[];
  accounts: { id: string; email: string; createdAt: string; lastSignInAt: string | null; confirmed: boolean }[];
  activity: AdminActivityRow[];
  adminEmail: string;
}) {
  const [recherche, setRecherche] = useState('');

  const filtrees = useMemo(() => {
    const aiguille = recherche.trim().toLowerCase();
    if (!aiguille) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(aiguille) ||
        c.legalName.toLowerCase().includes(aiguille) ||
        c.city.toLowerCase().includes(aiguille),
    );
  }, [companies, recherche]);

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <p className="label-caps">Plateforme</p>
        <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">
          Espace administrateur
        </h1>
        <p className="mt-2 max-w-[70ch] text-sm text-ink-2">
          Vue transversale de toutes les entreprises. Connecté en tant que{' '}
          <strong className="font-semibold text-ink">{adminEmail}</strong>.
        </p>
      </header>

      {/* Dire en clair ce que cet espace peut et ne peut pas faire. Un écran
          d'administration muet sur ses propres limites invite à chercher des
          boutons qui n'existent pas. */}
      <p className="flex items-start gap-2.5 rounded-[10px] border border-line bg-brand-soft px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
        <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-brand-hover" aria-hidden />
        <span>
          <strong className="font-semibold text-ink">Lecture seule.</strong> Cet espace n’écrit
          rien : la base n’accorde aux administrateurs que des droits de consultation. Le retrait
          d’un administrateur, comme son ajout, passe par la console SQL.
        </span>
      </p>

      <section aria-label="Chiffres de la plateforme" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Entreprises"
          value={String(summary.companies)}
          unit={summary.companies > 1 ? 'comptes' : 'compte'}
          icon={Building2}
          hint={`${summary.members} membre${summary.members > 1 ? 's' : ''} au total`}
        />
        <StatCard
          label="Documents"
          value={String(summary.invoices + summary.quotes)}
          unit="pièces"
          icon={FileText}
          hint={`${summary.invoices} facture${summary.invoices > 1 ? 's' : ''} · ${summary.quotes} devis`}
        />
        <StatCard
          label="Facturé (toutes entreprises)"
          value={formatAmount(summary.invoiced)}
          unit="FCFA"
          icon={Receipt}
          hint="Brouillons et annulations exclus"
        />
        <StatCard
          label="Reste à encaisser"
          value={formatAmount(summary.outstanding)}
          unit="FCFA"
          icon={Wallet}
          meter={summary.invoiced > 0 ? summary.collected / summary.invoiced : 0}
          hint={`${formatMoney(summary.collected)} déjà encaissés`}
        />
      </section>

      {/* --- Entreprises --- */}
      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Entreprises</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Classées par montant facturé, de la plus active à la moins active
            </p>
          </div>
          <label className="relative sm:ml-auto sm:w-64">
            <span className="sr-only">Rechercher une entreprise</span>
            <Input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, raison sociale ou ville"
            />
          </label>
        </CardHeader>

        {filtrees.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={recherche ? 'Aucune entreprise ne correspond' : 'Aucune entreprise'}
            description={
              recherche
                ? 'Essayez un autre nom, une autre ville.'
                : 'Aucun compte n’a encore créé d’entreprise sur la plateforme.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <caption className="sr-only">Entreprises de la plateforme</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="label-caps px-5 py-2.5 text-left">Entreprise</th>
                  <th scope="col" className="label-caps px-5 py-2.5 text-left">Ville</th>
                  <th scope="col" className="label-caps px-5 py-2.5 text-right">Membres</th>
                  <th scope="col" className="label-caps px-5 py-2.5 text-right">Clients</th>
                  <th scope="col" className="label-caps px-5 py-2.5 text-right">Documents</th>
                  <th scope="col" className="label-caps px-5 py-2.5 text-right">Facturé</th>
                  <th scope="col" className="label-caps px-5 py-2.5 text-right">Encaissé</th>
                  <th scope="col" className="label-caps px-5 py-2.5 text-left">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {filtrees.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-5 py-3.5">
                      <span className="block font-semibold text-ink">{c.name}</span>
                      {c.legalName !== c.name && (
                        <span className="mt-0.5 block text-[11.5px] text-ink-3">{c.legalName}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-ink-2">{c.city || '—'}</td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-2">{c.members}</td>
                    <td className="tabular px-5 py-3.5 text-right text-ink-2">{c.clients}</td>
                    <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-ink-2">
                      {c.invoices} + {c.quotes}
                    </td>
                    <td className="tabular whitespace-nowrap px-5 py-3.5 text-right font-semibold text-ink">
                      {formatMoney(c.invoiced)}
                    </td>
                    <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-ink-2">
                      {formatMoney(c.collected)}
                    </td>
                    <td className="tabular whitespace-nowrap px-5 py-3.5 text-ink-2">
                      {jour(c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --- Comptes --- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Comptes</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {accounts.length} compte{accounts.length > 1 ? 's' : ''}, du plus récent au plus
              ancien
            </p>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <caption className="sr-only">Comptes du projet</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="label-caps px-5 py-2.5 text-left">Adresse</th>
                <th scope="col" className="label-caps px-5 py-2.5 text-left">Inscrit le</th>
                <th scope="col" className="label-caps px-5 py-2.5 text-left">Dernière connexion</th>
                <th scope="col" className="label-caps px-5 py-2.5 text-left">Adresse confirmée</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
                      <span className="font-medium text-ink">{a.email}</span>
                    </span>
                  </td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-ink-2">
                    {jour(a.createdAt)}
                  </td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-ink-2">
                    {a.lastSignInAt ? instant(a.lastSignInAt) : 'Jamais'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        a.confirmed ? TONS.vert : TONS.ambre
                      }`}
                    >
                      {a.confirmed ? 'Oui' : 'En attente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --- Journal --- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Journal d’activité</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Alimenté par des déclencheurs en base : rien ne s’y écrit depuis l’application, et
              rien n’y échappe
            </p>
          </div>
        </CardHeader>

        {activity.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Journal vide"
            description="Aucune activité depuis la mise en place du journal. Les événements antérieurs ne sont pas rétroactifs — un déclencheur ne connaît que ce qui se passe après lui."
          />
        ) : (
          <ul className="divide-y divide-line">
            {activity.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                <span className="tabular shrink-0 text-[11.5px] text-ink-3">
                  {instant(row.occurredAt)}
                </span>
                <ActionBadge action={row.action} />
                <span className="text-[13px] font-medium text-ink">
                  {ENTITES[row.entity] ?? row.entity}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">
                  {resume(row)}
                </span>
                <span className="shrink-0 text-[11.5px] text-ink-3">
                  {row.companyName ?? 'entreprise supprimée'}
                  {' · '}
                  {row.actorEmail ?? 'système'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
