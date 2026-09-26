import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreateCompanyForm } from '@/components/auth/create-company-form';
import { createClient, currentUser } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/db/admin-queries';
import { parsePlan } from '@/lib/plans';

export const metadata: Metadata = { title: 'Votre entreprise' };

export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
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

  /**
   * La formule choisie sur la grille tarifaire, rattrapée ici parce que
   * c'est le seul moment où l'entreprise existe enfin.
   *
   * ⚠️ **DEUX PORTEURS, un seul point d'écriture.** L'URL sert au retour de
   * Google (`/bienvenue?plan=pro`, posé par le bouton d'inscription) ;
   * `user_metadata.requested_plan` sert à l'inscription par email, dont le
   * gabarit est fixe et ne peut rien transporter. L'URL l'emporte : c'est le
   * choix le plus récent, celui qu'on vient de faire. Dans les deux cas,
   * `createCompany` est le seul à appeler `request_plan`.
   *
   * `parsePlan` valide contre la liste fermée — `?plan=` vient du visiteur,
   * et `user_metadata` est modifiable par son propriétaire. Ni l'un ni
   * l'autre n'accorde quoi que ce soit : `requested` est une intention, tout
   * le monde démarre en Découverte.
   */
  const metadata = user.user_metadata as { requested_plan?: string } | null;
  // ⚠️ Next 15 : `searchParams` est une PROMESSE.
  const { plan: planBrut } = await searchParams;
  const brut = Array.isArray(planBrut) ? planBrut[0] : planBrut;
  const plan = parsePlan(brut) ?? parsePlan(metadata?.requested_plan);

  return <CreateCompanyForm isAdmin={admin} plan={plan} />;
}
