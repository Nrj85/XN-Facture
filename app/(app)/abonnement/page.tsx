import type { Metadata } from 'next';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { PlanChooser } from '@/components/subscription/plan-chooser';
import { OrderSummary } from '@/components/subscription/order-summary';
import {
  requireSession,
  getSubscription,
  getSubscriptionPayments,
  getInvoiceQuota,
  getPendingOrder,
} from '@/lib/db/queries';
import { planByCode, planPriceLabel, effectivePlan } from '@/lib/plans';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { today } from '@/lib/today';
import { paymentChannels, billingContactEmail } from '@/lib/billing-config';

export const metadata: Metadata = { title: 'Abonnement' };

/**
 * Formule de l'entreprise.
 *
 * ⚠️ **On commande ici, on ne paie pas ici.** Le bouton « Choisir » enregistre
 * une commande et rend une référence de règlement ; la formule s'ouvre au
 * paiement constaté, à la main aujourd'hui. Aucun débit automatique : aucun
 * agrégateur n'est branché, et un bouton qui prétendrait débiter serait un
 * contrôle mort, proscrit par le §6.1.
 */
export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: { commande?: string | string[] };
}) {
  const session = await requireSession();

  // Retour depuis le prestataire de paiement (`returnUrl`). On ne CONCLUT
  // rien : revenir sur cette page ne prouve pas que le règlement a abouti, et
  // annoncer un succès non constaté serait un mensonge que la formule
  // toujours fermée démentirait aussitôt.
  const retourBrut = Array.isArray(searchParams.commande)
    ? searchParams.commande[0]
    : searchParams.commande;
  const [abonnement, paiements, commande] = await Promise.all([
    getSubscription(session.companyId),
    getSubscriptionPayments(session.companyId),
    getPendingOrder(session.companyId),
  ]);

  // La formule affichée est celle qui s'applique VRAIMENT : un abonnement payé
  // mais expiré retombe en Découverte, exactement comme le fait le déclencheur
  // `invoices_quota` côté base. Afficher `abonnement.plan` brut ferait lire
  // « Pro » à quelqu'un dont les factures sont déjà refusées.
  const maintenant = today();
  const codeActif = effectivePlan(abonnement.plan, abonnement.expiresAt, maintenant);
  const active = planByCode(codeActif);
  const expiree = codeActif !== abonnement.plan;

  const quota = await getInvoiceQuota(session.companyId, codeActif);


  return (
    <div className="animate-fade-in space-y-5">
      {/* Le retour n'est affiché que s'il correspond à la commande réellement
          en attente : une référence quelconque dans l'URL ne doit rien faire
          apparaître. */}
      {retourBrut && commande && retourBrut === commande.reference && (
        <p
          role="status"
          className="rounded-[10px] border border-line bg-sand px-4 py-3 text-[13px] leading-relaxed text-ink-2"
        >
          Merci — nous avons bien noté votre passage par le paiement. Votre formule s’ouvrira
          dès que le règlement sera constaté ; cette page suit l’état de votre commande.
        </p>
      )}

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
            {expiree && abonnement.expiresAt ? (
              <>
                Votre formule {planByCode(abonnement.plan).name} a expiré le{' '}
                <span className="tabular font-semibold text-ink">
                  {formatDate(abonnement.expiresAt)}
                </span>
                . Vous êtes revenu en Découverte — vos factures et vos devis restent
                consultables et exportables.
              </>
            ) : abonnement.expiresAt ? (
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

          {/* Le quota AVANT d'avoir rempli un formulaire pour rien. Ce compte
              n'est qu'un affichage : c'est la base qui refuse réellement. */}
          {quota.limit !== null && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink-2">Factures émises ce mois-ci</span>
                <span className="tabular text-[13px] font-semibold">
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-deep">
                <div
                  className={`h-full rounded-full ${
                    quota.remaining === 0 ? 'bg-status-overdue-dot' : 'bg-brand-bright'
                  }`}
                  style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
                />
              </div>
              <p className="text-[12px] text-ink-3">
                {quota.remaining === 0 ? (
                  <>
                    Plafond atteint. Vos brouillons et vos devis restent illimités ; l’envoi
                    d’une nouvelle facture reprendra le mois prochain.
                  </>
                ) : (
                  <>
                    Il vous reste{' '}
                    <span className="tabular font-semibold text-ink-2">{quota.remaining}</span>{' '}
                    facture{quota.remaining !== null && quota.remaining > 1 ? 's' : ''} à
                    émettre. Les brouillons et les devis ne comptent pas.
                  </>
                )}
              </p>
            </div>
          )}

        </div>
      </Card>

      {/*
        La commande passe AVANT la grille : quand il y en a une, c'est
        l'information la plus utile de la page — la référence à rappeler dans
        son règlement.
      */}
      {commande && (
        <OrderSummary
          plan={commande.plan}
          period={commande.period}
          reference={commande.reference}
          links={commande.links}
          channels={paymentChannels()}
          contactEmail={billingContactEmail()}
        />
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Les formules</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Choisissez la vôtre. Les prix sont en FCFA, sans engagement de durée.
            </p>
          </div>
        </CardHeader>

        {/*
          La grille est un composant CLIENT : elle porte le choix mensuel /
          annuel et les boutons de commande. La page reste serveur pour tout
          le reste — formule en cours, quota, commande, journal.
        */}
        <PlanChooser
          currentPlan={codeActif}
          pendingPlan={commande?.plan ?? null}
          pendingPeriod={commande?.period ?? null}
        />
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
