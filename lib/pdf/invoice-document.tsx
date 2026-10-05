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

  tableHead: {
    flexDirection: 'row',
    marginTop: 24,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  colDesc: { flex: 1, paddingRight: 10 },
  colQty: { width: 48, textAlign: 'right' },
  colUnit: { width: 80, textAlign: 'right' },
  colTotal: { width: 88, textAlign: 'right' },

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

  // ⚠️ **LE FILIGRANE DISPARAÎT AUSSI.** Il reprend le logo en grand au centre
  // de la page : posé sous un papier à en-tête, il se bat avec le dessin de
  // l'entreprise au lieu de le servir.
  const filigrane = !enTete && company.logoDataUrl;

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

        {payload.lines.map((line, index) => (
          <View key={index} style={styles.row} wrap={false}>
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
          style={styles.footer}
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
