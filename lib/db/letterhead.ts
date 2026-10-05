import { createClient } from '@/lib/supabase/server';

/**
 * Image du papier à en-tête — lecture et écriture, côté serveur.
 *
 * ⚠️ **TABLE SÉPARÉE DE `companies`, ET C'EST LA RAISON D'ÊTRE DE CE FICHIER.**
 * `getSession()` fait un `select('*')` sur `companies` à chaque chargement de
 * page, et le résultat traverse `CompanyProvider` jusqu'aux composants. Une
 * image de page entière y serait relue et transportée à chaque visite de chaque
 * membre, pour n'être utile qu'au PDF et à l'écran de réglage. Elle vit donc
 * dans `company_letterheads`, et **ne se lit que par les deux fonctions
 * ci-dessous**.
 *
 * ⚠️ **Ne jamais la faire remonter dans `Company`.** Ce serait annuler tout
 * l'intérêt de la séparation, et le coût ne se verrait nulle part — ni au
 * build, ni aux types, seulement sur la facture de bande passante des
 * utilisateurs.
 */

/**
 * Même liste blanche que le logo (`logoDataUrlSchema`), **et pour la même
 * raison : le SSRF du 26 sept. 2026.** Cette valeur finit dans
 * `<Image src={…} />` de `@react-pdf`, qui va chercher une URL distante depuis
 * le serveur. `image/svg+xml` reste exclu — un SVG est un document, il porte du
 * script, et il finit aussi dans un `<img>` de l'aperçu.
 *
 * La contrainte existe **aussi dans la base** (migration 0017) : celle-ci
 * empêche d'écrire, celle-là empêche d'imprimer ce qui serait arrivé autrement.
 */
export const LETTERHEAD_ACCEPTE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Plafond aligné sur celui de la migration 0017. Les deux doivent bouger ensemble. */
export const LETTERHEAD_MAX_CARACTERES = 2 * 1024 * 1024;

/**
 * L'image de l'entreprise, ou `null`.
 *
 * ⚠️ **Un échec ne fait pas tomber le document.** Si la table est injoignable
 * ou la ligne absente, on rend `null` : le PDF s'imprime alors sans en-tête
 * mais **avec** le blanc réservé, ce qui reste utilisable. Laisser l'erreur
 * remonter transformerait un ornement manquant en facture impossible à
 * télécharger.
 */
export async function getLetterhead(companyId: string): Promise<string | null> {
  try {
    const { data, error } = await createClient()
      .from('company_letterheads')
      .select('data_url')
      .eq('company_id', companyId)
      .maybeSingle<{ data_url: string }>();

    if (error || !data) return null;
    // Second filet : on refuse d'imprimer ce que la contrainte de la base
    // aurait laissé passer si elle venait à être relâchée.
    return LETTERHEAD_ACCEPTE.test(data.data_url) ? data.data_url : null;
  } catch {
    return null;
  }
}

/** Pose ou remplace l'image. Un seul en-tête par entreprise (clé primaire). */
export async function saveLetterhead(companyId: string, dataUrl: string): Promise<boolean> {
  const { error } = await createClient()
    .from('company_letterheads')
    .upsert({ company_id: companyId, data_url: dataUrl }, { onConflict: 'company_id' });
  return !error;
}

export async function deleteLetterhead(companyId: string): Promise<boolean> {
  const { error } = await createClient()
    .from('company_letterheads')
    .delete()
    .eq('company_id', companyId);
  return !error;
}
