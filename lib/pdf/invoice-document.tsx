import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatDate } from '@/lib/format';
import { formatAmount, formatMoney, formatQuantity } from '@/lib/money';
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
const BRAND = '#CE4A14';

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
  // Les coordonnées de règlement n'ont pas leur place sur un devis : elles
  // inviteraient à payer une somme qui n'est pas encore due.
  const hasPayment =
    !isQuote &&
    Boolean(company.bankName || company.bankAccount || company.momoMtn || company.momoOrange);
  const docLabel = isQuote ? 'Devis' : 'Facture';

  return (
    <Document
      title={payload.number ?? docLabel}
      author={company.legalName}
      subject={`${docLabel} ${company.legalName} — ${client.name}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Filigrane : rendu en PREMIER pour que tout le contenu passe
            par-dessus, et `fixed` pour qu'il se répète à chaque page. Absent
            si l'entreprise n'a pas encore de logo — pas de repli textuel ici,
            deux lettres géantes en fond ne ressembleraient à rien. */}
        {company.logoDataUrl && (
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
          {company.logoDataUrl ? (
            // `Image` vient de @react-pdf : c'est une primitive de dessin PDF,
            // pas une balise HTML, et elle n'accepte pas d'attribut `alt`. La
            // règle jsx-a11y ne s'applique donc pas ici.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={company.logoDataUrl} style={styles.logo} />
          ) : (
            <Text style={styles.logoFallback}>{company.name.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>

        <View style={styles.parties}>
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
            <View style={styles.totalsRow}>
              <Text style={{ color: INK_2 }}>Sous-total HT</Text>
              <Text>{money(payload.subtotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={{ color: INK_2 }}>
                TVA {payload.vatRate.toString().replace('.', ',')} %
              </Text>
              <Text>{money(payload.vatAmount)}</Text>
            </View>
            <View style={styles.totalsRowStrong}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Total TTC</Text>
              <Text style={styles.grand}>{money(payload.total)}</Text>
            </View>

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

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            pdfText(
              `${company.legalName} · ${company.city}, ${company.country}` +
                (company.rccm ? ` · RCCM ${company.rccm}` : '') +
                (company.niu ? ` · NIU ${company.niu}` : '') +
                `  —  Page ${pageNumber}/${totalPages}`,
            )
          }
          fixed
        />
      </Page>
    </Document>
  );
}
