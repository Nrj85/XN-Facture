import { NextResponse } from 'next/server';
import { getSession, getInvoiceViews, getSubscription } from '@/lib/db/queries';
import { accountingFilename, accountingRows, toAccountingCsv } from '@/lib/accounting-export';
import { effectivePlan, planAllowsAccountingExport, planByCode } from '@/lib/plans';
import { today } from '@/lib/today';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Export comptable des factures de SON entreprise — formule Entreprise.
 *
 * ⚠️ **Cette route REFUSE, elle ne redirige jamais.** Règle du projet pour
 * tout ce qui vit sous `/api/` : le middleware exclut ce préfixe précisément
 * parce qu'une redirection 307 vers `/connexion` serait suivie par `fetch`, et
 * le navigateur enregistrerait la page de connexion sous le nom
 * `xn-facture-comptabilite-….csv`.
 *
 * ⚠️ **LA GARDE DE FORMULE EST APPLICATIVE, ET C'EST LE SEUL ENDROIT POSSIBLE
 * — ne pas y lire un relâchement de la règle de 0007.** Cette règle vise les
 * ÉCRITURES : un plafond qu'on saute d'un `PATCH` REST n'est pas un plafond,
 * d'où le déclencheur en base. Ici il n'y a **aucune écriture** : c'est une
 * lecture des propres factures de l'appelant, que la RLS lui accorde déjà et
 * qu'il peut consulter écran par écran. Contourner cette garde ne donnerait
 * accès à **rien de nouveau**, seulement à une mise en forme.
 */
export async function GET() {
  const session = await getSession();

  // `getSession()` rend un résultat typé plutôt que de rediriger : c'est ce
  // qui permet à une route d'API de refuser proprement. Le cas `aal1` — second
  // facteur non franchi — est couvert par le même test, puisque la garde de
  // double authentification vit dans `getSession()`.
  if (!session.ok) {
    return NextResponse.json({ error: 'Session expirée. Reconnectez-vous.' }, { status: 401 });
  }

  const { company, companyId } = session.session;

  // ⚠️ **LA FORMULE EFFECTIVE, jamais le `plan` brut.** Un abonnement
  // Entreprise payé mais expiré vaut Découverte : lui laisser l'export
  // reviendrait à ne jamais faire expirer la seule fonction qui justifie
  // l'écart de prix entre Pro et Entreprise.
  const abonnement = await getSubscription(companyId);

  /*
    ⚠️ **UNE LECTURE RATÉE NE DOIT PAS SE LIRE « DÉCOUVERTE » — corrigé le
    23 oct. 2026.** `getSubscription` ignorait son `error` : une requête qui
    n'aboutissait pas rendait le repli `discovery`, et cette route répondait
    **402 « réservé à la formule Entreprise » À UN CLIENT QUI PAIE**. Le refus
    était parfaitement formulé, parfaitement poli, et parfaitement faux — la
    pire forme, puisque rien n'invitait à réessayer.

    **503 et non 402** : rien n'est cassé chez nous, une lecture n'a pas
    abouti. C'est la règle déjà retenue pour l'export des entreprises
    (8 oct.), et elle dit à l'utilisateur de recommencer plutôt que d'aller
    souscrire ce qu'il a déjà.
  */
  if (abonnement.readFailed) {
    return NextResponse.json(
      {
        error:
          'Votre formule n’a pas pu être lue à l’instant, donc l’export n’a pas été produit. Réessayez dans un moment — rien n’a changé dans vos factures.',
      },
      { status: 503 },
    );
  }

  const formule = effectivePlan(abonnement.plan, abonnement.expiresAt, today());

  if (!planAllowsAccountingExport(formule)) {
    // **402 et non 403.** Ce n'est pas un refus de droit : c'est une fonction
    // qui existe et qu'il faut souscrire. Le code le dit, et le bouton peut
    // donc proposer `/abonnement` plutôt qu'un cul-de-sac — « un refus qui
    // n'ouvre aucun chemin est un cul-de-sac » (§2).
    return NextResponse.json(
      {
        error: `L’export comptable est réservé à la formule ${planByCode('business').name}. Votre formule actuelle est ${planByCode(formule).name}.`,
      },
      { status: 402 },
    );
  }

  const factures = await getInvoiceViews(companyId);
  const lignes = accountingRows(factures);

  if (lignes.length === 0) {
    // ⚠️ **ON DISTINGUE « aucune facture » DE « que des brouillons ».** Un
    // fichier vide laisserait croire à une panne ; et dire « aucune facture »
    // à quelqu'un qui en voit douze à l'écran lui ferait chercher un défaut
    // qui n'existe pas. Un brouillon n'a pas de numéro : ce n'est pas une
    // pièce comptable, c'est une intention.
    return NextResponse.json(
      {
        error:
          factures.length > 0
            ? 'Aucune facture émise à exporter : les brouillons ne sont pas des pièces comptables.'
            : 'Aucune facture à exporter.',
      },
      { status: 404 },
    );
  }

  return new NextResponse(toAccountingCsv(factures), {
    headers: {
      // `charset=utf-8` ET la marque d'ordre d'octets dans le corps : la
      // première renseigne le navigateur, la seconde Excel, qui ignore
      // l'en-tête HTTP d'un fichier ouvert depuis le disque.
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${accountingFilename(company.name)}"`,
      // Un export daté n'a aucune raison d'être mis en cache : il changerait
      // sans que l'adresse change.
      'Cache-Control': 'no-store',
    },
  });
}
