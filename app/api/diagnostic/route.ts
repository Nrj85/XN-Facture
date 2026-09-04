import { NextResponse } from 'next/server';

/**
 * Route de diagnostic TEMPORAIRE.
 *
 * Elle répond à une seule question : quelles variables d'environnement
 * l'application voit-elle réellement une fois déployée ? Le symptôme observé
 * — `/dashboard` en 500 sur Vercel alors qu'il redirige proprement en local —
 * ne permet pas de distinguer « variable absente », « nom mal orthographié »
 * et « valeur mal collée ». Cette route tranche.
 *
 * **Elle ne divulgue aucune valeur** : uniquement la présence, la longueur, et
 * les premiers caractères de l'URL (qui est de toute façon publique).
 *
 * À SUPPRIMER une fois le diagnostic posé.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decrire(valeur: string | undefined) {
  if (valeur === undefined) return { présente: false, raison: 'absente de process.env' };
  const nettoyée = valeur.trim();
  if (!nettoyée) return { présente: false, raison: 'définie mais vide' };
  return { présente: true, longueur: nettoyée.length };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL;

  return NextResponse.json(
    {
      NEXT_PUBLIC_SUPABASE_URL: {
        ...decrire(url),
        // L'URL du projet est publique : la montrer aide à repérer une valeur
        // collée avec son nom, des guillemets, ou une adresse de tableau de bord.
        début: url ? url.trim().slice(0, 40) : null,
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        ...decrire(anon),
        commencePar_eyJ: anon ? anon.trim().startsWith('eyJ') : null,
      },
      NEXT_PUBLIC_SITE_URL: { ...decrire(site), valeur: site?.trim() ?? null },
      // Les noms NEXT_PUBLIC_* sont remplacés à la COMPILATION. Si le build
      // n'avait pas la variable, elle est figée à `undefined` pour toujours,
      // quoi qu'on ajoute ensuite sans reconstruire.
      construitLe: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
