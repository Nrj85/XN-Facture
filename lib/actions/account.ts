'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { translateAuthError } from '@/lib/auth-errors';

/**
 * Nom affiché du compte.
 *
 * **Il n'existait aucun moyen de le changer.** `full_name` était écrit une
 * seule fois, à l'inscription (`signUp`), puis relu à chaque session par
 * `getSession()` pour alimenter la barre latérale et le « Bonjour … » du
 * tableau de bord. Une faute de frappe à l'inscription était donc définitive.
 *
 * Le nom vit dans `user_metadata`, pas dans `companies` : c'est celui de la
 * PERSONNE, pas de la structure. Deux associés d'une même entreprise ont deux
 * noms — les confondre aurait fait renommer l'un en renommant l'autre.
 *
 * ⚠️ **`user_metadata` est modifiable par son propriétaire, par construction.**
 * C'est sans conséquence ici : chacun ne peut changer que son propre nom
 * d'affichage, et ce champ ne sert à aucune décision d'autorisation. Il ne
 * faudra jamais y ranger quoi que ce soit qui accorde un droit.
 */
export async function updateDisplayNameAction(name: string): Promise<ActionResult<undefined>> {
  const propre = name.trim().replace(/\s+/g, ' ');

  if (!propre) return fail('Le nom est obligatoire.');
  if (propre.length > 80) return fail('Le nom ne doit pas dépasser 80 caractères.');

  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({ data: { full_name: propre } });
  if (error) return fail('Le nom n’a pas pu être enregistré. Réessayez.');

  // Le nom alimente la coquille entière : barre latérale et salutation du
  // tableau de bord. On invalide depuis la racine, comme pour l'entreprise.
  revalidatePath('/', 'layout');
  return ok();
}

/**
 * Changer son mot de passe.
 *
 * ⚠️ **L'ANCIEN mot de passe est exigé ICI, pas par Supabase.**
 * `security_update_password_require_reauthentication` vaut `false` sur ce
 * projet : une session ouverte suffit à changer le mot de passe. Vérifié en
 * conditions réelles — un `PUT /auth/v1/user` avec le seul jeton passe en 200.
 * Concrètement, quelqu'un qui trouve un navigateur déverrouillé prend le
 * compte et en verrouille le titulaire dehors. La vérification ci-dessous
 * ferme cette porte.
 *
 * On revalide en tentant une connexion avec l'ancien mot de passe. C'est la
 * seule façon de le contrôler : Supabase ne stocke qu'une empreinte, et aucune
 * API ne dit « ce mot de passe est-il le bon ? ».
 */
export async function updatePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult<undefined>> {
  if (!currentPassword) return fail('Saisissez votre mot de passe actuel.');
  if (newPassword.length < 8) {
    return fail('Le nouveau mot de passe doit compter au moins 8 caractères.');
  }
  if (currentPassword === newPassword) {
    return fail('Le nouveau mot de passe est identique à l’ancien.');
  }

  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email;
  if (!email) return fail('Session expirée. Reconnectez-vous.');

  // Un échec ici ne touche pas la session en cours : on reste connecté.
  const { error: verification } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verification) {
    const normalise = verification.message.toLowerCase();
    if (normalise.includes('rate limit') || normalise.includes('too many')) {
      return fail(translateAuthError(verification.message));
    }
    // On ne renvoie PAS le message de Supabase : il dirait « Invalid login
    // credentials », ce qui laisse croire que c'est l'email qui est en cause.
    return fail('Mot de passe actuel incorrect.');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return fail(translateAuthError(error.message));

  revalidatePath('/', 'layout');
  return ok();
}

/**
 * Changer son adresse email.
 *
 * ⚠️ **Rien ne change tant que la nouvelle adresse n'est pas confirmée.**
 * `mailer_secure_email_change_enabled` vaut `true` : Supabase écrit à
 * l'ANCIENNE et à la NOUVELLE adresse, et les deux liens doivent être suivis.
 * C'est ce qui empêche quelqu'un ayant trouvé une session ouverte de détourner
 * le compte en changeant l'adresse — il lui faudrait aussi l'ancienne boîte.
 * On ne demande donc pas le mot de passe ici : la double confirmation couvre
 * déjà ce risque.
 *
 * ⚠️ **Aujourd'hui, l'opération échoue pour TOUT LE MONDE** — 500
 * « Error sending email change email » — parce qu'aucun domaine n'est vérifié
 * chez Resend. Ce n'est pas un défaut de cette action : le jour où le domaine
 * est vérifié, elle fonctionne sans changer une ligne. `translateAuthError` le
 * dit clairement à l'utilisateur plutôt que de laisser croire à une faute de
 * saisie.
 */
export async function updateEmailAction(newEmail: string): Promise<ActionResult<undefined>> {
  const propre = newEmail.trim().toLowerCase();

  if (!propre) return fail('L’adresse email est obligatoire.');
  // Contrôle volontairement minimal : la validité réelle d'une adresse ne se
  // prouve qu'en y envoyant un message, ce que fait l'étape suivante.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propre)) {
    return fail('Cette adresse email n’est pas valide.');
  }

  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('Session expirée. Reconnectez-vous.');
  if (auth.user.email?.toLowerCase() === propre) {
    return fail('C’est déjà votre adresse actuelle.');
  }

  const { error } = await supabase.auth.updateUser({ email: propre });
  if (error) return fail(translateAuthError(error.message));

  return ok();
}
