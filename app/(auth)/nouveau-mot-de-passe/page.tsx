import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { currentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

/**
 * On arrive ici depuis `/api/auth/confirmation`, qui a déjà échangé le jeton
 * de l'email contre une session. La présence d'un utilisateur est donc la
 * preuve que le lien était bon — et son absence, la preuve qu'il ne l'était
 * pas. Le contrôle est fait côté serveur pour que le formulaire ne s'affiche
 * jamais dans le vide.
 */
export default async function NouveauMotDePassePage() {
  const user = await currentUser();

  return <ResetPasswordForm hasSession={Boolean(user)} email={user?.email} />;
}
