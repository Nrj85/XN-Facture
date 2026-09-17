'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, ExternalLink, Loader2, Smartphone, X } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cancelOrderAction } from '@/lib/actions/subscription';
import { planByCode, priceFor, type BillingPeriod, type PlanCode } from '@/lib/plans';
import { formatMoney } from '@/lib/money';
import type { PaymentChannel } from '@/lib/billing-config';
import type { PaymentLinks } from '@/lib/payments/tara';

/**
 * Copie une valeur dans le presse-papiers.
 *
 * ⚠️ **C'est la seule action réellement disponible à ce stade, et elle n'est
 * pas cosmétique.** Le règlement se fait dans une AUTRE application — celle de
 * l'opérateur mobile — où il faut retaper un numéro de neuf chiffres et une
 * référence. Chaque caractère retapé est une occasion de se tromper de
 * destinataire, et une somme envoyée au mauvais numéro ne se rattrape pas.
 *
 * ⚠️ **Un bouton « Payer » serait un mensonge tant qu'aucun lien de paiement
 * n'est branché.** Le §6.1 proscrit les contrôles morts : mieux vaut une
 * action modeste qui marche qu'un bouton qui prétend débiter.
 *
 * L'API du presse-papiers exige un contexte sécurisé et peut être refusée par
 * le navigateur : l'échec est donc dit à l'écran, jamais avalé.
 */
function Copier({ valeur, quoi }: { valeur: string; quoi: string }) {
  const [etat, setEtat] = useState<'repos' | 'copie' | 'echec'>('repos');
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current);
  }, []);

  async function copier() {
    if (minuteur.current) clearTimeout(minuteur.current);
    try {
      await navigator.clipboard.writeText(valeur);
      setEtat('copie');
    } catch {
      setEtat('echec');
    }
    minuteur.current = setTimeout(() => setEtat('repos'), 2400);
  }

  return (
    <button
      type="button"
      onClick={() => void copier()}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink-2 transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-line-strong hover:bg-sand hover:text-ink active:scale-[0.97] active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {etat === 'copie' ? (
        <Check className="h-3.5 w-3.5 text-status-paid-dot" strokeWidth={2.6} aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
      )}
      {etat === 'copie' ? 'Copié' : etat === 'echec' ? 'Copie refusée' : 'Copier'}
      {/* Le changement de libellé doit être ANNONCÉ, pas seulement vu. */}
      <span className="sr-only" aria-live="polite">
        {etat === 'copie'
          ? `${quoi} copié dans le presse-papiers`
          : etat === 'echec'
            ? `Le navigateur a refusé la copie. ${quoi} : ${valeur}`
            : ''}
      </span>
      <span className="sr-only">{quoi}</span>
    </button>
  );
}

/** Les canaux secondaires, dans l'ordre d'utilité au Cameroun. */
const AUTRES_CANAUX = [
  { cle: 'whatsapp', libelle: 'WhatsApp' },
  { cle: 'sms', libelle: 'SMS' },
  { cle: 'card', libelle: 'Carte bancaire' },
  { cle: 'dikalo', libelle: 'Dikalo' },
  { cle: 'telegram', libelle: 'Telegram' },
] as const;

/**
 * La commande en attente de règlement.
 *
 * ⚠️ **Le montant est recalculé ici**, à partir de `lib/plans.ts` et de la
 * formule commandée. La commande n'en stocke aucun : un prix figé en base
 * deviendrait une seconde vérité, et la caisse finirait par réclamer ce que la
 * grille tarifaire n'annonce plus.
 *
 * ⚠️ **Sans canal configuré, aucune instruction de paiement n'est affichée.**
 * Inventer un numéro vers lequel des gens enverraient de l'argent serait la
 * pire erreur possible de cet écran : une somme versée à un mauvais numéro ne
 * se rattrape pas. Voir `lib/billing-config.ts`.
 */
