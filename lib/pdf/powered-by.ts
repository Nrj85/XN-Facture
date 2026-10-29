import { getSubscription } from '@/lib/db/queries';
import { effectivePlan } from '@/lib/plans';
import { today } from '@/lib/today';

/**
 * Le document doit-il porter la mention « Document créé avec XN-Facture » ?
 *
 * Décision de l'utilisateur du 29 oct. 2026 : une mention discrète en pied des
 * factures et des devis **de la formule Découverte**, retirée en Pro et en
 * Entreprise. C'est le seul canal d'acquisition qui grandit avec l'usage —
 * chaque document envoyé arrive chez un autre professionnel.
 *
 * ⚠️ **LA FORMULE PASSE PAR `effectivePlan()`** : un abonnement payé mais
 * expiré redescend en Découverte, et la mention revient avec lui — exactement
 * comme le plafond de factures.
 *
 * ⚠️ **UNE LECTURE RATÉE NE POSE PAS LA MENTION.** `getSubscription` replie un
 * échec sur Découverte avec `readFailed` ; s'y fier aurait imprimé notre
 * publicité sur la facture d'un client PAYANT pour une requête qui n'a pas
 * abouti. Entre une mention oubliée sur un compte gratuit et une mention
 * imposée à un abonné, la première erreur est la seule acceptable.
 */
export async function showPoweredBy(companyId: string): Promise<boolean> {
  const abonnement = await getSubscription(companyId);
  if (abonnement.readFailed) return false;
  return effectivePlan(abonnement.plan, abonnement.expiresAt, today()) === 'discovery';
}
