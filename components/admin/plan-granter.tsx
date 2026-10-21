'use client';

import { useEffect, useState, useTransition } from 'react';
import { CircleAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { grantPlanAction } from '@/lib/actions/subscription';
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
  }, [company]);

  if (!company) return null;

  const gratuit = plan === 'discovery';
  const actuelle = planByCode(company.plan);
  const prolonge = company.plan === plan && company.expiresAt !== null && !company.expired;

  const valider = () => {
    setErreur(null);
    startTransition(async () => {
      const r = await grantPlanAction(company.id, plan, Number(mois));
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      // ⚠️ On annonce l'échéance **rendue par la base**, jamais celle qu'on
      // aurait recalculée ici. La règle « prolonger ou repartir » vit dans
      // 0022 : la refaire à l'écran produirait un jour une date affichée qui
      // n'est pas celle qui est enregistrée.
      setFait(
        r.data.expiresAt
          ? `${planByCode(r.data.plan).name} jusqu’au ${formatDateLong(r.data.expiresAt)}.` +
            (r.data.orderSettled ? ' La commande en attente a été soldée.' : '')
          : 'Formule Découverte rétablie, sans échéance.',
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
            Dire ce que le geste N'EST PAS. Un administrateur qui octroie après
            un virement mobile money pourrait croire que le chiffre d'affaires
            s'en trouve mis à jour : il ne l'est pas, et c'est délibéré —
            `subscription_payments` ne porte que de l'argent constaté.
          */}
          <p className="text-[11.5px] leading-relaxed text-ink-3">
            L’octroi est enregistré au journal d’activité, avec votre compte comme auteur. Il
            n’inscrit <strong className="font-medium text-ink-2">aucun paiement</strong> : le
            chiffre d’affaires reste celui qui a été réellement encaissé.
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
