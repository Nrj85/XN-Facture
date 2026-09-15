'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
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
                  <Button
                    size="sm"
                    variant={plan.featured ? 'primary' : 'secondary'}
                    className="w-full gap-2"
                    disabled={pending || courante || commandee}
                    onClick={() => commander(plan.code)}
                  >
                    {enCours === plan.code && (
                      <Loader2
                        className="h-4 w-4 animate-spin motion-reduce:animate-none"
                        aria-hidden
                      />
                    )}
                    {courante
                      ? 'Formule en cours'
                      : commandee
                        ? 'Commande en attente'
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
