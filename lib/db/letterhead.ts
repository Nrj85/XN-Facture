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
 * ⚠️ **LA LECTURE NE REGARDE PAS LA FORMULE, ET C'EST UNE DÉCISION — 9 oct.
 * 2026.** Le papier à en-tête est réservé aux formules payantes depuis la
 * migration 0021, mais **le verrou porte sur l'ÉCRITURE, pas sur
 * l'impression** : un en-tête déjà enregistré continue d'être dessiné, même
 * quand l'entreprise est redescendue en Découverte.
 *
 * Trois raisons, et la première est une règle du projet :
 *
 *   1. « À l'expiration, redescendre en Découverte, JAMAIS fermer : lecture,
 *      export PDF et devis restent ouverts. » Arrêter le dessin fermerait.
 *   2. **Un PDF est une pièce déjà remise à un client.** Le projet gèle
 *      `vat_rate` et `vat_exempt` sur chaque document précisément pour qu'une
 *      réimpression ressemble à ce que le client a reçu ; un en-tête qui
 *      disparaîtrait rétroactivement contredirait cette discipline.
 *   3. Mesuré le 9 oct. avant d'écrire : les 8 entreprises de la base étaient
 *      en Découverte et **une seule utilisait la fonction**. Fermer
 *      l'impression n'aurait eu qu'un seul effet observable — retirer son
 *      en-tête au seul utilisateur réel.
 *
 * **Ne pas « corriger » cela en ajoutant un contrôle de formule ici.** Ce
 * serait changer silencieusement l'apparence de factures déjà envoyées.
 */

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

/**
 * L'image **seulement si elle sert** : rien à lire quand l'entreprise n'est pas
 * en mode « en-tête téléversé ».
 *
 * ⚠️ **Point UNIQUE de cette condition.** Elle est vraie pour les deux routes
 * PDF et pour les six pages qui portent un aperçu : la recopier huit fois
 * garantirait qu'un jour l'une d'elles lise l'image pour rien — un aller-retour
 * vers Dublin à chaque chargement, pour un `null`.
 */
export async function letterheadIfUsed(
  companyId: string,
  mode: string | undefined,
): Promise<string | null> {
  return mode === 'image' ? getLetterhead(companyId) : null;
}

/**
 * Pose ou remplace l'image. Un seul en-tête par entreprise (clé primaire).
 *
 * ⚠️ **ELLE RENDAIT UN BOOLÉEN, ET CELA PERDAIT LE MOTIF DU REFUS.** Depuis
 * 0021, un échec ici n'est plus seulement une panne : c'est aussi le
 * déclencheur `company_letterheads_plan` qui refuse en `P0001` avec une
 * **phrase française destinée à l'écran**. Un `boolean` la jetait, et
 * l'appelant affichait « Réessayez » — un message qui invite à refaire ce qui
 * échouera toujours. On rend donc l'erreur, que `failFromDb` sait traduire.
 *
 * `null` = tout s'est bien passé.
 */
export async function saveLetterhead(
  companyId: string,
  dataUrl: string,
): Promise<{ code?: string; message: string; hint?: string | null } | null> {
  const { error } = await createClient()
    .from('company_letterheads')
    .upsert({ company_id: companyId, data_url: dataUrl }, { onConflict: 'company_id' });
  return error ?? null;
}

export async function deleteLetterhead(companyId: string): Promise<boolean> {
  const { error } = await createClient()
    .from('company_letterheads')
    .delete()
    .eq('company_id', companyId);
  return !error;
}
