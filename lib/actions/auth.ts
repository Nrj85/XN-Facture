'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/actions/result';

/**
 * Actions d'authentification.
 *
 * Les messages d'erreur de Supabase sont en anglais et parfois cryptiques
 * (« Invalid login credentials »). On les traduit, sans jamais préciser si
 * c'est l'email ou le mot de passe qui est faux : le distinguer permettrait
 * d'énumérer les comptes existants.
 */

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Adresse email non confirmée. Consultez votre boîte de réception.';
  }
  if (normalized.includes('user already registered')) {
    return 'Un compte existe déjà avec cette adresse.';
  }
  // Avant le fourre-tout `password` ci-dessous, qui l'attraperait à tort et
  // afficherait « trop court » sur un mot de passe parfaitement long.
  if (normalized.includes('should be different from the old password')) {
    return 'Ce mot de passe est identique à l’ancien. Choisissez-en un autre.';
  }
  if (normalized.includes('same_password')) {
    return 'Ce mot de passe est identique à l’ancien. Choisissez-en un autre.';
  }
  if (
    normalized.includes('token has expired') ||
    normalized.includes('invalid token') ||
    normalized.includes('expired or is invalid')
  ) {
    return 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.';
  }
  if (normalized.includes('password')) {
    return 'Mot de passe trop court : 8 caractères au minimum.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Trop de tentatives. Patientez quelques minutes.';
  }
  if (normalized.includes('is invalid') && normalized.includes('email')) {
    return 'Cette adresse email n’est pas acceptée. Vérifiez-la, ou utilisez une autre adresse.';
  }
  if (normalized.includes('signups not allowed') || normalized.includes('signup is disabled')) {
    return 'Les inscriptions sont désactivées sur ce serveur.';
  }
  // Rien ne doit remonter en anglais : l'interface est entièrement en français,
  // et un message brut de Supabase renseigne l'utilisateur sur l'infrastructure
  // sans lui dire quoi faire. Observé une fois en conditions réelles :
  // « Email address "..." is invalid » s'affichait tel quel sur /inscription.
  return 'La demande n’a pas abouti. Vérifiez vos informations et réessayez.';
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

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  companyName: string,
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
 * Origine publique du site, pour composer le lien de retour des emails.
 *
 * `NEXT_PUBLIC_SITE_URL` prime, parce qu'elle est la seule valeur sûre en
 * production : les en-têtes de la requête sont fournis par le client. Supabase
 * refuse de toute façon toute destination absente de sa liste d'URL autorisées
 * (Authentication > URL Configuration), donc un en-tête falsifié ne détourne
 * rien — mais autant ne pas dépendre de ce dernier rempart.
 */
function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const store = headers();
  const origin = store.get('origin');
  if (origin) return origin;

  const host = store.get('x-forwarded-host') ?? store.get('host') ?? 'localhost:3000';
  const protocol = store.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
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
