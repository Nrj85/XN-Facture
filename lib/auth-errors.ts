/**
 * Traduction des erreurs d'authentification Supabase.
 *
 * Elles arrivent en anglais et parfois cryptiques (« Invalid login
 * credentials »). On ne dit jamais si c'est l'email ou le mot de passe qui est
 * faux : le distinguer permettrait d'énumérer les comptes existants.
 *
 * ⚠️ **Ce fichier n'est PAS `'use server'`, et ne doit pas le devenir.** Un
 * module de Server Actions ne peut exporter que des fonctions asynchrones ;
 * celle-ci est synchrone, et deux modules d'actions en ont besoin. C'est la
 * raison de son extraction hors de `lib/actions/auth.ts`, où elle était
 * privée.
 */

export function translateAuthError(message: string): string {
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
  // ⚠️ **AVANT le fourre-tout `password` ci-dessous, et c'est la raison d'être
  // de ce cas.** Depuis le 26 sept. 2026, `password_hibp_enabled` est actif :
  // Supabase compare le mot de passe choisi à la base de HaveIBeenPwned et
  // refuse ceux qui figurent dans une fuite connue, avec
  //
  //     weak_password  « Password is known to be weak and easy to guess,
  //                      please choose a different one. »
  //
  // Ce message contient le mot « password ». Sans ce cas placé au-dessus, le
  // fourre-tout l'attrapait et affichait **« Mot de passe trop court :
  // 8 caractères au minimum »** — sur un mot de passe pouvant faire trente
  // caractères. La personne le rallongeait, se faisait refuser à nouveau, et
  // rien à l'écran ne lui disait pourquoi.
  //
  // Le texte explique la vraie raison et **ne reproche rien** : figurer dans une
  // fuite n'est pas une faute de l'utilisateur, c'est un site tiers qui s'est
  // fait voler ses données.
  if (
    normalized.includes('weak_password') ||
    (normalized.includes('password') &&
      (normalized.includes('easy to guess') ||
        normalized.includes('known to be weak') ||
        normalized.includes('compromised') ||
        normalized.includes('data breach')))
  ) {
    return 'Ce mot de passe figure dans une fuite de données connue : il est déjà dans les listes qu’utilisent les attaquants. Ce n’est pas votre faute, mais il ne protège plus rien. Choisissez-en un autre, propre à XN-Facture.';
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
  // Cas rencontré en conditions réelles : Supabase crée le compte, échoue à
  // envoyer l'email de confirmation, et renvoie un 500. L'inscription est
  // impossible pour TOUT LE MONDE, et le message générique laissait croire à
  // une faute de saisie — la personne réessayait indéfiniment.
  // ⚠️ AVANT le cas générique d'envoi ci-dessous, qui l'attraperait et
  // parlerait de création de compte à quelqu'un qui change d'adresse.
  // Constaté en conditions réelles, 15 sept. 2026 :
  //   500 unexpected_failure « Error sending email change email »
  // Même cause que l'échec d'inscription : l'expéditeur d'essai de Resend ne
  // délivre qu'au propriétaire du compte. Aucun domaine n'est vérifié.
  if (normalized.includes('error sending') && normalized.includes('email change')) {
    return 'L’adresse n’a pas pu être changée : l’envoi de l’email de confirmation a échoué. Ce n’est pas votre saisie, c’est un réglage du serveur — aucun domaine d’expédition n’est encore vérifié. Votre adresse actuelle reste valable.';
  }
  if (normalized.includes('error sending') && normalized.includes('email')) {
    return 'Le compte n’a pas pu être créé : l’envoi de l’email de confirmation a échoué. Ce n’est pas votre saisie, c’est un réglage du serveur. Réessayez plus tard ou contactez-nous.';
  }
  // Rien ne doit remonter en anglais : l'interface est entièrement en français,
  // et un message brut de Supabase renseigne l'utilisateur sur l'infrastructure
  // sans lui dire quoi faire. Observé une fois en conditions réelles :
  // « Email address "..." is invalid » s'affichait tel quel sur /inscription.
  return 'La demande n’a pas abouti. Vérifiez vos informations et réessayez.';
}

