import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ⚠️ **ROUTE TEMPORAIRE — À SUPPRIMER DÈS QUE LE DIAGNOSTIC EST FAIT.**
 *
 * Elle existe pour trancher une seule question : les variables d'encaissement
 * atteignent-elles réellement le serveur en production ? L'écran ne sait dire
 * que « aucun canal configuré », ce qui recouvre trois causes très
 * différentes — pas de redéploiement depuis la saisie, variables posées sur un
 * autre environnement que Production, ou nom mal orthographié.
 *
 * ⚠️ **ELLE NE RENVOIE AUCUNE VALEUR.** Seulement, pour chaque nom attendu :
 * si quelque chose est défini, et la longueur de la chaîne. C'est exactement
 * ce qu'il faut pour distinguer « absente » de « présente mais vide » — la
 * distinction qui avait déjà coûté un déploiement sur ce projet — sans publier
 * un numéro de téléphone ni une clé.
 *
 * `VERCEL_ENV` est inclus parce qu'il répond à lui seul à la deuxième cause :
 * si la route s'exécute en `production` et que les variables sont absentes,
 * c'est qu'elles ont été posées ailleurs.
 */

const ATTENDUES = [
  'XN_MOMO_MTN',
  'XN_MOMO_ORANGE',
  'XN_PAYMENT_HOLDER',
  'XN_BILLING_EMAIL',
] as const;

export function GET() {
  const variables = Object.fromEntries(
    ATTENDUES.map((nom) => {
      const brut = process.env[nom];
      return [
        nom,
        brut === undefined
          ? { etat: 'absente' }
          : { etat: brut.trim() === '' ? 'présente mais VIDE' : 'définie', longueur: brut.length },
      ];
    }),
  );

  return NextResponse.json(
    {
      environnement: process.env.VERCEL_ENV ?? 'inconnu',
      variables,
      note: 'Route temporaire de diagnostic. Aucune valeur n’est renvoyée, seulement la présence et la longueur.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
