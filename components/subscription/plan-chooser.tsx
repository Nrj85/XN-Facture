'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startOrderAction } from '@/lib/actions/subscription';
import {
  PLANS,
  planMonthsFree,
  planByCode,
  priceLabelFor,
  type BillingPeriod,
  type PlanCode,
} from '@/lib/plans';

/**
 * Amène à la carte « Votre commande », et y pose le focus.
 *
 * ⚠️ **Le défilement est instantané quand le système demande moins de
 * mouvement.** Un défilement animé sur toute la hauteur d'une page est
 * exactement ce que `prefers-reduced-motion` vise.
 *
 * ⚠️ **Le focus compte autant que le défilement.** Sans lui, un lecteur
 * d'écran continue d'annoncer la grille : la personne entend que son clic n'a
 * rien produit, et la correction ne vaudrait que pour ceux qui voient.
 */
function allerALaCommande(): boolean {
  const cible = document.getElementById('commande');
  if (!cible) return false;

  const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cible.scrollIntoView({ behavior: sobre ? 'auto' : 'smooth', block: 'start' });
  cible.focus({ preventScroll: true });
  return true;
}

/**
 * Attend que la carte de commande existe, puis y va.
 *
 * ⚠️ **`router.refresh()` ne rend pas de promesse** : au moment où il revient,
 * le serveur n'a encore rien re-rendu et `#commande` n'existe pas. On guette
 * donc son apparition, avec une limite — au-delà, mieux vaut ne rien faire
 * que défiler vers un élément qui ne viendra pas.
 */
async function rejoindreLaCommande(limiteMs = 5000): Promise<void> {
  const debut = Date.now();
  while (Date.now() - debut < limiteMs) {
    if (allerALaCommande()) return;
    await new Promise((r) => setTimeout(r, 80));
  }
}

/**
 * Choix d'une formule, et commande.
 *
 * **Avant, cette grille n'avait aucun bouton** : trois cartes à regarder, et
 * rien pour en prendre une. La fenêtre de plafond y menait, et le parcours
 * s'arrêtait là — exactement le cul-de-sac qu'elle était censée résoudre.
 *
 * ⚠️ **Le montant ne transite pas.** Le bouton n'envoie que la formule et la
 * période ; le prix est recalculé côté serveur à partir de `lib/plans.ts`.
 * Une Server Action est une route HTTP : si le prix venait du navigateur, on
 * se commanderait la formule Pro à 1 FCFA.
 *
 * ⚠️ **Commander n'active rien.** La commande note une intention et rend une
 * référence de règlement. La formule s'ouvre au paiement constaté, et le
 * bouton ne le prétend pas : il dit « Choisir », pas « Payer ».
 */
export function PlanChooser({
  currentPlan,
  pendingPlan,
  pendingPeriod,
}: {
  currentPlan: PlanCode;
  pendingPlan: PlanCode | null;
  pendingPeriod: BillingPeriod | null;
}) {
  const router = useRouter();
  // La période de la commande en cours, s'il y en a une : rouvrir la page ne
  // doit pas proposer « mensuel » à quelqu'un qui a commandé à l'année.
  const [period, setPeriod] = useState<BillingPeriod>(pendingPeriod ?? 'monthly');
  const [enCours, setEnCours] = useState<PlanCode | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pro = planByCode('pro');

  function commander(code: PlanCode) {
    setErreur(null);
    setEnCours(code);
    startTransition(async () => {
      const result = await startOrderAction(code, period);
      setEnCours(null);
      if (!result.ok) {
        setErreur(result.error);
        return;
      }
      // La page relit la commande côté serveur pour afficher la référence et
      // les instructions de règlement.
      router.refresh();
      // ...puis on y emmène l'utilisateur. Sans cela, la commande se crée bien
      // mais s'affiche AU-DESSUS de la grille, hors de l'écran de qui vient de
      // cliquer : il ne voit rien bouger et conclut que le bouton est inerte.
      void rejoindreLaCommande();
    });
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {/* Choix de la périodicité : un seul contrôle pour les trois cartes,
          plutôt que deux boutons par carte. */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-[10px] border border-line bg-sand p-0.5"
          role="group"
          aria-label="Périodicité de facturation"
        >
          {(['monthly', 'yearly'] as const).map((valeur) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={period === valeur}
              onClick={() => setPeriod(valeur)}
              className={`rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
                period === valeur
                  ? 'bg-surface text-ink shadow-card'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              {valeur === 'monthly' ? 'Mensuel' : 'Annuel'}
            </button>
          ))}
        </div>

        {period === 'yearly' && (
          <span className="text-[12.5px] font-medium text-status-paid">
            {planMonthsFree(pro)} mois offerts
          </span>
        )}
      </div>

      {erreur && (
        <p role="alert" className="text-[12.5px] font-medium text-status-overdue">
          {erreur}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const courante = plan.code === currentPlan;
          const commandee = plan.code === pendingPlan && period === pendingPeriod;
          const gratuite = plan.monthlyPrice === 0;

          return (
            <div
              key={plan.code}
              className={`flex flex-col rounded-card border p-4 ${
                courante ? 'border-brand-bright bg-brand-soft' : 'border-line bg-surface'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">{plan.name}</p>
                {courante && (
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-brand-hover">
                    En cours
                  </span>
                )}
              </div>

              <p className="tabular mt-1 text-[13px] font-semibold text-ink-2">
                {priceLabelFor(plan, period)}
              </p>

              <ul className="mt-3 space-y-1.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[12.5px] text-ink-2">
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-paid-dot"
                      strokeWidth={2.6}
                      aria-hidden
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Le bouton vit en bas de carte : `mt-auto` aligne les trois
                  quel que soit le nombre d'avantages listés. */}
              <div className="mt-auto pt-4">
                {gratuite ? (
                  // Pas de bouton sur la formule gratuite : on ne commande pas
                  // ce qu'on a déjà, et un bouton inerte serait un mensonge.
                  <p className="text-[12px] text-ink-3">
                    {courante ? 'C’est votre formule actuelle.' : 'Formule de départ, sans frais.'}
                  </p>
                ) : (
                  /*
                    ⚠️ **Sur la formule déjà commandée, le bouton n'est PLUS
                    désactivé.** Il affichait « Commande en attente » et ne
                    faisait rien : un contrôle mort, proscrit par le §6.1, et
                    la seule chose à l'écran qui répondait au clic. Il mène
                    désormais à la commande — qui se trouve plus haut dans la
                    page, donc invisible d'ici.
                  */
                  <Button
                    size="sm"
                    variant={plan.featured ? 'primary' : 'secondary'}
                    className="w-full gap-2"
                    disabled={pending || courante}
                    onClick={() => (commandee ? allerALaCommande() : commander(plan.code))}
                  >
                    {enCours === plan.code ? (
                      <Loader2
                        className="h-4 w-4 animate-spin motion-reduce:animate-none"
                        aria-hidden
                      />
                    ) : commandee ? (
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    ) : null}
                    {courante
                      ? 'Formule en cours'
                      : commandee
                        ? 'Voir ma commande'
                        : `Choisir ${plan.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
