import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatDate } from '@/lib/format';
import { formatAmount, formatMoney, formatQuantity } from '@/lib/money';
import { totalsBlock } from '@/lib/vat';
import type { PdfPayload } from '@/lib/pdf/payload';

/**
 * Facture au format PDF.
 *
 * Elle reprend les jetons du design système — mêmes couleurs, même hiérarchie —
 * pour que le document reçu par le client soit reconnaissable comme venant de
 * l'application.
 */

const INK = '#1B1815';
const INK_2 = '#5C544A';
const INK_3 = '#7A7064';
const LINE = '#E8E1D4';
const PAPER = '#FBF8F3';
// Aligné sur le logo le 28 sept. 2026, comme le jeton `brand` de
// `tailwind.config.ts` — ces valeurs sont recopiées ici parce que
// `@react-pdf` ne lit pas le thème Tailwind. Même contrainte que
// `marketing.css` : les trois fichiers doivent bouger ensemble.
// Ne sert qu'à la tuile de repli (initiales) quand l'entreprise n'a pas de
// logo : du blanc dessus, donc la valeur doit rester au-dessus de 4,5:1 —
// 4,52:1 ici, mesuré.
const BRAND = '#E32D05';

/**
 * Millimètres → points PostScript. **Seule conversion du projet.**
 *
 * L'utilisateur mesure son papier à en-tête à la règle, donc les réglages sont
 * stockés en millimètres (migration 0017) ; `@react-pdf` compte en points.
 * 72 pt = 1 pouce = 25,4 mm. La faire ailleurs qu'ici garantirait qu'un jour
 * les deux conversions divergent, sur une marge d'impression.
 */
const mm = (valeur: number) => (valeur * 72) / 25.4;

/**
 * Le papier à en-tête prend-il le relais ?
 *
 * ⚠️ **`preprinted` COMPTE AUTANT QUE `image`.** L'erreur serait de ne traiter
 * que le cas où une image existe : quelqu'un qui imprime sur son papier
 * physique n'en téléverse aucune, et c'est précisément lui qui a le plus besoin
 * que le document s'efface — sinon le logo généré s'imprime PAR-DESSUS le logo
 * déjà sur la feuille.
 */
const sousEnTete = (mode: string | undefined) => mode === 'preprinted' || mode === 'image';

/**
 * `Intl` sépare les milliers par une espace fine insécable (U+202F), absente du
 * jeu WinAnsi des polices intégrées au PDF : elle s'y afficherait comme un
 * caractère manquant. On la remplace par une insécable classique, qui, elle, en
 * fait partie.
 */
