'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/actions/result';

/**
 * Double authentification par code à usage unique (TOTP).
 *
 * **Ce que la double authentification protège, et que rien d'autre ne
 * protégeait.** Le mot de passe est le seul mur du compte : quelqu'un qui le
 * devine, le retrouve dans une fuite ou le lit par-dessus une épaule prend la
 * comptabilité entière — factures, clients, chiffre d'affaires. Le téléphone
 * est ici l'appareil principal et il est souvent partagé ; c'est précisément le
 * contexte où un second facteur compte le plus.
 *
 * ⚠️ **LE FACTEUR EST INUTILE SANS LA GARDE, et ce serait pire que rien.**
 * Supabase émet une session `aal1` après le mot de passe, **même pour un compte
 * qui a un facteur vérifié** : sans contrôle de notre côté, l'utilisateur
 * activerait la double authentification, verrait « activée » à l'écran, et le
 * mot de passe seul continuerait d'ouvrir son compte. Un interrupteur qui
 * n'applique rien tout en affirmant protéger est le contrôle mort du §6.1 dans
 * sa version la plus nuisible : il donne une fausse assurance. La garde vit dans
 * `getSession()` (`lib/db/queries.ts`), **point de passage unique des pages ET
 * des routes d'API**.
 *
 * ⚠️ **TOTP SEULEMENT, pas de SMS.** Le SMS n'est pas un second facteur sérieux
 * — détournement de carte SIM, interception — et il coûte de l'argent par
 * message sur un marché où la marge est mince. TOTP fonctionne hors ligne, ce
 * qui compte sur un réseau intermittent, et n'envoie rien.
 *
 * ⚠️ **UN SEUL FACTEUR PAR COMPTE, délibérément.** Supabase en accepte dix.
 * Plusieurs facteurs demanderaient une liste, des noms, un choix à la
 * connexion — pour un produit où l'on protège un compte, pas une flotte
 * d'appareils. Un second appareil se gère en réactivant la fonction.
 */

const NOM_FACTEUR = 'Application d’authentification';

/** Code à six chiffres, espaces et tirets tolérés à la saisie. */
function codePropre(code: string): string {
  return code.replace(/[\s-]/g, '');
}

function codeValide(code: string): boolean {
  return /^[0-9]{6}$/.test(code);
}

/**
 * Traduit les refus de Supabase, qui arrivent en anglais.
 *
 * ⚠️ **Le refus d'un mauvais code ne doit PAS ressembler à une panne.** Le
 * message de Supabase est « Invalid TOTP code entered » ; laissé tel quel, il
 * est en anglais et ne dit pas la cause la plus fréquente, qui n'est pas la
 * faute de frappe mais **l'horloge du téléphone décalée**. Un code TOTP est
 * calculé sur le temps : quelques minutes de dérive et tous les codes sont
 * refusés, indéfiniment, sans que rien ne l'explique.
 */
function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid totp code') || m.includes('invalid code')) {
    return 'Code refusé. Vérifiez les six chiffres affichés à l’instant — et, s’il est refusé plusieurs fois de suite, l’heure de votre téléphone : un code se calcule sur l’horloge.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  }
  if (m.includes('already exists') || m.includes('friendly name')) {
    return 'Un facteur est déjà en cours d’enregistrement. Rechargez la page et reprenez.';
  }
  if (m.includes('not found') || m.includes('no factor')) {
    return 'Aucune application d’authentification n’est enregistrée sur ce compte.';
  }
  return 'L’opération n’a pas abouti. Réessayez.';
}

export type TotpEnrollment = {
  factorId: string;
  /** SVG du QR code, déjà transformé en URL `data:` prête pour un `<img>`. */
  qrCode: string;
  /** Secret en clair, pour une saisie manuelle si le QR ne peut pas être scanné. */
  secret: string;
};

/**
 * Première étape : créer le facteur et rendre de quoi le configurer.
 *
 * ⚠️ **LE FACTEUR EXISTE DÈS CET APPEL, mais il est `unverified` : il ne
 * protège rien et ne bloque rien.** Il ne devient actif qu'après
 * `confirmTotpEnrollment`. C'est ce qui rend l'abandon sans danger — quelqu'un
 * qui ferme l'onglet au milieu ne se retrouve pas enfermé dehors par un facteur
 * qu'il n'a jamais configuré.
 *
 * ⚠️ **On purge les facteurs non vérifiés avant d'en créer un.** Supabase exige
 * un nom unique par facteur : sans ce ménage, un second passage échoue en
 * « already exists » et l'utilisateur ne peut plus rien activer — un cul-de-sac
 * causé par sa propre tentative précédente.
 */
