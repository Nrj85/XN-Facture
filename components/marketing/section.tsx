import styles from './section.module.css';

/**
 * Enveloppe commune à toutes les sections de la landing.
 *
 * `tone` alterne les fonds — papier, blanc, sable — pour séparer les sections
 * sans tracer de filet. L'alternance est décidée par la page, pas par la
 * section : c'est la page qui connaît ses voisines.
 */
export function Section({
  id,
  tone = 'paper',
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id?: string;
  tone?: 'paper' | 'surface' | 'sand';
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const fond = tone === 'surface' ? styles.tinted : tone === 'sand' ? styles.sand : '';

  return (
    <section id={id} className={`${styles.section} ${fond}`}>
      <div className={styles.inner}>
        {(eyebrow || title || subtitle) && (
          <header className={styles.head}>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            {title && <h2 className={styles.title}>{title}</h2>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