function pdfText(value: string): string {
  return value.replace(/[  ]/g, ' ');
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 44,
    // ⚠️ Ces deux valeurs sont REMPLACÉES quand un papier à en-tête est actif —
    // voir `margesPapier()` plus bas. Elles restent le défaut, c'est-à-dire le
    // document tel qu'il était avant la migration 0017.
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: INK,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 22, letterSpacing: -0.4 },
  meta: { marginTop: 6, fontSize: 8.5, color: INK_3 },
  metaStrong: { fontFamily: 'Helvetica-Bold', color: INK_2 },
  logo: { width: 46, height: 46, objectFit: 'contain' },

  /**
   * Filigrane : le logo de l'émetteur, en très large et très pâle, au centre
   * de chaque page.
   *
   * **L'opacité est le point sensible.** Un filigrane trop appuyé rend une
   * colonne de montants pénible à lire, et une facture doit rester lisible
   * avant d'être décorative. 0,07 est le compromis retenu : à 0,05 un logo à
   * traits fins disparaissait purement et simplement, au-delà de 0,10 les
   * chiffres commencent à souffrir. **La même valeur est reprise dans
   * `invoice-preview.tsx`** — l'aperçu prétend montrer le document réel, les
   * deux doivent bouger ensemble.
   *
   * Le bloc est posé en `absolute` sur toute la page ET rendu AVANT le
   * contenu : dans @react-pdf, la peinture suit l'ordre du document, donc
   * tout ce qui suit passe par-dessus. `fixed` le fait réapparaître à chaque
   * page — sans lui, une facture de deux pages n'aurait le filigrane que sur
   * la première.
   */
  watermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.07,
  },
  watermarkImage: { width: 320, height: 320, objectFit: 'contain' },
  logoFallback: {
    width: 38,
    height: 38,
    backgroundColor: BRAND,
    borderRadius: 8,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 12,
  },

  parties: { flexDirection: 'row', marginTop: 24, gap: 1 },
  party: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    padding: 12,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.8,
    color: INK_2,
    textTransform: 'uppercase',
  },
  partyName: { marginTop: 6, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  partyLine: { marginTop: 2, fontSize: 8.5, color: INK_2, lineHeight: 1.5 },

  dates: { flexDirection: 'row', marginTop: 12, gap: 1 },

  /*
    ⚠️ **LE TABLEAU A ÉTÉ ALLÉGÉ LE 24 oct. 2026, à la demande de
    l'utilisateur** — filets plus légers, alternance de fond, colonnes de
    montants plus aérées.

    Il portait un filet d'1 pt sous CHAQUE ligne : sur une facture de dix
    postes, dix traits horizontaux pleine largeur, c'est-à-dire une grille. Le
    rythme venait du trait, jamais de l'espace.

    ⚠️ **LA SÉPARATION PASSE DÉSORMAIS PAR LE FOND, PAS PAR LE TRAIT.** Une
    rangée sur deux reçoit un aplat crème ; les seuls filets qui restent sont
    celui de l'en-tête et celui qui ferme le tableau. Deux traits au lieu de
    douze, et la colonne de montants cesse d'être enfermée dans des cases.

    ⚠️ **LES FILETS SONT À 0,75 pt, et c'est le mince utile.** En dessous,
    l'impression à 300 ppp les rend irréguliers — un trait qui disparaît par
    endroits se lit comme un défaut d'impression, pas comme une finesse.
  */
  tableHead: {
    flexDirection: 'row',
    marginTop: 24,
    paddingBottom: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: LINE,
  },
  row: {
    flexDirection: 'row',
    // 9,5 pt contre 8 : l'espace remplace le trait, il doit donc être le seul
    // à porter le rythme. Trop serré, les rangées se touchent sans filet pour
    // les séparer.
    paddingVertical: 9.5,
    paddingHorizontal: 8,
  },
  /*
    ⚠️ **L'ALTERNANCE MASQUE LE FILIGRANE LÀ OÙ ELLE PASSE, et il faut le
    savoir.** Un aplat est opaque : sous une rangée teintée, le logo en fond
    disparaît. `#FAF7F2` est volontairement à un cheveu du blanc — il suffit à
    guider l'œil le long d'une ligne sans découper le filigrane en tranches
    visibles. **L'assombrir rendrait le filigrane strié.**
  */
  rowAlt: { backgroundColor: '#FAF7F2' },
  /*
    Le filet de fermeture. Sans lui, la dernière rangée flotte : le tableau
    n'a plus de bord bas, et le bloc de totaux semble lui appartenir.
  */
  tableEnd: { borderTopWidth: 0.75, borderTopColor: LINE },

  // ⚠️ **LES TROIS COLONNES DE CHIFFRES SONT ÉLARGIES** — 48/80/88 devenait
  // serré dès qu'un montant dépassait le million : « 1 452 855 » touchait
  // l'intitulé de gauche. `paddingLeft` sépare chaque colonne de la
  // précédente sans ajouter le moindre trait vertical.
  colDesc: { flex: 1, paddingRight: 14 },
  colQty: { width: 44, textAlign: 'right' },
  colUnit: { width: 94, textAlign: 'right', paddingLeft: 8 },
  colTotal: { width: 104, textAlign: 'right', paddingLeft: 8 },

  totals: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end' },
  totalsBox: { width: 220 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalsRowStrong: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  grand: { fontFamily: 'Helvetica-Bold', fontSize: 13 },

  payment: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: PAPER,
    padding: 12,
  },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  paymentItem: { width: '50%', flexDirection: 'row', marginBottom: 3 },
  paymentKey: { color: INK_3, marginRight: 4 },

  notes: { marginTop: 18, fontSize: 8.5, color: INK_2, lineHeight: 1.5 },

  footer: {
    position: 'absolute',
    bottom: 26,
    left: 44,
    right: 44,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 7.5,
    color: INK_3,
    textAlign: 'center',
  },
  draft: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: '#F1ECE2',
    color: '#57534E',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
});

