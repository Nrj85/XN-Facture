import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { planByCode, planPriceLabel, type PlanCode } from '@/lib/plans';

/**
 * Rappel de la formule venue de la grille tarifaire.
 *
 * ⚠️ **Extrait de `sign-up-form.tsx` le 22 sept. 2026, parce qu'il en faut
 * désormais un second sur `/bienvenue`** — c'est là qu'atterrit un compte
 * Google, et c'est là que l'entreprise est réellement créée. Deux copies
 * auraient divergé sur un texte qui parle d'argent.
 *
 * ⚠️ **`plan` n'accorde RIEN.** Il dit seulement ce que la personne est venue
 * chercher. Tout le monde démarre en Découverte, et la formule se gagne par un
 * paiement encaissé — jamais par un paramètre d'URL.
 */
export function ChosenPlan({ plan }: { plan: PlanCode | null }) {
  const choisie = plan ? planByCode(plan) : null;
  if (!choisie) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-[10px] border border-line bg-sand px-3.5 py-3">
      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-hover" aria-hidden />
      <p className="text-[12.5px] leading-relaxed text-ink-2">
        Formule choisie : <strong className="font-semibold text-ink">{choisie.name}</strong>
        {choisie.monthlyPrice > 0 && (
          <>
            {' '}
            — <span className="tabular">{planPriceLabel(choisie)}</span>
          </>
        )}
        .{' '}
        {choisie.monthlyPrice > 0 ? (
          <>Créez d’abord votre compte : le paiement vient ensuite, rien n’est engagé.</>
        ) : (
          <>C’est la formule gratuite, sans engagement.</>
        )}{' '}
        <Link href="/#tarifs" className="font-semibold text-brand-hover hover:underline">
          Changer
        </Link>
      </p>
    </div>
  );
}
