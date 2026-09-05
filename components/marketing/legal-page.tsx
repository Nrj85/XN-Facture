import Link from 'next/link';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import styles from './legal-page.module.css';

/**
 * Gabarit commun aux trois pages légales.
 *
 * Un seul composant, trois jeux de contenu : ce sont des documents de texte
 * long dont la mise en page ne diffère en rien.
 *
 * L'**avertissement est obligatoire** tant que ces textes n'ont pas été relus
 * par un juriste. Publier des conditions d'utilisation en les faisant passer
 * pour un engagement validé serait pire que ne rien publier du tout.
 */
export function LegalPage({
  title,
  updated,
  lead,
  children,
}: {
  title: string;
  /** Date de dernière mise à jour, en clair. */
  updated: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <Link href="/" className={styles.back}>
          <ArrowLeft size={15} strokeWidth={2.2} aria-hidden />
          Retour à l’accueil
        </Link>

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.updated}>Dernière mise à jour : {updated}</p>
        <p className={styles.lead}>{lead}</p>

        <p className={styles.warning}>
          <TriangleAlert className={styles.warningIcon} size={18} strokeWidth={2} aria-hidden />
          <span>
            <strong>Document de travail, non validé juridiquement.</strong> Ce texte pose le
            cadre de fonctionnement réel du service, mais il n’a pas encore été relu par un
            professionnel du droit. Il doit l’être avant toute ouverture commerciale.
          </span>
        </p>

        {children}

        <div className={styles.contact}>
          <strong>Une question sur ce document ?</strong>
          <br />
          Écrivez à <a href="mailto:contact@xn-facture.cm">contact@xn-facture.cm</a>. Nous
          répondons sous cinq jours ouvrés.
        </div>
      </div>
    </div>
  );
}

/** Une section du document : un titre, du corps de texte. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

/** Tableau encadré, défilable horizontalement sur téléphone. */
export function LegalTable({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}