export function InvoiceDocument({ payload }: { payload: PdfPayload }) {
  const { company, client } = payload;
  const isQuote = payload.docType === 'quote';
  const money = (amount: number) => pdfText(formatMoney(amount, company.currency));

  // Le bloc de totaux est décidé par `lib/vat.ts`, une seule fois pour les
  // cinq rendus du projet. `payload` porte déjà les montants calculés : on ne
  // recalcule rien ici, on met en forme.
  const bloc = totalsBlock(
    {
      lineTotals: [],
      subtotal: payload.subtotal,
      vatRate: payload.vatRate,
      vatAmount: payload.vatAmount,
      total: payload.total,
    },
    payload.vatExempt === true,
  );
  // Les coordonnées de règlement n'ont pas leur place sur un devis : elles
  // inviteraient à payer une somme qui n'est pas encore due.
  const hasPayment =
    !isQuote &&
    Boolean(company.bankName || company.bankAccount || company.momoMtn || company.momoOrange);
  const docLabel = isQuote ? 'Devis' : 'Facture';

  // --- Papier à en-tête ------------------------------------------------------
  // ⚠️ **TOUT CE QUE LE PAPIER PORTE DÉJÀ DOIT DISPARAÎTRE DU DOCUMENT.** Le
  // PDF imprime aujourd'hui le logo, le bloc « Émetteur » et une ligne légale
  // en pied de page — c'est-à-dire exactement le contenu d'un papier à en-tête.
  // Les laisser produirait deux en-têtes superposés sur une feuille
  // pré-imprimée, et deux fois la même adresse sur un en-tête téléversé.
  const enTete = sousEnTete(company.letterheadMode);
  const margesPapier = enTete
    ? {
        paddingTop: mm(company.letterheadTopMm ?? 45),
        paddingBottom: mm(company.letterheadBottomMm ?? 25),
      }
    : null;

  /*
    ⚠️ **LE FILIGRANE SURVIT DÉSORMAIS AU PAPIER À EN-TÊTE — décision de
    l'utilisateur, 24 oct. 2026, et elle RENVERSE celle du 5 oct.**

    La règle était `!enTete && logoDataUrl`, au motif qu'un logo géant au
    centre « se bat avec le dessin de l'entreprise ». Ce raisonnement vaut pour
    un papier dont le dessin occupe la page ; il est faux pour le cas réel —
    un papier qui porte une bande en haut, une bande en bas, et **du blanc au
    milieu**, c'est-à-dire précisément l'endroit où le filigrane se pose.

    L'utilisateur a demandé le filigrane sur SA facture, qui est dans ce cas.
    Il ne le voyait pas, et rien à l'écran ne lui disait pourquoi : le réglage
    d'en-tête éteignait en silence une fonction qu'il n'avait pas désactivée.

    ⚠️ **CE QUE CELA COÛTE, ET IL FAUT LE SAVOIR :** un papier dont le dessin
    couvre toute la page porte maintenant le logo par-dessus, à 7 %. Le recours
    est de retirer le logo de l'entreprise — pas idéal, mais ce cas est
    hypothétique là où celui qu'on vient de corriger est réel et mesuré.
  */
  const filigrane = company.logoDataUrl;

  /*
    ⚠️ **LE PIED DE PAGE IGNORAIT LA BANDE RÉSERVÉE — vrai défaut, corrigé le
    24 oct. 2026 sur signalement de l'utilisateur.**

    `styles.footer` est posé à `bottom: 26`. Quand un papier à en-tête réserve
    25 mm en bas — soit ~71 pt — notre ligne légale et notre pagination
    tombaient donc **à l'intérieur** de la bande que le papier dessine, par
    -dessus son propre pied. Sur la facture signalée : « XN-Corp · Doula,
    Cameroun — Page 1/1 » imprimé au milieu de la bande de l'entreprise.

    ⚠️ **ET DÉCOCHER « garder la ligne légale » N'Y AURAIT RIEN CHANGÉ** : la
    pagination survit toujours, elle n'est pas une mention légale. « Page 1/1 »
    serait resté exactement au même endroit. **Le défaut est le placement, pas
    le contenu** — c'est pourquoi aucun réglage ne pouvait le contourner.

    On remonte donc le pied **juste au-dessus** de la bande. Les 6 pt sont le
    filet qui évite que sa bordure supérieure ne touche le dessin.
  */
  const basReserve = enTete ? mm(company.letterheadBottomMm ?? 25) : 0;
  const piedStyle = basReserve > 0 ? [styles.footer, { bottom: basReserve + 6 }] : styles.footer;

  // ⚠️ **LA LIGNE LÉGALE RESTE PAR DÉFAUT**, et ce n'est pas un choix
  // esthétique. Une facture camerounaise doit porter le NIU et le RCCM, et rien
  // ne garantit que le papier de l'entreprise les porte. L'écran de réglage le
  // dit explicitement et laisse le choix ; le défaut, lui, est celui qui rend le
  // document conforme.
  const pied = !enTete || company.letterheadKeepLegal !== false;

  return (
    <Document
      title={payload.number ?? docLabel}
      author={company.legalName}
      subject={`${docLabel} ${company.legalName} — ${client.name}`}
    >
      <Page size="A4" style={margesPapier ? [styles.page, margesPapier] : styles.page}>
        {/* L'en-tête téléversé couvre la page ENTIÈRE et se répète à chaque
            page (`fixed`), comme le ferait une rame de papier pré-imprimé : la
            deuxième feuille d'une facture longue porte le même en-tête que la
            première.

            ⚠️ Rendu AVANT tout le reste et en `position: absolute` sans
            `padding` : les marges de la page ne s'y appliquent pas, sinon
            l'image serait repoussée vers l'intérieur et ne couvrirait plus les
            bords — exactement là où un en-tête met son dessin. */}
        {payload.letterheadDataUrl && company.letterheadMode === 'image' && (
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            fixed
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={payload.letterheadDataUrl} style={{ width: '100%', height: '100%' }} />
          </View>
        )}
        {/* Filigrane : rendu en PREMIER pour que tout le contenu passe
            par-dessus, et `fixed` pour qu'il se répète à chaque page. Absent
            si l'entreprise n'a pas encore de logo — pas de repli textuel ici,
            deux lettres géantes en fond ne ressembleraient à rien. */}
        {filigrane && (
          <View style={styles.watermark} fixed>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={company.logoDataUrl} style={styles.watermarkImage} />
          </View>
        )}

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{isQuote ? 'DEVIS' : 'FACTURE'}</Text>
            <Text style={styles.meta}>
              Numéro <Text style={styles.metaStrong}>{payload.number ?? 'non attribué'}</Text>
            </Text>
            {/* Un brouillon ne doit jamais pouvoir passer pour un document émis. */}
            {payload.isDraft && (
              <Text style={styles.draft}>{isQuote ? 'BROUILLON — NON ÉMIS' : 'BROUILLON — NON ÉMISE'}</Text>
            )}
          </View>
          {/* ⚠️ **AUCUN LOGO SOUS UN PAPIER À EN-TÊTE** — ni l'image, ni la
              tuile de repli aux initiales. Le papier en porte déjà un, et deux
              logos dans le même angle est précisément ce que cette
              fonctionnalité doit éviter. */}
          {!enTete &&
            (company.logoDataUrl ? (
              // `Image` vient de @react-pdf : c'est une primitive de dessin
              // PDF, pas une balise HTML, et elle n'accepte pas d'attribut
              // `alt`. La règle jsx-a11y ne s'applique donc pas ici.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={company.logoDataUrl} style={styles.logo} />
            ) : (
              <Text style={styles.logoFallback}>{company.name.slice(0, 2).toUpperCase()}</Text>
            ))}
        </View>

        <View style={styles.parties}>
          {/* ⚠️ **LE BLOC ÉMETTEUR DISPARAÎT SOUS UN PAPIER À EN-TÊTE** :
              adresse, téléphone, email et NIU y sont déjà. Le destinataire,
              lui, reste — il change à chaque facture, aucun papier ne peut le
              porter.

              La grille à deux colonnes (`flex: 1` chacune) se réduit alors à
              une seule, qui occupe toute la largeur. C'est voulu : un bloc
              « Facturé à » sur la moitié gauche avec un vide à droite se lirait
              comme une colonne manquante. */}
          {!enTete && (
            <View style={styles.party}>
              <Text style={styles.label}>Émetteur</Text>
              <Text style={styles.partyName}>{company.legalName}</Text>
              <Text style={styles.partyLine}>
                {company.address}
                {'\n'}
                {company.city}, {company.country}
                {company.phone ? `\n${pdfText(company.phone)}` : ''}
                {company.email ? `\n${company.email}` : ''}
                {company.niu ? `\nNIU ${company.niu}` : ''}
              </Text>
            </View>
          )}
          <View style={styles.party}>
            <Text style={styles.label}>{isQuote ? 'Destinataire' : 'Facturé à'}</Text>
            <Text style={styles.partyName}>{client.name}</Text>
            <Text style={styles.partyLine}>
              {client.email}
              {client.address ? `\n${client.address}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.dates}>
          <View style={styles.party}>
            <Text style={styles.label}>Date d&apos;émission</Text>
            <Text style={styles.partyName}>{formatDate(payload.issueDate)}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.label}>{isQuote ? 'Valable jusqu’au' : 'Échéance'}</Text>
            <Text style={styles.partyName}>{formatDate(payload.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.label, styles.colDesc]}>Désignation</Text>
          <Text style={[styles.label, styles.colQty]}>Qté</Text>
          <Text style={[styles.label, styles.colUnit]}>Prix unitaire</Text>
          <Text style={[styles.label, styles.colTotal]}>Total</Text>
        </View>

        {/* ⚠️ **L'ALTERNANCE PART DE LA DEUXIÈME RANGÉE** (`index % 2 === 1`) :
            la première reste blanche, sous le filet de l'en-tête. Teinter
            celle-ci la collerait visuellement à l'en-tête, qui porte déjà son
            propre fond dans l'aperçu. */}
        {payload.lines.map((line, index) => (
          <View
            key={index}
            style={index % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}
            wrap={false}
          >
            <Text style={styles.colDesc}>{line.description}</Text>
            <Text style={[styles.colQty, { color: INK_2 }]}>
              {pdfText(formatQuantity(line.quantity))}
            </Text>
            <Text style={[styles.colUnit, { color: INK_2 }]}>
              {pdfText(formatAmount(line.unitPrice))}
            </Text>
            <Text style={[styles.colTotal, { fontFamily: 'Helvetica-Bold' }]}>
              {pdfText(formatAmount(line.total))}
            </Text>
          </View>
        ))}

        {/* Le bord bas du tableau. Il remplace les dix filets de rangée
            retirés : un seul trait ferme le bloc, au lieu d'en cloisonner
            chaque ligne. */}
        <View style={styles.tableEnd} />

        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            {/* ⚠️ **Le contenu vient de `totalsBlock`, comme les quatre rendus
                à l'écran.** Le PDF est la pièce que le client garde : s'il
                annonçait autre chose que l'aperçu, c'est lui qui ferait foi
                et l'aperçu qui aurait menti. */}
            {bloc.rows.map((row) => (
              <View key={row.label} style={styles.totalsRow}>
                <Text style={{ color: INK_2 }}>{row.label}</Text>
                <Text>{money(row.amount)}</Text>
              </View>
            ))}
            <View style={styles.totalsRowStrong}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{bloc.totalLabel}</Text>
              <Text style={styles.grand}>{money(bloc.totalAmount)}</Text>
            </View>
            {bloc.mention !== null && (
              <View style={styles.totalsRow}>
                <Text style={{ color: INK_2 }}>{bloc.mention}</Text>
              </View>
            )}

            {payload.amountPaid > 0 && (
              <>
                <View style={[styles.totalsRow, { marginTop: 8 }]}>
                  <Text style={{ color: INK_2 }}>Déjà encaissé</Text>
                  <Text style={{ color: '#0B5C43' }}>-{money(payload.amountPaid)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: INK_2 }}>Reste dû</Text>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>{money(payload.balanceDue)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {hasPayment && (
          <View style={styles.payment} wrap={false}>
            <Text style={styles.label}>Règlement</Text>
            <View style={styles.paymentGrid}>
              {company.bankName && (
                <View style={styles.paymentItem}>
                  <Text style={styles.paymentKey}>Banque</Text>
                  <Text style={{ color: INK_2 }}>{company.bankName}</Text>
                </View>
              )}
              {company.bankAccount && (
                <View style={styles.paymentItem}>
                  <Text style={styles.paymentKey}>Compte</Text>
                  <Text style={{ color: INK_2 }}>{pdfText(company.bankAccount)}</Text>
                </View>
              )}
              {company.momoMtn && (
                <View style={styles.paymentItem}>
                  <Text style={styles.paymentKey}>MTN MoMo</Text>
                  <Text style={{ color: INK_2 }}>{pdfText(company.momoMtn)}</Text>
                </View>
              )}
              {company.momoOrange && (
                <View style={styles.paymentItem}>
                  <Text style={styles.paymentKey}>Orange Money</Text>
                  <Text style={{ color: INK_2 }}>{pdfText(company.momoOrange)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {payload.notes && <Text style={styles.notes}>{payload.notes}</Text>}

        {/* ⚠️ **LA PAGINATION SURVIT TOUJOURS, MÊME SANS LIGNE LÉGALE.** Une
            facture de trois feuilles dont on ne sait pas laquelle est la
            deuxième n'est pas une facture : la numérotation des pages n'est pas
            une mention légale, c'est ce qui rend le document manipulable. Seule
            l'identification de l'émetteur se retire, et seulement si
            l'entreprise a décidé que son papier la portait. */}
        <Text
          style={piedStyle}
          render={({ pageNumber, totalPages }) => {
            const pages = `Page ${pageNumber}/${totalPages}`;
            if (!pied) return pages;
            return pdfText(
              `${company.legalName} · ${company.city}, ${company.country}` +
                (company.rccm ? ` · RCCM ${company.rccm}` : '') +
                (company.niu ? ` · NIU ${company.niu}` : '') +
                `  —  ${pages}`,
            );
          }}
          fixed
        />
      </Page>
    </Document>
  );
}
