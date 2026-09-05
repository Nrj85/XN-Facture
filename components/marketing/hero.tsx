import { BadgeCheck, Check, FileText, Percent, Sparkles, Wallet } from 'lucide-react';
import { CtaButton } from './cta-button';
import { AppPreview } from './app-preview';
import styles from './hero.module.css';

const PREUVES = [
  'TVA calculée automatiquement',
  'Aperçu du document en direct',
  'Mentions légales NIU et RCCM',
];

/** Icônes d'ambiance. Décoratives, donc masquées sous 1100 px et `aria-hidden`. */
const FLOTTANTS = [
  { Icon: FileText, className: styles.f1 },
  { Icon: BadgeCheck, className: styles.f2 },
  { Icon: Percent, className: styles.f3 },
  { Icon: Wallet, className: styles.f4 },
];

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.glow} aria-hidden />

      <div className={styles.floaters} aria-hidden>
        {FLOTTANTS.map(({ Icon, className }, index) => (
          <span key={index} className={`${styles.floater} ${className}`}>
            <Icon size={21} strokeWidth={1.9} />
          </span>
        ))}
      </div>

      <div className={styles.inner}>
        <span className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden>
            <Sparkles size={13} strokeWidth={2.2} />
          </span>
          Pensé pour les entrepreneurs d’Afrique centrale
        </span>

        <h1 className={styles.title}>
          Fini les factures sur Word et Excel.{' '}
          <span className={styles.accent}>Facturez comme un pro.</span>
        </h1>

        <p className={styles.lead}>
          Créez une facture conforme en moins de deux minutes, en francs CFA, avec la TVA
          calculée pour vous. Puis suivez d’un coup d’œil qui vous doit quoi, et depuis
          combien de temps.
        </p>

        <div className={styles.ctas}>
          <CtaButton href="/inscription" pulse>
            Commencer gratuitement
          </CtaButton>
          <CtaButton href="#fonctionnalites" variant="secondary" showIcon={false}>
            Voir ce que ça fait
          </CtaButton>
        </div>

        <ul className={styles.proofs}>
          {PREUVES.map((preuve) => (
            <li key={preuve} className={styles.proof}>
              <Check className={styles.proofIcon} size={16} strokeWidth={2.6} aria-hidden />
              {preuve}
            </li>
          ))}
        </ul>

        <AppPreview />
      </div>
    </section>
  );
}
