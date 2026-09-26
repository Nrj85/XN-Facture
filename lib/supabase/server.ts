import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicConfig } from '@/lib/supabase/config';

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

  return createServerClient(url, anonKey, {
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
