/**
 * Lecture de la configuration Supabase.
 *
 * Une clé absente doit produire un message qui dit QUOI manque et OÙ le mettre.
 * Sans cette couche, une variable oubliée se manifeste bien plus loin, sous la
 * forme d'un « Invalid API key » ou d'un `fetch failed` qui n'apprend rien.
 *
 * La validation est délibérément PARESSEUSE — déclenchée au premier usage, pas
 * à l'import du module. Une validation à l'import ferait échouer `next build`
 * sur une machine sans `.env.local` (une CI, un poste fraîchement cloné), alors
 * que la compilation, elle, n'a besoin d'aucune clé.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function missing(name: string): never {
  throw new ConfigError(
    `Variable d'environnement manquante : ${name}. ` +
      'Copiez `.env.example` en `.env.local` et renseignez les valeurs du projet ' +
      '(tableau de bord Supabase > Project Settings > API).',
  );
}

function read(name: string): string {
  // `process.env` n'est pas indexable dynamiquement côté navigateur : Next
  // remplace les accès littéraux `process.env.NEXT_PUBLIC_*` à la compilation.
  // D'où ces accès écrits en toutes lettres plutôt qu'une boucle.
  const value =
    name === 'NEXT_PUBLIC_SUPABASE_URL'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
        ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        : process.env.SUPABASE_SERVICE_ROLE_KEY;

  const trimmed = value?.trim();
  if (!trimmed) missing(name);
  return trimmed;
}

/**
 * Vérifie que l'URL est bien celle de l'API et non celle du tableau de bord.
 * L'erreur est fréquente et son symptôme — un 404 en HTML là où du JSON est
 * attendu — n'oriente vers rien.
 */
function assertApiUrl(url: string): string {
  if (url.includes('supabase.com/dashboard')) {
    throw new ConfigError(
      'NEXT_PUBLIC_SUPABASE_URL pointe vers le tableau de bord et non vers l’API. ' +
        'Attendu : https://<ref-du-projet>.supabase.co',
    );
  }
  try {
    new URL(url);
  } catch {
    throw new ConfigError(`NEXT_PUBLIC_SUPABASE_URL n’est pas une URL valide : ${url}`);
  }
  return url;
}

/** Configuration publique. Sans danger dans le navigateur : la RLS protège les données. */
export function publicConfig(): { url: string; anonKey: string } {
  return {
    url: assertApiUrl(read('NEXT_PUBLIC_SUPABASE_URL')),
    anonKey: read('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

/**
 * Clé `service_role` — elle CONTOURNE toutes les politiques RLS.
 *
 * Le garde-fou n'est pas décoratif : si ce code s'exécutait un jour dans un
 * navigateur, la clé serait lisible par n'importe qui et la base entière
 * ouverte. Mieux vaut une erreur bruyante qu'une fuite silencieuse.
 */
export function serviceRoleKey(): string {
  if (typeof window !== 'undefined') {
    throw new ConfigError(
      'La clé service_role a été demandée depuis le navigateur. ' +
        'Elle contourne la RLS et ne doit jamais quitter le serveur.',
    );
  }
  return read('SUPABASE_SERVICE_ROLE_KEY');
}

/** Vrai si la configuration publique est renseignée, sans lever d'erreur. */
export function isConfigured(): boolean {
  try {
    publicConfig();
    return true;
  } catch {
    return false;
  }
}
