'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, TriangleAlert, Users, X } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatInstant, type IsoDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { parsePlan, planByCode } from '@/lib/plans';
import {
  isRangeValid,
  isWithinRange,
  resolvePeriod,
  type DateRange,
  type PeriodPreset,
} from '@/lib/period';
import { today } from '@/lib/today';
import { TONS, type Ton } from '@/components/admin/tones';
import type { AdminActivityRow } from '@/lib/db/admin-queries';

/**
 * Le journal d'activité : filtres, pagination, et rien d'autre.
 *
 * ⚠️ **EXTRAIT DE `admin-view.tsx` LE 24 oct. 2026.** Il y était un `<ul>` plat
 * de toutes les lignes lues — 41 au jour de l'extraction, soit ~1 800 px d'un
 * bloc sur grand écran et ~2 500 px sur téléphone, où chaque rangée se replie
 * sur deux ou trois lignes. Rien ne permettait d'y chercher quoi que ce soit.
 *
 * ⚠️ **TOUT LE FILTRAGE EST LOCAL, sur les lignes DÉJÀ chargées.** C'est la
 * règle du tableau de bord : « la page reçoit déjà toutes les factures ; une
 * requête par frappe coûterait bien plus que le tri local ». Ici la page reçoit
 * déjà les 400 lignes les plus récentes — aucun aller-retour n'est ajouté, et
 * changer un filtre est instantané même sur réseau lent.
 *
 * ⚠️ **L'ÉTAT VIT DANS LE COMPOSANT, PAS DANS L'URL.** Le porter en `?page=`
 * imposerait `useSearchParams`, donc une frontière `<Suspense>` : `/admin` ne
 * serait plus rendu qu'après hydratation. Même arbitrage que le tableau de
 * bord, et pour la même audience.
 */

/** Dix lignes par page : une hauteur d'écran, y compris sur téléphone. */
const PAR_PAGE = 10;

const ENTITES: Record<string, string> = {
  company: 'Entreprise',
  client: 'Client',
  invoice: 'Facture',
  quote: 'Devis',
  // Écrit par `admin_set_plan` (0022) : c'est la trace d'un octroi de formule.
  subscription: 'Abonnement',
};

const ACTIONS: Record<string, { label: string; ton: Ton }> = {
  created: { label: 'Créé', ton: 'vert' },
  updated: { label: 'Modifié', ton: 'neutre' },
  status_changed: { label: 'Statut changé', ton: 'ambre' },
  deleted: { label: 'Supprimé', ton: 'rouge' },
};

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

/**
 * Noms des canaux d'encaissement, pour le journal.
 *
 * ⚠️ **RECOPIÉS DE `plan-granter.tsx` À DESSEIN, et c'est un choix, pas un
 * oubli.** Les importer tirerait un composant de dialogue dans ce module pour
 * quatre libellés. La liste fermée vit en base (contrainte `check` de 0023) ;
 * si elle change, ces deux endroits changent — et le repli `?? d.channel`
 * garantit qu'un canal inconnu s'affiche brut plutôt que de disparaître.
 */
const CANAUX_JOURNAL: Record<string, string> = {
  mtn_momo: 'MTN Mobile Money',
  orange_money: 'Orange Money',
  bank: 'Virement bancaire',
  cash: 'Espèces',
  autre: 'Autre',
};

