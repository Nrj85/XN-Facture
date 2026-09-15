'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { parsePlan } from '@/lib/plans';
import { siteOrigin } from '@/lib/site-origin';
import { translateAuthError } from '@/lib/auth-errors';


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
