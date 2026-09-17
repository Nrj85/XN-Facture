import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPlatformAdmin } from '@/lib/db/admin-queries';
import { exportFilename, getCompanyExport, toCsv } from '@/lib/admin/company-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Export CSV des entreprises inscrites — administrateurs de plateforme seuls.
 *
 * ⚠️ **Cette route REFUSE, elle ne redirige jamais.** C'est la règle du projet
 * pour tout ce qui vit sous `/api/` : le middleware exclut ce préfixe
 * précisément parce qu'une redirection 307 vers `/connexion` serait suivie par
 * `fetch`, et le navigateur enregistrerait la page de connexion sous le nom
 * `xn-facture-entreprises-2026-09-17.csv`. On répond donc 401 ou 403, en JSON,
 * que le bouton sait afficher.
 *
 * ⚠️ **Le contrôle est DOUBLÉ.** `isPlatformAdmin()` écarte l'appelant ici,
 * mais même si cette garde sautait, la lecture passe par le client porteur de
 * la session : les politiques `*_admin_select` et la clause `where` de la vue
 * `admin_actors` ne rendraient rien. Le pire cas est un fichier vide.
 */
export async function GET() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'Session expirée. Reconnectez-vous.' }, { status: 401 });
  }

  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: 'Cet export est réservé aux administrateurs.' }, { status: 403 });
  }

  const { rows, excluded } = await getCompanyExport();
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: excluded > 0
          ? `Aucune entreprise à exporter : les ${excluded} titulaires se sont désabonnés.`
          : 'Aucune entreprise à exporter.',
      },
      { status: 404 },
    );
  }

  const nom = exportFilename();

  return new NextResponse(toCsv(rows), {
    headers: {
      // `charset=utf-8` ET la marque d'ordre d'octets du corps : la première
      // renseigne le navigateur, la seconde Excel, qui ignore l'en-tête HTTP
      // d'un fichier ouvert depuis le disque.
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nom}"`,
      // Un export daté n'a aucune raison d'être mis en cache : il changerait
      // sans que l'adresse change.
      'Cache-Control': 'no-store',
    },
  });
}
