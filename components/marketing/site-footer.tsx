import Link from 'next/link';
import { CtaButton } from './cta-button';
import styles from './site-footer.module.css';

const COLONNES = [
  {
    title: 'Produit',
    links: [
      { label: 'Fonctionnalités', href: '#fonctionnalites' },
      { label: 'Comment ça marche', href: '#etapes' },
      { label: 'Tarifs', href: '#tarifs' },
    ],
  },
  {
    title: 'Commencer',
    links: [
      { label: 'Créer un compte', href: '/inscription' },
      { label: 'Se connecter', href: '/connexion' },
      { label: 'Mot de passe oublié', href: '/mot-de-passe-oublie' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Confidentialité', href: '/confidentialite' },
      { label: 'Conditions d’utilisation', href: '/conditions' },
      { label: 'Mentions légales', href: '/mentions-legales' },
    ],
  },
];

/** Appel à l'action final, sur fond encre — la seule inversion de la page. */
export function FinalCta() {
  return (
    <section className={styles.final}>
      <div className={styles.finalGlow} aria-hidden />
      <div className={styles.finalInner}>
        <h2 className={styles.finalTitle}>Votre prochaine facture peut partir aujourd’hui</h2>
        <p className={styles.finalLead}>
          Créez votre compte, renseignez votre NIU et votre RCCM une bonne fois, et facturez.
          Le reste — numérotation, TVA, échéances — se fait tout seul.
        </p>
        <CtaButton href="/inscription" pulse>
          Commencer gratuitement
        </CtaButton>
        <p className={styles.finalNote}>
          Aucune carte bancaire demandée · Vos données restent les vôtres
        </p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          <div className={styles.brandCol}>
            <Link href="/" className={styles.brand}>
              <span className={styles.mark} aria-hidden>
                XN
              </span>
              <span className={styles.wordmark}>XN-Facture</span>
            </Link>
            <p className={styles.tagline}>
              La facturation en francs CFA, pensée pour les entrepreneurs et les petites
              structures d’Afrique centrale.
            </p>
            <span className={styles.made}>Conçu au Cameroun 🇨🇲</span>
          </div>

          {COLONNES.map((colonne) => (
            <div key={colonne.title}>
              <p className={styles.colTitle}>{colonne.title}</p>
              <ul className={styles.list}>
                {colonne.links.map((lien) => (
                  <li key={lien.label}>
                    {lien.href.startsWith('#') ? (
                      <a href={lien.href} className={styles.link}>
                        {lien.label}
                      </a>
                    ) : (
                      <Link href={lien.href} className={styles.link}>
                        {lien.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          <span>© {new Date().getFullYear()} XN-Facture. Tous droits réservés.</span>
          <span>Montants en FCFA · TVA 19,25 % par défaut</span>
        </div>
      </div>
    </footer>
  );
}