export function OrderSummary({
  plan,
  period,
  reference,
  links,
  channels,
  contactEmail,
}: {
  plan: PlanCode;
  period: BillingPeriod;
  reference: string;
  links: PaymentLinks | null;
  channels: PaymentChannel[];
  contactEmail: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const formule = planByCode(plan);
  const montant = priceFor(formule, period);

  function annuler() {
    setErreur(null);
    startTransition(async () => {
      const result = await cancelOrderAction();
      if (!result.ok) {
        setErreur(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Votre commande</CardTitle>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            En attente de règlement. Votre formule s’ouvrira dès réception.
          </p>
        </div>
      </CardHeader>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="type-display text-[30px] leading-none sm:text-[34px]">
            {formule.name}
          </span>
          {montant !== null && (
            <span className="tabular text-[13px] font-semibold text-ink-2">
              {formatMoney(montant)} — {period === 'yearly' ? 'pour un an' : 'pour un mois'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-sand px-4 py-3">
          <div className="min-w-0">
            <p className="label-caps">Référence à rappeler</p>
            {/* Hexadécimale en majuscules : aucun O ni I à confondre avec 0 ou 1
                quand on la recopie sur un téléphone. */}
            <p className="tabular mt-1 text-[20px] font-bold tracking-[0.06em] text-ink">
              {reference}
            </p>
          </div>
          <Copier valeur={reference} quoi="Référence de commande" />
        </div>

        {links ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2">
              Réglez {montant !== null ? <strong className="font-semibold text-ink">{formatMoney(montant)}</strong> : 'votre abonnement'}{' '}
              par le canal qui vous arrange. La référence est déjà attachée au lien.
            </p>

            {/*
              ⚠️ Ces adresses viennent d'une API tierce et finissent dans un
              `href`. Elles ont été filtrées par schéma à l'écriture ET à la
              relecture (`lib/payments/tara.ts`) : un `javascript:` renvoyé par
              un serveur détourné s'exécuterait au clic.

              `rel="noreferrer"` en plus de `noopener` : l'adresse de retour
              porte la référence de commande, inutile de la transmettre au
              site de destination.
            */}
            {links.general && (
              <a
                href={links.general}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ className: 'w-full gap-2' })}
              >
                Payer maintenant
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}

            <div className="flex flex-wrap gap-2">
              {AUTRES_CANAUX.map(({ cle, libelle }) => {
                const href = links[cle];
                if (!href) return null;
                return (
                  <a
                    key={cle}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    {libelle}
                  </a>
                );
              })}
            </div>

            <p className="text-[12px] leading-relaxed text-ink-3">
              Votre formule s’ouvrira une fois le règlement constaté. Gardez cette page sous la
              main : elle suit l’état de votre commande.
            </p>
          </div>
        ) : channels.length > 0 ? (
          <div className="space-y-3">
            {/*
              ⚠️ **Une marche à suivre NUMÉROTÉE, pas un paragraphe.** Le
              règlement se termine dans une autre application : l'écran doit
              dire quoi faire, dans quel ordre, et se laisser suivre pendant
              qu'on manipule son téléphone de l'autre main.
            */}
            <ol className="space-y-2 text-[13px] text-ink-2">
              <li className="flex gap-2.5">
                <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand-deep text-[11.5px] font-bold text-ink-2">
                  1
                </span>
                <span>Copiez le numéro ci-dessous, puis ouvrez votre application Mobile Money.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand-deep text-[11.5px] font-bold text-ink-2">
                  2
                </span>
                <span>
                  Envoyez{' '}
                  {montant !== null ? (
                    <strong className="font-semibold text-ink">{formatMoney(montant)}</strong>
                  ) : (
                    'le montant'
                  )}{' '}
                  à ce numéro.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand-deep text-[11.5px] font-bold text-ink-2">
                  3
                </span>
                <span>
                  Indiquez la référence{' '}
                  <strong className="tabular font-semibold text-ink">{reference}</strong> en motif
                  du transfert — c’est elle qui rattache votre paiement à votre compte.
                </span>
              </li>
            </ol>

            <ul className="space-y-2">
              {channels.map((canal) => (
                <li
                  key={canal.code}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-3"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-hover"
                    aria-hidden
                  >
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-ink-3">{canal.label}</span>
                    <span className="tabular block text-[15px] font-semibold text-ink">
                      {canal.number}
                    </span>
                    <span className="block text-[11.5px] text-ink-3">{canal.holder}</span>
                  </span>
                  <Copier valeur={canal.number} quoi={`Numéro ${canal.label}`} />
                </li>
              ))}
            </ul>

            <p className="text-[12px] leading-relaxed text-ink-3">
              Le règlement est vérifié à la main : comptez quelques heures ouvrées. Vous n’avez
              rien d’autre à faire, votre formule s’activera toute seule une fois le paiement
              constaté.
            </p>
          </div>
        ) : (
          /*
            Aucun canal configuré : on dit ce qui va se passer, et rien de plus.
            Un faux numéro serait bien pire qu'une absence d'instructions.
          */
          <p className="text-[13px] leading-relaxed text-ink-2">
            Votre commande est enregistrée. Les coordonnées de règlement ne sont pas encore
            publiées&nbsp;: nous revenons vers vous avec la marche à suivre
            {contactEmail ? (
              <>
                , ou écrivez-nous à{' '}
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Abonnement ${formule.name} — ${reference}`)}`}
                  className="font-semibold text-brand-hover hover:underline"
                >
                  {contactEmail}
                </a>{' '}
                en rappelant votre référence
              </>
            ) : null}
            .
          </p>
        )}

        {erreur && (
          <p role="alert" className="text-[12.5px] font-medium text-status-overdue">
            {erreur}
          </p>
        )}

        {/*
          ⚠️ **`secondary` et non `ghost`.** En `ghost`, l'annulation n'avait ni
          bordure ni fond : elle se lisait comme une phrase, et rien ne disait
          qu'on pouvait cliquer dessus — remonté par l'utilisateur. Elle porte
          donc désormais une vraie surface de bouton.

          Elle reste `secondary` et non primaire : ce n'est pas l'action qu'on
          attend de cet écran, seulement celle dont il ne faut pas priver. Et
          pas de ton `danger` : rien n'est détruit, la commande se repasse d'un
          clic.

          Un filet la sépare de la marche à suivre : un bouton d'annulation
          collé aux instructions de paiement se cliquerait par erreur.
        */}
        <div className="border-t border-line pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={annuler}
            disabled={pending}
            className="gap-2"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <X className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            )}
            Annuler cette commande
          </Button>
        </div>
      </div>
    </Card>
  );
}
