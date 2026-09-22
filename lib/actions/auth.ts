'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { publicConfig } from '@/lib/supabase/config';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { googleSignInEnabled } from '@/lib/auth-providers';
import { parsePlan } from '@/lib/plans';
import { siteOrigin } from '@/lib/site-origin';
import { translateAuthError } from '@/lib/auth-errors';

/**
 * Le fournisseur externe est-il RÉELLEMENT activé sur le projet Supabase ?
 *
 * `/auth/v1/settings` est publique et ne demande que la clé `anon` : elle rend
 * `{ external: { google: true, … } }`. C'est la source de vérité, là où
 * `XN_AUTH_GOOGLE` n'est qu'un interrupteur d'affichage que rien ne
 * synchronise.
 *
 * ⚠️ **Un échec réseau répond `false`, jamais `true`.** Dans le doute on
 * refuse ici, avec une phrase française et un chemin de repli — plutôt que
 * d'envoyer quelqu'un vers une page d'erreur en anglais hors du site.
 *
 * Le cache de 5 minutes évite un aller-retour à chaque clic : ce réglage
 * change une fois dans la vie du projet, pas toutes les secondes.
 */
async function providerActif(nom: 'google'): Promise<boolean> {
  try {
    const { url, anonKey } = publicConfig();
    const reponse = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      next: { revalidate: 300 },
    });
    if (!reponse.ok) return false;
    const reglages = (await reponse.json()) as { external?: Record<string, boolean> };
    return reglages.external?.[nom] === true;
  } catch {
    return false;
  }
}

/** Chemin interne, ou `null`. Un chemin venu du client ne vaut rien sans ça. */
function cheminInterne(valeur: string | null | undefined): string | null {
  const chemin = valeur?.trim();
  if (!chemin) return null;
  // `//exemple.com` est une URL absolue déguisée : le navigateur la suit
  // jusqu'à un autre domaine. C'est la forme classique de redirection ouverte.
  return chemin.startsWith('/') && !chemin.startsWith('//') ? chemin : null;
}


export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult<undefined>> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) return fail(translateAuthError(error.message));

  // Toute la coquille dépend de la session : on invalide depuis la racine.
  revalidatePath('/', 'layout');
  return ok();
}

/**
 * Ouvre la connexion par compte Google.
 *
 * **Elle ne connecte personne : elle rend l'adresse chez Google**, que le
 * navigateur doit ensuite suivre. C'est volontaire — une Server Action ne peut
 * pas emmener l'utilisateur hors du site, et `redirect()` de Next ne sort pas
 * de l'application.
 *
 * ⚠️ **Le vérificateur PKCE est posé ici, en cookie.** C'est pour cette raison
 * que l'appel se fait côté serveur : `@supabase/ssr` écrit ce cookie par notre
 * adaptateur, et le callback le relira pour échanger le code contre une
 * session. Déclencher la même chose depuis le navigateur poserait le cookie
 * ailleurs, et l'échange échouerait.
 *
 * ⚠️ **Il n'y a pas d'inscription distincte chez un fournisseur externe.** Le
 * premier passage crée le compte ; il arrive donc **sans entreprise**, et
 * `requireSession()` l'emmène sur `/bienvenue` où il la crée. C'est le même
 * chemin que celui d'un compte confirmé par email, il n'y a rien à ajouter.
 */
