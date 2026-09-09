'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/actions/result';

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