export async function startTotpEnrollment(): Promise<ActionResult<TotpEnrollment>> {
  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('Session expirée. Reconnectez-vous.');

  const facteurs = auth.user.factors ?? [];
  if (facteurs.some((f) => f.status === 'verified')) {
    return fail('La double authentification est déjà active sur ce compte.');
  }

  for (const reste of facteurs.filter((f) => f.status === 'unverified')) {
    await supabase.auth.mfa.unenroll({ factorId: reste.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: NOM_FACTEUR,
  });
  if (error || !data) return fail(traduire(error?.message ?? ''));

  return ok({
    factorId: data.id,
    // `qr_code` est un SVG brut. On le rend consommable par un `<img src>`, ce
    // qui évite un `dangerouslySetInnerHTML` — le dépôt n'en contient aucun, et
    // la politique de sécurité du contenu (`next.config.mjs`) s'appuie sur ce
    // fait. `img-src` admet `data:`, donc cette URL passe.
    qrCode: `data:image/svg+xml;utf8,${encodeURIComponent(data.totp.qr_code)}`,
    secret: data.totp.secret,
  });
}

/**
 * Seconde étape : le code prouve que l'application est bien configurée.
 *
 * ⚠️ **NE JAMAIS ACTIVER SANS CETTE PREUVE.** Marquer le facteur actif sur la
 * seule foi d'un QR affiché enfermerait dehors quiconque a mal scanné : le mot
 * de passe ne suffirait plus, et le code demandé n'existerait nulle part. Le
 * facteur n'est vérifié qu'après un code réellement produit par l'application.
 *
 * `challengeAndVerify` fait le défi et la vérification en un appel — deux
 * appels séparés laissaient un identifiant de défi à transporter, pour rien.
 */
export async function confirmTotpEnrollment(
  factorId: string,
  code: string,
): Promise<ActionResult<undefined>> {
  const propre = codePropre(code);
  if (!codeValide(propre)) return fail('Saisissez les six chiffres affichés par l’application.');

  const supabase = createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: propre });
  if (error) return fail(traduire(error.message));

  // La vérification élève la session en `aal2` : sans cette invalidation, la
  // coquille garderait l'état d'avant et afficherait encore « non activée ».
  revalidatePath('/', 'layout');
  return ok();
}

/**
 * Franchir la garde : le code demandé après le mot de passe.
 *
 * ⚠️ **Le facteur n'est PAS choisi par le client.** On le relit sur le compte,
 * côté serveur. Accepter un `factorId` venu du navigateur laisserait présenter
 * l'identifiant d'un facteur non vérifié — que l'attaquant vient d'enregistrer
 * — pour satisfaire une garde avec un facteur qu'il contrôle.
 */
export async function verifyTotpChallenge(code: string): Promise<ActionResult<undefined>> {
  const propre = codePropre(code);
  if (!codeValide(propre)) return fail('Saisissez les six chiffres affichés par l’application.');

  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('Session expirée. Reconnectez-vous.');

  const facteur = (auth.user.factors ?? []).find(
    (f) => f.status === 'verified' && f.factor_type === 'totp',
  );
  if (!facteur) return fail('Aucune application d’authentification n’est enregistrée sur ce compte.');

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: facteur.id,
    code: propre,
  });
  if (error) return fail(traduire(error.message));

  revalidatePath('/', 'layout');
  return ok();
}

/**
 * Désactiver la double authentification.
 *
 * ⚠️ **UN CODE VALIDE EST EXIGÉ, PAS LE MOT DE PASSE — et le choix est
 * réfléchi.** Désactiver est précisément ce que ferait quelqu'un ayant trouvé un
 * navigateur déverrouillé : c'est l'opération à protéger le plus. Le mot de
 * passe aurait été le réflexe, à l'image de `updatePasswordAction`, mais un code
 * vaut mieux ici pour deux raisons : il prouve la **possession de l'appareil**,
 * qui est exactement ce que la fonction protège, et il ne touche pas à la
 * session — vérifier un mot de passe passe par une connexion, donc par une
 * session neuve en `aal1` (voir `createIsolatedClient`).
 *
 * Quelqu'un qui perd son téléphone ne peut donc plus désactiver seul. C'est
 * assumé et c'est le compromis normal de cette fonction ; la sortie passe par
 * la console SQL, comme l'ajout d'un administrateur :
 *
 *     delete from auth.mfa_factors where user_id = '<uuid>';
 */
export async function disableTotp(code: string): Promise<ActionResult<undefined>> {
  const propre = codePropre(code);
  if (!codeValide(propre)) {
    return fail('Saisissez les six chiffres de votre application pour confirmer.');
  }

  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('Session expirée. Reconnectez-vous.');

  const facteur = (auth.user.factors ?? []).find(
    (f) => f.status === 'verified' && f.factor_type === 'totp',
  );
  if (!facteur) return fail('La double authentification n’est pas active sur ce compte.');

  // On vérifie AVANT de retirer : un `unenroll` posé d'abord désactiverait la
  // protection même si le code était faux.
  const { error: refus } = await supabase.auth.mfa.challengeAndVerify({
    factorId: facteur.id,
    code: propre,
  });
  if (refus) return fail(traduire(refus.message));

  const { error } = await supabase.auth.mfa.unenroll({ factorId: facteur.id });
  if (error) return fail(traduire(error.message));

  revalidatePath('/', 'layout');
  return ok();
}