export async function signInWithGoogle(
  suite?: string | null,
): Promise<ActionResult<{ url: string }>> {
  // Garde-fou : le bouton n'est déjà pas affiché sans la variable, mais une
  // Server Action est une route HTTP — on ne peut pas se fier à l'interface
  // pour savoir ce qui est appelable.
  if (!googleSignInEnabled()) {
    return fail('La connexion avec Google n’est pas disponible pour le moment.');
  }

  // ⚠️ **Le seul contrôle qui compte, et il est mesuré, pas supposé.**
  // `signInWithOAuth` ne contacte personne : elle fabrique l'adresse en local
  // et rend la main. Si le fournisseur n'est pas activé chez Supabase, c'est le
  // NAVIGATEUR qui découvre le refus — et Supabase ne redirige pas, il répond :
  //
  //   {"code":400,"error_code":"validation_failed",
  //    "msg":"Unsupported provider: provider is not enabled"}
  //
  // Constaté en conditions réelles le 22 sept. 2026 : l'utilisateur reste
  // planté sur une URL `supabase.co`, devant du JSON anglais, sans retour
  // possible autre que le bouton « précédent ». `/auth/v1/settings` est
  // publique et dit ce que le projet accepte vraiment : on le demande avant
  // d'envoyer qui que ce soit là-bas.
  if (!(await providerActif('google'))) {
    return fail(
      'La connexion avec Google n’est pas encore active. Utilisez votre email et votre mot de passe.',
    );
  }

  const retour = new URL('/api/auth/confirmation', siteOrigin());
  retour.searchParams.set('suite', cheminInterne(suite) ?? '/dashboard');
  // Sans ce paramètre, un échec renverrait vers « mot de passe oublié » — la
  // destination par défaut du callback, absurde pour quelqu'un qui n'a jamais
  // eu de mot de passe chez nous.
  retour.searchParams.set('retour', '/connexion');

  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: retour.toString(),
      // Le téléphone est souvent partagé ici, et Google réutilise sinon en
      // silence le dernier compte connecté : on finirait par créer une
      // entreprise sous l'identité de quelqu'un d'autre. Cet écran de choix
      // est le seul moment où l'erreur est encore rattrapable.
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error || !data?.url) {
    return fail(
      error ? translateAuthError(error.message) : 'La connexion avec Google n’a pas pu démarrer.',
    );
  }

  return ok({ url: data.url });
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  companyName: string,
  requestedPlan?: string | null,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const supabase = createClient();

  if (password.length < 8) {
    return fail('Le mot de passe doit compter au moins 8 caractères.');
  }
  if (!companyName.trim()) {
    return fail('Le nom de l’entreprise est obligatoire.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });

  if (error) return fail(translateAuthError(error.message));

  // Si la confirmation par email est exigée, il n'y a pas encore de session :
  // l'entreprise sera créée à la première connexion, par /bienvenue.
  if (!data.session) return ok({ needsConfirmation: true });

  const { error: companyError } = await supabase.rpc('create_company_for_current_user', {
    p_name: companyName.trim(),
    p_legal_name: companyName.trim(),
  });

  if (companyError) {
    return fail(`Compte créé, mais l’entreprise n’a pas pu l’être : ${companyError.message}`);
  }

  // La formule choisie sur la grille tarifaire, enregistrée telle qu'elle a été
  // demandée. Elle n'accorde RIEN : tout le monde démarre en Découverte, et
  // seule l'Edge Function de paiement pourra changer `subscriptions.plan`.
  //
  // ⚠️ Un échec ici ne doit pas faire échouer l'inscription. Le compte et
  // l'entreprise existent déjà ; refuser maintenant laisserait l'utilisateur
  // devant une erreur alors que tout ce qui compte a réussi.
  const plan = parsePlan(requestedPlan);
  if (plan) {
    await supabase.rpc('request_plan', { p_plan: plan });
  }

  revalidatePath('/', 'layout');
  return ok({ needsConfirmation: false });
}

/** Crée l'entreprise d'un compte qui n'en a pas encore. Utilisé par /bienvenue. */
export async function createCompany(name: string): Promise<ActionResult<undefined>> {
  const supabase = createClient();

  if (!name.trim()) return fail('Le nom de l’entreprise est obligatoire.');

  const { error } = await supabase.rpc('create_company_for_current_user', {
    p_name: name.trim(),
    p_legal_name: name.trim(),
  });

  if (error) return fail(error.message);

  revalidatePath('/', 'layout');
  return ok();
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/connexion');
}

/**
 * Envoie le lien de réinitialisation.
 *
 * **Le résultat est volontairement le même que l'adresse existe ou non.**
 * Répondre « compte inconnu » transformerait ce formulaire en outil
 * d'énumération : n'importe qui pourrait vérifier si telle personne est
 * cliente. C'est la même règle que pour `signIn`, qui ne dit jamais lequel de
 * l'email ou du mot de passe est faux.
 *
 * Seule exception : la limite de débit, qu'il faut dire — sinon l'utilisateur
 * réessaie en boucle sans jamais rien recevoir.
 */
export async function requestPasswordReset(email: string): Promise<ActionResult<undefined>> {
  const trimmed = email.trim();
  if (!trimmed) return fail('L’adresse email est obligatoire.');

  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: `${siteOrigin()}/api/auth/confirmation?suite=%2Fnouveau-mot-de-passe`,
  });

  if (error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes('rate limit') || normalized.includes('too many')) {
      return fail(translateAuthError(error.message));
    }
    // Tout le reste est avalé : le message affiché reste « si un compte
    // existe, un email est parti ».
  }

  return ok();
}

/**
 * Fixe un nouveau mot de passe pour la session en cours.
 *
 * Elle sert au retour du lien de réinitialisation : le callback a déjà ouvert
 * une session à partir du jeton, donc il n'y a plus qu'à écrire le mot de
 * passe. Sans session, on refuse — c'est le cas d'un lien expiré ou déjà servi.
 */
export async function updatePassword(password: string): Promise<ActionResult<undefined>> {
  if (password.length < 8) {
    return fail('Le mot de passe doit compter au moins 8 caractères.');
  }

  const supabase = createClient();

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return fail('Votre lien a expiré ou a déjà servi. Demandez-en un nouveau.');
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(translateAuthError(error.message));

  revalidatePath('/', 'layout');
  return ok();
}
