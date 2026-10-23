'use client';

import { useEffect, useState, useTransition } from 'react';
import { CircleAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { grantPlanAction, type Canal } from '@/lib/actions/subscription';
import { formatDateLong } from '@/lib/format';
import { formatAmount } from '@/lib/money';
import { PLANS, planByCode } from '@/lib/plans';
import type { AdminCompanyRow } from '@/lib/db/admin-queries';

/**
 * Octroi d'une formule à une entreprise, depuis l'espace administrateur.
 *
 * ⚠️ **UN SEUL EXEMPLAIRE, piloté par la ligne sélectionnée.** Une modale par
 * ligne du tableau en monterait autant qu'il y a d'entreprises — c'est la
 * règle déjà appliquée à la confirmation de suppression et au dialogue
 * d'encaissement. Le parent passe `company` à `null` pour fermer.
 *
 * ⚠️ **CET ÉCRAN NE DÉCIDE RIEN.** Le droit d'octroyer vit dans
 * `admin_set_plan()` (migration 0022), dont la garde `is_platform_admin()` est
 * à l'intérieur de la fonction SQL. `subscriptions` n'a toujours aucune
 * politique d'écriture : un `PATCH` REST reste refusé, administrateur compris.
 */

/** Les durées réellement vendues, et rien de plus. */
const DUREES = [
  { value: '1', label: '1 mois' },
  { value: '3', label: '3 mois' },
  { value: '6', label: '6 mois' },
  { value: '12', label: '12 mois', hint: 'Une année complète' },
];

/** Les canaux par lesquels l'argent arrive réellement, ici. */
const CANAUX_LABELS: { value: Canal; label: string; hint?: string }[] = [
  { value: 'mtn_momo', label: 'MTN Mobile Money' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'bank', label: 'Virement bancaire' },
  { value: 'cash', label: 'Espèces' },
  // ⚠️ « Autre » existe pour ne pas forcer un mensonge quand le canal n'est
  // aucun des quatre. Sans lui, on choisirait « virement » au hasard, et le
  // journal des paiements porterait une information fausse.
  { value: 'autre', label: 'Autre', hint: 'Précisez dans la référence' },
];

/**
 * Lit un montant saisi à la main et rend des **francs entiers**, ou `null` si
 * la saisie n'en est pas un.
 *
 * ⚠️ **ELLE REFUSE, ELLE NE CORRIGE PAS — c'est tout son objet.** Le §5 pose
 * que le FCFA n'a pas de centimes : une partie décimale ne peut donc pas être
 * « arrondie pour arranger », elle révèle que la personne n'a pas saisi ce
 * qu'elle croyait. Avaler la virgule multipliait le versement par cent, en
 * silence, dans la seule table qui porte le chiffre d'affaires réel.
 *
 * Les séparateurs de milliers restent acceptés — espace, espace insécable,
 * espace fine insécable (U+202F, celle que `formatAmount` produit), et le
 * point ou la virgule quand ils groupent par TROIS chiffres. Ce qui est
 * refusé, c'est le séparateur suivi d'une ou deux décimales.
 */
export function francsSaisis(saisie: string): number | null {
  const nu = saisie.replace(/[\s  ]/g, '');
  if (nu === '') return null;
  // Chiffres seuls, ou groupes de trois séparés par un point ou une virgule
  // — « 5000 », « 5.000 », « 5,000 ». Toute autre forme est ambiguë.
  if (!/^\d+$/.test(nu) && !/^\d{1,3}([.,]\d{3})+$/.test(nu)) return null;
  const francs = Number(nu.replace(/[.,]/g, ''));
  return Number.isSafeInteger(francs) && francs > 0 ? francs : null;
}

export function PlanGranter({
  company,
  onClose,
}: {
  /** L'entreprise visée, ou `null` quand la fenêtre est fermée. */
  company: AdminCompanyRow | null;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<string>('pro');
  const [mois, setMois] = useState<string>('1');
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Saisie du versement — **repliée par défaut, et facultative**.
   *
   * ⚠️ Un octroi peut suivre un virement, mais aussi un geste commercial, une
   * correction d'erreur ou un essai. La rendre obligatoire forcerait à
   * inventer un montant, ce qui fausserait le chiffre d'affaires — exactement
   * ce que 0022 refusait de faire.
   */
  const [avecPaiement, setAvecPaiement] = useState(false);
  const [montant, setMontant] = useState('');
  const [canal, setCanal] = useState<string>('mtn_momo');
  const [reference, setReference] = useState('');

  // À chaque ouverture on repart de l'état réel de l'entreprise, plutôt que de
  // garder le choix précédent : sans cela, octroyer Pro à une société puis
  // ouvrir la suivante proposerait Pro par défaut, et un clic distrait
  // changerait la formule de quelqu'un qui n'avait rien demandé.
  useEffect(() => {
    if (!company) return;
    setPlan(company.plan === 'discovery' ? 'pro' : company.plan);
    setMois('1');
    setErreur(null);
    setFait(null);
    setAvecPaiement(false);
    setMontant('');
    setCanal('mtn_momo');
    setReference('');
  }, [company]);

  if (!company) return null;

  const gratuit = plan === 'discovery';
  const actuelle = planByCode(company.plan);
  const prolonge = company.plan === plan && company.expiresAt !== null && !company.expired;

  const valider = () => {
    setErreur(null);

    /*
      ⚠️ **UNE VIRGULE ÉTAIT AVALÉE, PAS REFUSÉE — défaut d'argent corrigé le
      23 oct. 2026.** L'ancien code faisait `Number(montant.replace(/[^0-9]/g,
      ''))` : tout ce qui n'était pas un chiffre disparaissait, donc

          « 5000,50 »  ->  500050 FCFA        cent fois trop
          « 5000.50 »  ->  500050 FCFA

      — et rien à l'écran ne le signalait. Le §5 est pourtant formel : **le
      FCFA n'a pas de centimes**, donc une partie décimale n'est pas une
      imprécision à corriger en silence, c'est une saisie qu'il faut REFUSER.
      Les séparateurs de milliers, eux, restent acceptés : « 5 000 » et
      « 5.000 » veulent dire la même chose et ne sont jamais ambigus.
    */
    /*
      ⚠️ **`!gratuit` EST REPRIS ICI, ET CE N'EST PAS UN DOUBLON DE
      L'AFFICHAGE.** La réinitialisation ne s'exécute qu'au changement
      d'ENTREPRISE (`[company]`), pas au changement de formule : cocher le
      versement sur Pro puis basculer sur Découverte laissait `avecPaiement`
      à `true`, et le versement partait quand même — en regard d'un abonnement
      gratuit. Masquer le panneau ne suffit donc pas ; c'est la validation qui
      tranche.
    */
    const saisiePaiement = avecPaiement && !gratuit;

    const montantFrancs = saisiePaiement ? francsSaisis(montant) : null;
    if (saisiePaiement && montantFrancs === null) {
      setErreur('Saisissez un montant en francs entiers, sans centimes — le FCFA n’en a pas.');
      return;
    }

    startTransition(async () => {
      const r = await grantPlanAction(
        company.id,
        plan,
        Number(mois),
        saisiePaiement
          ? { amount: montantFrancs as number, channel: canal as Canal, reference }
          : null,
      );
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      // ⚠️ On annonce l'échéance **rendue par la base**, jamais celle qu'on
      // aurait recalculée ici. La règle « prolonger ou repartir » vit dans
      // 0022 : la refaire à l'écran produirait un jour une date affichée qui
      // n'est pas celle qui est enregistrée.
      const base = r.data.expiresAt
        ? `${planByCode(r.data.plan).name} jusqu’au ${formatDateLong(r.data.expiresAt)}.`
        : 'Formule Découverte rétablie, sans échéance.';
      setFait(
        base +
          (r.data.orderSettled ? ' La commande en attente a été soldée.' : '') +
          (r.data.paymentRecorded ? ' Le versement est inscrit au journal des paiements.' : ''),
      );
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Formule de ${company.name}`}
      description={
        fait
          ? undefined
          : `Actuellement ${actuelle.name}${
              company.expired ? ' — l’abonnement payant a expiré' : ''
            }.`
      }
      className="max-w-md"
      footer={
        fait ? (
          <Button size="sm" onClick={onClose}>
            Fermer
          </Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button size="sm" onClick={valider} disabled={pending}>
              {pending ? 'Enregistrement…' : 'Octroyer'}
            </Button>
          </>
        )
      }
    >
      {fait ? (
        <p className="flex items-start gap-2.5 text-sm text-ink-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-paid" aria-hidden />
          <span>{fait}</span>
        </p>
      ) : (
        <div className="space-y-4">
          <Field label="Formule">
            {(props) => (
              <Combobox
                {...props}
                value={plan}
                onChange={setPlan}
                options={PLANS.map((p) => ({
                  value: p.code,
                  label: p.name,
                  hint:
                    p.monthlyPrice > 0
                      ? `${formatAmount(p.monthlyPrice)} FCFA par mois`
                      : 'Gratuite, plafonnée à 5 factures émises par mois',
                }))}
              />
            )}
          </Field>

          {/*
            ⚠️ **LE CHAMP DE DURÉE DISPARAÎT POUR DÉCOUVERTE** — il ne serait
            pas seulement inutile, il serait MENSONGER : la formule gratuite
            n'a pas d'échéance, et la base ignore la valeur. Un champ grisé
            laisserait croire qu'une durée existe quand même. §6.1 : pas de
            contrôle mort.
          */}
          {!gratuit && (
            <Field
              label="Durée"
              hint={
                prolonge
                  ? `Prolonge l’échéance en cours du ${formatDateLong(
                      company.expiresAt as string,
                    )} — le temps déjà payé n’est pas perdu.`
                  : 'Compte à partir d’aujourd’hui.'
              }
            >
              {(props) => <Combobox {...props} value={mois} onChange={setMois} options={DUREES} />}
            </Field>
          )}

          {gratuit && (
            <p className="flex items-start gap-2.5 rounded-[10px] border border-line bg-sand px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
              <CircleAlert className="mt-px h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              <span>
                L’échéance sera <strong className="font-semibold text-ink">effacée</strong> et
                l’entreprise retrouvera le plafond de{' '}
                <strong className="font-semibold text-ink">cinq factures émises par mois</strong>.
                Rien n’est supprimé : lecture, devis et export PDF restent ouverts.
              </span>
            </p>
          )}

          {/*
            ⚠️ **LA SAISIE DU VERSEMENT EST FACULTATIVE, ET REPLIÉE PAR
            DÉFAUT.** Le chiffre d'affaires ne doit porter que de l'argent
            réellement reçu : c'est l'exploitant qui le déclare, le logiciel ne
            le devine jamais. Un octroi sans versement reste parfaitement
            légitime — geste commercial, correction, essai.

            ⚠️ **ET IL DISPARAÎT POUR DÉCOUVERTE, comme le champ « Durée » —
            corrigé le 23 oct. 2026.** Il s'affichait jusque-là sur la formule
            GRATUITE, ce qui permettait d'inscrire un versement en regard d'un
            abonnement qui ne coûte rien : une contre-vérité dans la seule
            table qui porte le chiffre d'affaires réel, et une fenêtre dont la
            confirmation se contredisait elle-même. C'est le §6.1 — pas de
            contrôle qui promet ce qui n'a pas de sens.
          */}
          {!gratuit && (
          <div className="space-y-3 rounded-[10px] border border-line bg-paper px-3 py-3">
            <Switch
              checked={avecPaiement}
              onCheckedChange={setAvecPaiement}
              label="J’ai reçu un paiement pour cet abonnement"
            />

            {avecPaiement ? (
              <div className="space-y-3">
                <Field label="Montant reçu" hint="En francs entiers — le FCFA n’a pas de centimes.">
                  {(props) => (
                    <Input
                      {...props}
                      numeric
                      inputMode="numeric"
                      placeholder="5000"
                      value={montant}
                      onChange={(e) => setMontant(e.target.value)}
                    />
                  )}
                </Field>

                <Field label="Canal">
                  {(props) => (
                    <Combobox {...props} value={canal} onChange={setCanal} options={CANAUX_LABELS} />
                  )}
                </Field>

                {/*
                  ⚠️ **LA RÉFÉRENCE EST OBLIGATOIRE, et ce n'est pas de la
                  paperasse** : c'est elle qui porte l'idempotence. La base
                  refuse deux versements de même référence — c'est ce qui
                  empêche de créditer deux fois la même transaction.
                */}
                <Field
                  label="Référence du versement"
                  hint="Le numéro de transaction de l’opérateur. C’est lui qui empêche d’enregistrer deux fois le même paiement."
                >
                  {(props) => (
                    <Input
                      {...props}
                      placeholder="MP260921.1430.A12345"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  )}
                </Field>
              </div>
            ) : (
              <p className="text-[11.5px] leading-relaxed text-ink-3">
                Sans cette case, l’octroi n’inscrit{' '}
                <strong className="font-medium text-ink-2">aucun paiement</strong> : le chiffre
                d’affaires ne compte que l’argent réellement encaissé.
              </p>
            )}
          </div>
          )}

          <p className="text-[11.5px] leading-relaxed text-ink-3">
            L’octroi est enregistré au journal d’activité, avec votre compte comme auteur.
          </p>

          {erreur && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[10px] border border-status-overdue-dot bg-status-overdue-bg px-3 py-2.5 text-[12.5px] font-medium text-status-overdue"
            >
              <CircleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <span>{erreur}</span>
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
