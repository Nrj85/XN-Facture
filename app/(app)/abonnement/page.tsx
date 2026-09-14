import type { Metadata } from 'next';
import { Check, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { requireSession, getSubscription, getSubscriptionPayments } from '@/lib/db/queries';
import { PLANS, planByCode, planPriceLabel } from '@/lib/plans';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';

export const metadata: Metadata = { title: 'Abonnement' };

/**
 * Formule de l'entreprise.
 *
 * ⚠️ **Aucun bouton « Payer » ici, et c'est délibéré.** L'encaissement n'est
 * pas branché : un bouton qui ne fait rien serait un contrôle mort, proscrit
 * par le §6.1 du design système. La page dit l'état réel — quelle formule est
 * active, laquelle a été demandée — et rien de plus. Le bouton viendra avec le
 * prestataire.
 */
export default async function AbonnementPage() {
  const session = await requireSession();
  const [abonnement, paiements] = await Promise.all([
    getSubscription(session.companyId),
    getSubscriptionPayments(session.companyId),
  ]);

  const active = planByCode(abonnement.plan);
  const demandee = abonnement.requested ? planByCode(abonnement.requested) : null;
  const enAttente = demandee !== null && demandee.code !== active.code;

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <p className="label-caps">Compte</p>
        <h1 className="type-display mt-1.5 text-[26px] leading-none sm:text-[32px]">Abonnement</h1>
        <p className="mt-2 text-sm text-ink-2">
          La formule de {session.company.name}, et ce qu’elle ouvre.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Votre formule</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Elle s’applique à toute l’entreprise, pas à un utilisateur.
            </p>
          </div>
        </CardHeader>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="type-display text-[30px] leading-none sm:text-[34px]">
              {active.name}
            </span>
            <span className="tabular text-[13px] font-semibold text-ink-3">
              {planPriceLabel(active)}
            </span>
          </div>

          <p className="text-[13px] text-ink-2">
            {abonnement.expiresAt ? (
              <>
                Valable jusqu’au{' '}
                <span className="tabular font-semibold text-ink">
                  {formatDate(abonnement.expiresAt)}
                </span>
                .
              </>
            ) : (
              <>Sans échéance : la formule Découverte n’expire pas.</>
            )}
          </p>

          {enAttente && demandee && (
            <div className="flex items-start gap-3 rounded-[10px] border border-line bg-sand px-3.5 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                Vous aviez choisi la formule{' '}
                <strong className="font-semibold text-ink">{demandee.name}</strong> à
                l’inscription. Elle n’est pas encore active :{' '}
                <strong className="font-semibold text-ink">
                  le paiement en ligne n’est pas encore ouvert
                </strong>
                . Il s’ouvrira sur cette page, par MTN Mobile Money et Orange Money.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Les formules</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Ce que chacune ouvre. Les prix sont en FCFA, par mois.
            </p>
          </div>
        </CardHeader>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const courante = plan.code === active.code;
            return (
              <div
                key={plan.code}
                className={`rounded-card border p-4 ${
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
                  {planPriceLabel(plan)}
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
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Paiements</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Vos règlements d’abonnement, le plus récent en tête.
            </p>
          </div>
        </CardHeader>

        <div className="p-4 sm:p-5">
          {paiements.length === 0 ? (
            <p className="text-[13px] text-ink-3">
              Aucun paiement enregistré. La formule Découverte est gratuite.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {paiements.map((paiement) => (
                <li key={paiement.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="text-[13.5px]">
                    {planByCode(paiement.plan).name}
                    <span className="ml-2 text-[11.5px] text-ink-3">{paiement.channel}</span>
                  </span>
                  <span className="tabular text-[13.5px] font-semibold">
                    {formatMoney(paiement.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
