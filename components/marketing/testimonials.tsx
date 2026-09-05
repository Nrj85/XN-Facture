import styles from './testimonials.module.css';

/**
 * Témoignages.
 *
 * ⚠️ Ces trois témoignages sont des **exemples de mise en page**, pas de vrais
 * clients : le produit n'est pas encore ouvert. Ils sont à remplacer par des
 * retours réels avant la mise en ligne publique — publier des avis inventés
 * sous des noms et des villes précis serait un mensonge, pas une maquette.
 */
const AVIS = [
  {
    quote:
      'Avant, je faisais mes factures sur Word et je recalculais la TVA à la main. Là c’est fait tout seul, et mes clients me règlent plus vite parce que le document est net.',
    initials: 'AN',
    name: 'Prénom Nom',
    role: 'Atelier de menuiserie — Yaoundé',
  },
  {
    quote:
      'Ce que j’ouvre en premier le matin, c’est l’encours par ancienneté. Je sais qui relancer avant même d’avoir fini mon café.',
    initials: 'KM',
    name: 'Prénom Nom',
    role: 'Cabinet de conseil — Douala',
  },
  {
    quote:
      'Le NIU et le RCCM sont sur chaque facture sans que j’y pense. C’est exactement ce que mon comptable me réclamait chaque trimestre.',
    initials: 'FE',
    name: 'Prénom Nom',
    role: 'Prestataire indépendante — Kribi',
  },
];

export function Testimonials() {
  return (
    <div className={styles.grid}>
      {AVIS.map((avis) => (
        <figure key={avis.role} className={styles.card}>
          <blockquote className={styles.quote}>« {avis.quote} »</blockquote>
          <figcaption className={styles.author}>
            <span className={styles.avatar} aria-hidden>
              {avis.initials}
            </span>
            <span>
              <p className={styles.name}>{avis.name}</p>
              <p className={styles.role}>{avis.role}</p>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
