import type { CSSProperties } from 'react';
import { RevealGroup } from './reveal';
import styles from './app-preview.module.css';

/**
 * Aperçu du produit, sous le héros.
 *
 * Les chiffres sont ceux du **contrôle chiffré de référence** du projet —
 * 2 × 500 000 + 750 000 + 3 × 120 000 = 2 110 000 HT, TVA 19,25 % = 406 175,
 * TTC = 2 516 175. Inventer des montants ici aurait produit une TVA fausse sur
 * la première page que voit un prospect, dans un produit dont c'est justement
 * l'argument.
 *
 * **La maquette se construit au défilement**, morceau par morceau : la barre du
 * navigateur, puis le formulaire à gauche, puis le document à droite. L'ordre
 * n'est pas décoratif — il raconte le geste réel, on saisit à gauche et le
 * document se compose à droite.
 */

/** Rang dans l'échelonnement. Une seule fonction pour ne pas semer des styles. */
const rang = (index: number) => ({ '--reveal-index': index }) as CSSProperties;

export function AppPreview() {
  return (
    <RevealGroup className={styles.reveal}>
      <div className={styles.frame} data-reveal style={rang(0)}>
        <div className={styles.chrome} data-reveal style={rang(1)}>
          <span className={styles.dots} aria-hidden>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
          <span className={styles.url}>xn-facture.app/factures/FAC-2026-0024</span>
          <span className={styles.chip}>Envoyée</span>
        </div>

        <div className={styles.body}>
          <div className={styles.panel} data-reveal style={rang(2)}>
            <p className={styles.panelTitle}>Informations de la facture</p>

            <div className={styles.field} data-reveal style={rang(3)}>
              <span className={styles.label}>Client</span>
              <div className={styles.value}>Sotrabat Sarl — Douala</div>
            </div>

            <div className={`${styles.field} ${styles.pair}`} data-reveal style={rang(4)}>
              <div>
                <span className={styles.label}>Émission</span>
                <div className={styles.value}>04/09/2026</div>
              </div>
              <div>
                <span className={styles.label}>Échéance</span>
                <div className={styles.value}>04/10/2026</div>
              </div>
            </div>

            <div className={styles.field} data-reveal style={rang(5)}>
              <span className={styles.label}>Prestation</span>
              <div className={styles.value}>Aménagement d’atelier — lot 2</div>
            </div>
          </div>

          <div className={styles.doc} data-reveal style={rang(4)}>
            <div className={styles.docHead} data-reveal style={rang(5)}>
              <div>
                <p className={styles.docNumber}>FAC-2026-0024</p>
                <p className={styles.docIssuer}>Atelier Nkolo Sarl · NIU M071812345678X</p>
              </div>
              <div>
                <p className={styles.docTotalLabel}>Total TTC</p>
                <p className={styles.docTotal}>2 516 175 FCFA</p>
              </div>
            </div>

            <div className={styles.lines}>
              <div className={styles.line} data-reveal style={rang(6)}>
                <span className={styles.lineLabel}>Sous-total HT</span>
                <span className={styles.lineValue}>2 110 000 FCFA</span>
              </div>
              <div className={styles.line} data-reveal style={rang(7)}>
                <span className={styles.lineLabel}>TVA 19,25 %</span>
                <span className={styles.lineValue}>406 175 FCFA</span>
              </div>
              <div
                className={`${styles.line} ${styles.lineTotal}`}
                data-reveal
                style={rang(8)}
              >
                <span className={styles.lineLabel}>Total TTC</span>
                <span className={styles.lineValue}>2 516 175 FCFA</span>
              </div>
            </div>

            <div className={styles.docActions} data-reveal style={rang(9)}>
              <span className={styles.docPrimary}>Télécharger le PDF</span>
              <span className={styles.docSecondary}>Envoyer</span>
            </div>
          </div>
        </div>
      </div>
    </RevealGroup>
  );
}