/** Résumé lisible d'une ligne de journal, à partir de son `details` jsonb. */
function resume(row: AdminActivityRow): string {
  const d = row.details ?? {};
  const numero = typeof d.number === 'string' ? d.number : null;
  const nom = typeof d.name === 'string' ? d.name : null;

  // ⚠️ **L'ABONNEMENT SE LIT AUTREMENT, et sans ce cas la ligne dirait « Sans
  // numéro · discovery → pro ».** Un octroi n'a pas de numéro de document, et
  // les codes bruts ne sont pas des mots d'interface : on rend les noms
  // commerciaux et la date de fin, qui sont ce qu'on vient vérifier.
  if (row.entity === 'subscription') {
    /*
      ⚠️ **UN VERSEMENT N'EST PAS UN CHANGEMENT DE FORMULE, et le confondre
      effaçait la trace de l'argent — corrigé le 23 oct. 2026.** La migration
      0023 écrit elle aussi `entity = 'subscription'`, mais ses `details`
      portent `{ payment, amount, channel, reference, plan }` : **ni
      `previous_status`, ni `status`**. La branche ci-dessous les lisait quand
      même, `parsePlan(undefined)` rendait `null`, et **chaque paiement
      enregistré s'affichait « ? → ? »**.

      C'est le journal qui y perdait sa valeur : `subscription_payments` est la
      seule source du chiffre d'affaires réel, et l'écran censé la tracer n'en
      disait rien. On lit donc le drapeau `payment` AVANT tout le reste.
    */
    if (d.payment === true) {
      const montant = typeof d.amount === 'number' ? formatMoney(d.amount) : 'montant inconnu';
      const canal =
        typeof d.channel === 'string' ? (CANAUX_JOURNAL[d.channel] ?? d.channel) : null;
      const ref = typeof d.reference === 'string' ? d.reference : null;
      const formule = parsePlan(d.plan);
      return [
        `Versement ${montant}`,
        formule ? planByCode(formule).name : null,
        canal,
        ref ? `réf. ${ref}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }

    const avant = parsePlan(d.previous_status);
    const apres = parsePlan(d.status);
    const depuis = avant ? planByCode(avant).name : '?';
    const vers = apres ? planByCode(apres).name : '?';
    const fin = typeof d.expires_at === 'string' ? ` jusqu’au ${formatDate(d.expires_at)}` : '';
    return `${depuis} → ${vers}${fin}`;
  }

  if (row.action === 'status_changed') {
    const avant = typeof d.previous_status === 'string' ? d.previous_status : '?';
    const apres = typeof d.status === 'string' ? d.status : '?';
    return `${numero ?? 'Sans numéro'} · ${avant} → ${apres}`;
  }
  return nom ?? numero ?? 'Sans numéro';
}

/**
 * Le JOUR civil d'un instant, à Douala.
 *
 * ⚠️ **INDISPENSABLE POUR COMPARER À UNE PLAGE DE DATES.** `occurred_at` est un
 * `timestamptz` ; les bornes du filtre sont des dates civiles `AAAA-MM-JJ`.
 * Comparer les deux sans conversion ferait tomber un événement de 00h30 à
 * Douala dans la journée de la veille. `en-CA` est choisi parce qu'il rend
 * exactement `AAAA-MM-JJ` — c'est le format, pas la langue, qui compte ici.
 */
function jourDouala(iso: string): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date(iso));
}

/**
 * Les préréglages, en français.
 *
 * ⚠️ **L'ARITHMÉTIQUE VIENT DE `lib/period.ts`, seuls les LIBELLÉS sont ici.**
 * Ce module est éprouvé sur 19 cas — bascule d'année, février bissextile,
 * 31 mars → février. En réécrire les bornes pour cet écran garantirait qu'un
 * jour le journal et le tableau de bord ne découpent plus les mois pareil.
 * `PERIOD_KEYS` n'est pas réutilisé tel quel parce qu'il porte des clés de
 * dictionnaire : `/admin` n'est pas traduit, il est en français en dur.
 */
const PERIODES: { value: PeriodPreset; label: string }[] = [
  { value: 'all', label: 'Toute la période' },
  { value: 'this-month', label: 'Ce mois-ci' },
  { value: 'last-month', label: 'Le mois dernier' },
  { value: 'last-3-months', label: '3 derniers mois' },
  { value: 'this-year', label: 'Cette année' },
  { value: 'custom', label: 'Plage personnalisée' },
];

const TOUTES = '__toutes__';
/** Les lignes dont l'entreprise a été supprimée : elles restent filtrables. */
const SANS_ENTREPRISE = '__sans__';

export function ActivityJournal({
  rows,
  failure,
  total,
  limit,
}: {
  rows: AdminActivityRow[];
  failure: string | null;
  /** Lignes réellement en base. `null` quand le décompte n'a pas abouti. */
  total: number | null;
  /** Le plafond de lecture, pour dire ce que l'écran couvre. */
  limit: number;
}) {
  /*
    ⚠️ **UNE SEULE LECTURE DE LA DATE DU JOUR, figée au montage.** `today()`
    rend la date civile à Douala, identique côté serveur et côté navigateur —
    donc aucune divergence d'hydratation. Mais l'appeler à chaque rendu ferait
    changer les bornes d'un préréglage au passage de minuit, **sous les yeux de
    quelqu'un qui n'a rien touché**.
  */
  const [aujourdhui] = useState(() => today());
  const [action, setAction] = useState<string>(TOUTES);
  const [entreprise, setEntreprise] = useState<string>(TOUTES);
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>(() => ({ from: aujourdhui, to: aujourdhui }));
  const [page, setPage] = useState(1);
  const titreRef = useRef<HTMLDivElement>(null);

  /*
    ⚠️ **CHANGER UN FILTRE REMET À LA PAGE 1, et l'oublier est le piège
    classique.** Sans cela, quelqu'un qui est page 4 et restreint sa recherche
    atterrit sur une page qui n'existe plus : l'écran dit « aucun résultat »
    alors qu'il y en a, et on conclut que le filtre est cassé.
  */
  function filtrer<T>(poser: (valeur: T) => void): (valeur: T) => void {
    return (valeur: T) => {
      poser(valeur);
      setPage(1);
    };
  }

  /*
    ⚠️ **LES OPTIONS VIENNENT DES LIGNES, jamais d'une liste figée.** §6.1 :
    pas de contrôle mort. Proposer « Devis » quand le journal n'en porte aucun
    offrirait un filtre qui ne peut que rendre zéro — et on chercherait le
    défaut dans le produit.
  */
  const optionsAction = useMemo(() => {
    const vues = [...new Set(rows.map((r) => r.action))].sort();
    return [
      { value: TOUTES, label: 'Toutes les actions' },
      ...vues.map((a) => ({ value: a, label: ACTIONS[a]?.label ?? a })),
    ];
  }, [rows]);

  const optionsEntreprise = useMemo(() => {
    const noms = [...new Set(rows.map((r) => r.companyName).filter((n): n is string => !!n))].sort(
      (a, b) => a.localeCompare(b, 'fr'),
    );
    const orphelines = rows.some((r) => !r.companyName);
    return [
      { value: TOUTES, label: 'Toutes les entreprises' },
      ...noms.map((n) => ({ value: n, label: n })),
      ...(orphelines ? [{ value: SANS_ENTREPRISE, label: 'Entreprise supprimée' }] : []),
    ];
  }, [rows]);

  // Bornes effectives : `null` signifie « aucune restriction de date ».
  const bornes = useMemo(
    () => (preset === 'custom' ? range : resolvePeriod(preset, aujourdhui)),
    [preset, range, aujourdhui],
  );
  const plageInvalide = preset === 'custom' && !isRangeValid(range);

  const filtrees = useMemo(() => {
    // Une plage à l'envers ne filtre rien : on le DIT plutôt que de rendre une
    // liste vide qui se lirait comme « aucune activité ».
    if (plageInvalide) return rows;
    return rows.filter((r) => {
      if (action !== TOUTES && r.action !== action) return false;
      if (entreprise === SANS_ENTREPRISE && r.companyName) return false;
      if (entreprise !== TOUTES && entreprise !== SANS_ENTREPRISE && r.companyName !== entreprise)
        return false;
      if (bornes && !isWithinRange(jourDouala(r.occurredAt), bornes)) return false;
      return true;
    });
  }, [rows, action, entreprise, bornes, plageInvalide]);

  const pages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE));
  /*
    ⚠️ **LA PAGE EST BORNÉE AU RENDU, pas seulement au clic.** `filtrer()` la
    remet à 1, mais les lignes peuvent aussi rétrécir sans qu'on touche un
    filtre — un rechargement après une purge, par exemple. Sans ce `min`,
    l'écran afficherait « Page 4 sur 2 » au-dessus du vide.
  */
  const pageSure = Math.min(page, pages);
  const visibles = filtrees.slice((pageSure - 1) * PAR_PAGE, pageSure * PAR_PAGE);

  const filtreActif = action !== TOUTES || entreprise !== TOUTES || preset !== 'all';

  function allerA(cible: number) {
    setPage(cible);
    /*
      ⚠️ **RAMENER L'EN-TÊTE DANS L'ÉCRAN, sinon la page change sous le doigt.**
      Les boutons sont SOUS la liste : après un clic, on reste au niveau du
      pied et la nouvelle page commence hors de vue. C'est le piège payé sur
      `#commande` le 17 sept. Instantané sous `prefers-reduced-motion` — un
      défilement animé est précisément ce que ce réglage vise.
    */
    const doux = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    titreRef.current?.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'start' });
  }

  function effacer() {
    setAction(TOUTES);
    setEntreprise(TOUTES);
    setPreset('all');
    setPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <div ref={titreRef} className="scroll-mt-20">
          <CardTitle>Journal d’activité</CardTitle>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Alimenté par des déclencheurs en base : rien ne s’y écrit depuis l’application, et rien
            n’y échappe
          </p>
        </div>
      </CardHeader>

      {/*
        ⚠️ **LES FILTRES NE SONT RENDUS QUE S'IL Y A QUELQUE CHOSE À FILTRER.**
        Trois sélecteurs au-dessus d'un journal vide, ou d'une lecture ratée,
        seraient trois contrôles morts (§6.1) — et sur l'écran d'échec ils
        laisseraient croire que c'est un filtre qui cache les lignes.
      */}
      {!failure && rows.length > 0 && (
        <section
          aria-label="Filtres du journal"
          className="space-y-3 border-b border-line px-5 py-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:w-[190px]">
              <label htmlFor="journal-action" className="sr-only">
                Filtrer par action
              </label>
              <Combobox
                id="journal-action"
                value={action}
                onChange={filtrer(setAction)}
                options={optionsAction}
              />
            </div>

            <div className="sm:w-[230px]">
              <label htmlFor="journal-entreprise" className="sr-only">
                Filtrer par entreprise
              </label>
              {/* `searchable` : la liste suit le nombre d'entreprises, qui grandit. */}
              <Combobox
                id="journal-entreprise"
                value={entreprise}
                onChange={filtrer(setEntreprise)}
                options={optionsEntreprise}
                searchable
              />
            </div>

            <div className="sm:w-[190px]">
              <label htmlFor="journal-periode" className="sr-only">
                Filtrer par période
              </label>
              <Combobox
                id="journal-periode"
                value={preset}
                onChange={(v) => filtrer(setPreset)(v as PeriodPreset)}
                options={PERIODES}
              />
            </div>

            {filtreActif && (
              <button
                type="button"
                onClick={effacer}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition-[background-color,border-color,transform] duration-150 ease-out hover:border-line-strong hover:text-ink active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:self-center"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Effacer
              </button>
            )}
          </div>

          {preset === 'custom' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="sm:w-[190px]">
                <label
                  htmlFor="journal-du"
                  className="mb-1.5 block text-[12.5px] font-medium text-ink-2"
                >
                  Du
                </label>
                <DatePicker
                  id="journal-du"
                  today={aujourdhui}
                  value={range.from}
                  onChange={(from) => filtrer(setRange)({ ...range, from })}
                />
              </div>
              <div className="sm:w-[190px]">
                <label
                  htmlFor="journal-au"
                  className="mb-1.5 block text-[12.5px] font-medium text-ink-2"
                >
                  Au
                </label>
                <DatePicker
                  id="journal-au"
                  today={aujourdhui}
                  value={range.to}
                  onChange={(to) => filtrer(setRange)({ ...range, to })}
                />
              </div>
              {plageInvalide && (
                <p role="alert" className="text-[11.5px] font-medium text-status-overdue sm:mt-7">
                  La date de fin précède la date de début : le filtre de période est ignoré.
                </p>
              )}
            </div>
          )}

          {/*
            ⚠️ **CETTE LIGNE DIT CE QUE L'ÉCRAN COUVRE, et elle n'est pas
            décorative.** Le tableau de bord porte la même : « sans quoi des
            totaux partiels se lisent comme ceux de l'entreprise entière ». Ici
            c'est pire — sans elle, un historique plafonné à 400 lignes se lit
            comme l'historique complet, et une recherche de date qui ne trouve
            rien passe pour une absence d'activité.
          */}
          <p className="text-[11.5px] text-ink-3">
            {filtreActif
              ? `${filtrees.length} ligne${filtrees.length > 1 ? 's' : ''} sur ${rows.length}`
              : `${rows.length} ligne${rows.length > 1 ? 's' : ''}`}
            {total !== null && total > rows.length
              ? ` · les ${limit} plus récentes sur ${total} en base`
              : total !== null
                ? ' · tout le journal'
                : ''}
          </p>
        </section>
      )}

      {/*
        ⚠️ **« Journal vide » EST UNE AFFIRMATION : elle ne doit pas servir de
        repli à une lecture ratée.** C'est précisément la phrase qu'affichait
        l'écran quand la requête échouait — on en concluait qu'il ne s'était
        rien passé, alors que rien n'avait été lu.
      */}
      {failure ? (
        <EmptyState
          icon={TriangleAlert}
          title={failure}
          description="Ce n’est pas un journal vide : la base n’a pas répondu. Rechargez la page — si cela persiste, le motif exact est dans le journal du serveur."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Journal vide"
          description="Aucune activité depuis la mise en place du journal. Les événements antérieurs ne sont pas rétroactifs — un déclencheur ne connaît que ce qui se passe après lui."
        />
      ) : filtrees.length === 0 ? (
        /*
          ⚠️ **TROISIÈME ÉTAT VIDE, ET IL EST DISTINCT DES DEUX AUTRES.** Même
          règle que `/factures` : « aucune facture » et « aucun résultat » ne
          disent pas la même chose. Celui-ci ouvre un chemin — élargir ou
          effacer — là où les deux autres n'en ont aucun.
        */
        <EmptyState
          icon={Users}
          title="Aucun résultat"
          description="Aucune ligne ne correspond à ces filtres. Élargissez la période, ou effacez-les pour revoir tout le journal."
        />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {visibles.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                <span className="tabular shrink-0 text-[11.5px] text-ink-3">
                  {formatInstant(row.occurredAt)}
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

          {/*
            ⚠️ **LA NAVIGATION DISPARAÎT QUAND IL N'Y A QU'UNE PAGE.** Deux
            boutons inertes sous dix lignes seraient deux contrôles morts.
          */}
          {pages > 1 && (
            <nav
              aria-label="Pages du journal"
              className="flex items-center justify-between gap-3 border-t border-line px-5 py-3"
            >
              <p className="tabular text-[12.5px] text-ink-2">
                Page {pageSure} sur {pages}
              </p>
              <div className="flex items-center gap-2">
                {/*
                  ⚠️ **DÉSACTIVÉS AUX EXTRÉMITÉS, et NON masqués — l'inverse de
                  la règle du §7.4.** Elle vise les menus de statut, où une
                  transition impossible n'a rien à faire. Ici, masquer
                  « Précédent » sur la première page déplacerait « Suivant »
                  sous le doigt entre deux pages : on cliquerait « Précédent »
                  en voulant avancer. Un bouton éteint dit en plus où l'on est.
                */}
                <button
                  type="button"
                  onClick={() => allerA(pageSure - 1)}
                  disabled={pageSure <= 1}
                  className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition-[background-color,border-color,transform] duration-150 ease-out hover:border-line-strong hover:text-ink active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => allerA(pageSure + 1)}
                  disabled={pageSure >= pages}
                  className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition-[background-color,border-color,transform] duration-150 ease-out hover:border-line-strong hover:text-ink active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </Card>
  );
}
