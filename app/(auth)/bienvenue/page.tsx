import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreateCompanyForm } from '@/components/auth/create-company-form';
import { createClient, currentUser } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/db/admin-queries';

export const metadata: Metadata = { title: 'Votre entreprise' };

export default async function BienvenuePage() {
  const user = await currentUser();
  if (!user) redirect('/connexion');

  // Un utilisateur qui a déjà une entreprise n'a rien à faire ici : sans ce
  // contrôle, un signet sur cette page permettrait d'en créer une seconde.
  const supabase = createClient();
  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (member) redirect('/dashboard');

  // Un administrateur de plateforme n'a pas forcément d'entreprise : après
  // connexion il atterrit ici, et sans ce lien il n'avait AUCUN moyen
  // d'atteindre son propre espace depuis l'interface. Il fallait taper l'URL.
  const admin = await isPlatformAdmin();

  return <CreateCompanyForm isAdmin={admin} />;
}
