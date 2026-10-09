import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicConfig } from '@/lib/supabase/config';
import type { Database } from '@/lib/db/database.types';

/**
 * ⚠️ **LE GÉNÉRIQUE `<Database>` EST POSÉ ICI, ET C'EST TOUT CE QU'IL FALLAIT
 * — 9 oct. 2026.** Sans lui le client n'était pas typé : `from('table_
 * inexistante')` compilait, `.rpc('nom_inexistant')` aussi, et les lignes
 * revenaient en `any`. La preuve était historique, pas théorique —
 * `site_testimonials` a manqué entièrement du fichier de types du 1er au
 * 5 oct. pendant que SIX appels l'utilisaient, sans qu'une seule compilation
 * échoue.
 *
 * ⚠️ **CE PROJET ANNONÇAIT « 63 SITES D'APPEL » : C'ÉTAIT FAUX, et le chiffre
 * a retardé la décision.** 63 était le nombre d'appelants de `createClient()`
 * — et **aucun n'a à changer**, puisque le générique vit dans la fabrique.
 * Mesuré en le posant pour de vrai : **4 erreurs, 3 fichiers**. Et trois de
 * ces quatre étaient les `.rpc('admin_actors')` corrigés à la main la veille :
 * **`tsc` aurait attrapé le défaut du 8 oct.**
 *
 * ⚠️ **CONSÉQUENCE À CONNAÎTRE : `database.types.ts` cesse d'être de la
 * documentation pour devenir un garde-fou.** Il doit donc être **régénéré
 * après chaque migration**, sinon il refusera un nom que la base connaît :
 *
 *     GET /v1/projects/<ref>/types/typescript?included_schemas=public
 */

/**
 * Client Supabase côté serveur — Server Components, Server Actions, routes.
 *
 * Il porte la session de l'utilisateur via les cookies, donc **la RLS
 * s'applique**. C'est volontaire : le serveur n'a pas plus de droits que la
 * personne au clavier, et une politique mal écrite se manifeste ici plutôt
 * que de passer inaperçue.
 */
export function createClient() {
  const { url, anonKey } = publicConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      // ⚠️ **L'ADAPTATEUR EST ASYNCHRONE, ET `createClient` RESTE SYNCHRONE.**
      // Next 15 a rendu `cookies()` asynchrone. Le réflexe serait de mettre un
      // `await` ici et de rendre `createClient` asynchrone à son tour — mais
      // elle est appelée **63 fois** dans le projet, et il aurait fallu ajouter
      // un `await` à chacune. Soixante-trois occasions d'en oublier une sur une
      // application qui a des utilisateurs réels.
      //
      // `@supabase/ssr` accepte que `getAll` et `setAll` rendent une promesse
      // (`GetAllCookies = () => Promise<…> | …`) : le `await` vit donc ICI, en
      // deux endroits, et aucun appelant ne change. C'est aussi la bonne
      // migration et non un report — rien ne s'appuie sur l'accès synchrone
      // déprécié que Next 15 tolère encore et que Next 16 retirera.
      async getAll() {
        return (await cookies()).getAll();
      },
      async setAll(cookiesToSet) {
        try {
          const cookieStore = await cookies();
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component ne peut pas écrire de cookie. Ce n'est pas une
          // anomalie : le middleware rafraîchit déjà la session à chaque
          // requête, donc l'échec est sans conséquence ici.
        }
      },
    },
  });
}

/**
 * Client **isolé** : il ne lit ni n'écrit aucun cookie.
 *
 * Sert à vérifier un mot de passe sans toucher à la session en cours.
 *
 * ⚠️ **SANS LUI, VÉRIFIER LE MOT DE PASSE ACTUEL DÉCONNECTE À MOITIÉ.**
 * `updatePasswordAction` contrôle l'ancien mot de passe en tentant une
 * connexion — seule méthode possible, Supabase ne stockant qu'une empreinte.
 * Mais une connexion **réussie** émet une session neuve et l'écrit dans les
 * cookies, remplaçant celle de l'utilisateur.
 *
 * C'était sans conséquence visible jusqu'à la double authentification : une
 * session issue de `signInWithPassword` est au niveau **`aal1`**, même pour
 * quelqu'un qui a un facteur vérifié. La garde de `getSession()` l'aurait donc
 * renvoyé sur l'écran de code **juste après un changement de mot de passe
 * réussi** — il aurait conclu à un échec, ou à un compte cassé.
 *
 * Avec cet adaptateur muet, la vérification est un aller-retour sans trace :
 * le jeton émis n'est jamais écrit, et la session de la personne reste celle
 * qu'elle avait, à son niveau d'assurance.
 *
 * `persistSession: false` en renfort, pour que rien ne soit conservé en
 * mémoire du client non plus.
 */
export function createIsolatedClient() {
  const { url, anonKey } = publicConfig();

  return createServerClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        /* Volontairement muet : c'est la raison d'être de ce client. */
      },
    },
  });
}

/**
 * Utilisateur authentifié, ou `null`.
 *
 * On passe par `getUser()` et jamais par `getSession()` : `getSession` lit le
 * cookie sans le vérifier, donc son contenu est falsifiable. `getUser`
 * interroge le serveur d'authentification et valide le jeton.
 */
export async function currentUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
