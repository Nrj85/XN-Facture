'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { planByCode, planPriceLabel, planYearlyLabel, planMonthsFree } from '@/lib/plans';
import type { ActionResult } from '@/lib/actions/result';

/**
 * Le plafond de formule, annoncé comme une invitation et non comme une panne.
 *
 * **Avant, c'était un bandeau rouge sans issue.** L'utilisateur apprenait que
 * sa formule gratuite était épuisée, au milieu d'un formulaire qu'il venait de
 * remplir, sans le moindre lien vers la suite. Un refus qui n'ouvre aucun
 * chemin est un cul-de-sac : il ne reste qu'à fermer l'onglet.
 *
 * ⚠️ **Un seul exemplaire pour toute l'application.** La modale est montée une
 * fois dans la coquille et pilotée par contexte. Une par écran — formulaire,
 * détail, liste, menu ⋯ du tableau de bord — en aurait monté quatre, avec
 * quatre textes qui auraient divergé au premier ajustement. Même raisonnement
 * que pour la confirmation de suppression, en un exemplaire dans la liste.
 *
 * ⚠️ **Elle ne décide rien.** Ce qui refuse réellement la facture est le
 * déclencheur `invoices_quota`, dans la base. Cette fenêtre ne fait que
 * traduire un refus déjà prononcé — la fermer ne débloque rien.
 */

interface PlanLimitContextValue {
  /**
   * Prend un `ActionResult` et ouvre la fenêtre si l'échec est un plafond.
   * Rend `true` dans ce cas, pour que l'appelant sache qu'il n'a pas à
   * afficher son bandeau d'erreur habituel par-dessus.
   */
  report: (result: ActionResult<unknown>) => boolean;
}

const PlanLimitContext = createContext<PlanLimitContextValue | null>(null);

export function usePlanLimit(): PlanLimitContextValue {
  const value = useContext(PlanLimitContext);
  // Un repli silencieux plutôt qu'une exception : si un composant est un jour
  // rendu hors de la coquille, l'erreur doit rester affichable par son bandeau
  // habituel, pas faire planter l'écran.
  return value ?? { report: () => false };
}

export function PlanLimitProvider({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const report = useCallback((result: ActionResult<unknown>) => {
    if (result.ok || result.reason !== 'plan-limit') return false;
    setMessage(result.error);
    setOuvert(true);
    return true;
  }, []);

  const value = useMemo(() => ({ report }), [report]);

  const gratuite = planByCode('discovery');
  const pro = planByCode('pro');

  return (
    <PlanLimitContext.Provider value={value}>
      {children}

      <Dialog
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Vous avez atteint le plafond de votre formule"
        /*
          ⚠️ **Le chiffre ne figure PAS ici.** Le plafond qui fait foi est celui
          du déclencheur `invoices_quota`, dans la base ; le répéter depuis
          `lib/plans.ts` créerait une seconde source, et le jour où l'une des
          deux bougerait, la fenêtre annoncerait un plafond que la base
          n'applique pas. Le nombre exact arrive dans `message`, ci-dessous.
        */
        description={`La formule ${gratuite.name} limite le nombre de factures que vous pouvez émettre chaque mois.`}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOuvert(false)}>
              Plus tard
            </Button>
            {/*
              La fenêtre DOIT mener quelque part : c'est tout ce qui la
              distingue du bandeau rouge qu'elle remplace. `/abonnement` porte
              les formules et dira honnêtement où en est le paiement.
            */}
            <Link
              href="/abonnement"
              onClick={() => setOuvert(false)}
              className={buttonClasses({ className: 'group gap-2' })}
            >
              Voir les formules
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Le texte de la base, qui porte le plafond exact. C'est la règle
              telle qu'elle est réellement appliquée, pas une paraphrase. */}
          {message && <p className="text-[13px] leading-relaxed text-ink">{message}</p>}

          <p className="text-[13px] leading-relaxed text-ink-2">
            Rien n’est perdu, et rien n’est fermé : vos factures restent consultables et
            téléchargeables en PDF, vos <strong className="font-semibold text-ink">brouillons</strong>{' '}
            et vos <strong className="font-semibold text-ink">devis</strong> restent illimités.
            Seul l’envoi d’une nouvelle facture attend le mois prochain — ou la formule{' '}
            {pro.name}.
          </p>

          <div className="rounded-[10px] border border-line bg-sand p-4">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-brand-hover" aria-hidden />
                {pro.name}
              </span>
              <span className="tabular text-[13px] font-semibold text-ink-2">
                {planPriceLabel(pro)}
              </span>
            </div>

            {planYearlyLabel(pro) && (
              <p className="mt-0.5 text-[11.5px] text-ink-3">
                ou <span className="tabular">{planYearlyLabel(pro)}</span> —{' '}
                {planMonthsFree(pro)} mois offerts
              </p>
            )}

            <ul className="mt-3 space-y-1.5">
              {pro.features.map((feature) => (
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
          </div>

        </div>
      </Dialog>
    </PlanLimitContext.Provider>
  );
}
