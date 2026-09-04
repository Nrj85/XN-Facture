import { createClient } from '@/lib/supabase/server';

/**
 * Union volontairement distincte d'`ActionResult` : réutiliser
 * `ActionResult<never>` produirait une branche `{ ok: true; data: never }` qui
 * empêche TypeScript de discriminer sur `ok`, et `companyId` deviendrait
 * inaccessible après le garde. La branche d'échec, elle, reste assignable à
 * `ActionResult<T>` — c'est tout ce dont les actions ont besoin.
 */
export type CompanyContext =
  | { ok: true; companyId: string }
  | { ok: false; error: string };

/**
 * Entreprise de l'utilisateur courant, pour une Server Action.
 *
 * Contrairement à `requireSession` (`lib/db/queries.ts`) qui redirige, on rend
 * ici un résultat : une action doit pouvoir répondre « vous n'êtes plus
 * connecté » au formulaire qui l'appelle. Une redirection depuis une action
 * déclenchée par un bouton ferait disparaître la page sans explication.
 */
export async function requireCompanyId(): Promise<CompanyContext> {
  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };

  // La fonction SQL fait autorité sur « quelle entreprise » : la dupliquer ici
  // ferait exister deux définitions de la même règle.
  const { data, error } = await supabase.rpc('current_company_id');
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Aucune entreprise rattachée à ce compte.' };

  return { ok: true, companyId: data as string };
}
