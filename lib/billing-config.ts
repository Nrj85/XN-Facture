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

// --- Notification de paiement ------------------------------------------------

/**
 * Le secret qui garde la route de notification.
 *
 * ⚠️ **Pourquoi il est dans l'URL et non dans un en-tête.** La documentation
 * de Tara ne décrit aucune signature : rien ne prouve qu'un appel vient bien
 * d'eux. L'URL du webhook devient donc un sésame — quiconque la devine
 * pourrait annoncer un faux paiement. Comme c'est NOUS qui la fournissons à
 * chaque lien, y glisser un segment imprévisible la rend indevinable.
 *
 * Ce n'est pas l'équivalent d'une signature, et ça ne prétend pas l'être :
 * c'est ce qu'on peut faire sans la coopération du prestataire. Le vrai
 * correctif reste de leur demander une signature ou un point de vérification.
 */
export function webhookSecret(): string | null {
  const secret = clean(process.env.TARA_WEBHOOK_SECRET);
  // Un secret court ne protège rien : mieux vaut pas de webhook du tout qu'un
  // webhook gardé par six caractères.
  return secret.length >= 24 ? secret : null;
}

/** L'adresse à donner au prestataire, ou `null` si le secret n'est pas posé. */
export function webhookUrl(origin: string): string | null {
  const secret = webhookSecret();
  return secret ? `${origin.replace(/\/+$/, '')}/api/paiements/tara/${secret}` : null;
}
