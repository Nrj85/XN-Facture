/**
 * Fournisseurs d'identité externes proposés à la connexion.
 *
 * ⚠️ **L'interrupteur vit dans l'ENVIRONNEMENT, pas dans le code**, exactement
 * comme les coordonnées d'encaissement de `lib/billing-config.ts`. Sans lui, le
 * bouton « Continuer avec Google » serait affiché en permanence, y compris tant
 * que le fournisseur n'est pas configuré chez Supabase — et cliquer dessus
 * renverrait une erreur. C'est le contrôle mort que proscrit le §6.1 : mieux
 * vaut l'absence que le mensonge.
 *
 * ⚠️ **DEUX RÉGLAGES DOIVENT S'ACCORDER, et rien ne le vérifie à notre place :**
 *
 * 1. Supabase — *Authentication > Sign In / Providers > Google*, avec
 *    l'identifiant et le secret d'un client OAuth Google Cloud. C'est lui qui
 *    fait réellement marcher la connexion.
 * 2. `XN_AUTH_GOOGLE=1` — ici, qui décide seulement si le bouton s'affiche.
 *
 * Poser le second sans le premier ressuscite le contrôle mort ; poser le
 * premier sans le second cache une fonctionnalité qui marche.
 *
 * ⚠️ **Une variable d'environnement de Vercel n'est lue qu'au déploiement.**
 * La changer dans l'interface ne suffit pas : il faut redéployer, sans quoi le
 * bouton reste dans l'état du build précédent.
 */
export function googleSignInEnabled(): boolean {
  return (process.env.XN_AUTH_GOOGLE ?? '').trim() === '1';
}
