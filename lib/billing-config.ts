/**
 * Coordonnées d'encaissement de XN-Facture — les nôtres, pas celles de nos
 * utilisateurs.
 *
 * ⚠️ **À ne pas confondre avec `companies.momo_mtn` / `momo_orange`**, qui sont
 * les numéros de CHAQUE entreprise cliente, imprimés sur ses factures pour que
 * SES clients la règlent. Ceux d'ici servent à encaisser nos abonnements.
 *
 * ⚠️ **Elles viennent de l'environnement, jamais du code.** Un numéro de
 * téléphone vers lequel des gens envoient de l'argent n'a rien à faire dans un
 * dépôt public : une faute de frappe versée mille fois ne se rattrape pas. Les
 * poser sur Vercel suffit, aucun déploiement de code n'est nécessaire pour en
 * changer.
 *
 * Tant qu'aucun n'est renseigné, l'interface enregistre la commande et sa
 * référence, mais **n'affiche aucune instruction de paiement** : mieux vaut
 * dire « nous revenons vers vous » qu'inventer un numéro.
 */

export interface PaymentChannel {
  /** `mtn_momo` ou `orange_money` — repris tel quel dans le journal. */
  code: 'mtn_momo' | 'orange_money';
  label: string;
  number: string;
  /** Nom du titulaire, que l'application mobile affichera à la confirmation. */
  holder: string;
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

/**
 * Les canaux réellement configurés.
 *
 * Fonction et non constante : lue à l'exécution, donc un changement de
 * variable d'environnement s'applique au redémarrage sans recompilation.
 */
export function paymentChannels(): PaymentChannel[] {
  const holder = clean(process.env.XN_PAYMENT_HOLDER) || 'XN-Facture';
  const canaux: PaymentChannel[] = [];

  const mtn = clean(process.env.XN_MOMO_MTN);
  if (mtn) canaux.push({ code: 'mtn_momo', label: 'MTN Mobile Money', number: mtn, holder });

  const orange = clean(process.env.XN_MOMO_ORANGE);
  if (orange)
    canaux.push({ code: 'orange_money', label: 'Orange Money', number: orange, holder });

  return canaux;
}

/** Adresse à laquelle écrire quand aucun canal n'est configuré. */
export function billingContactEmail(): string | null {
  return clean(process.env.XN_BILLING_EMAIL) || null;
}
