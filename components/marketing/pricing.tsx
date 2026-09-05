import { Check } from 'lucide-react';
import { CtaButton } from './cta-button';
import styles from './pricing.module.css';

interface Plan {
  name: string;
  price: string;
  unit: string;
  pitch: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Découverte',
    price: '0',
    unit: 'FCFA',
    pitch: 'De quoi éprouver l’outil sur vos premières factures, sans rien engager.',
    features: ['5 factures par mois', 'Devis illimités', 'Modèle PDF avec vos mentions légales'],
    cta: 'Créer mon compte',
  },
  {
    name: 'Pro',
    price: '5 000',
    unit: 'FCFA / mois',
    pitch: 'Pour l’indépendant ou l’artisan qui facture toutes les semaines.',
    features: [
      'Factures et devis illimités',
      'TVA et échéances automatiques',
      'Suivi des encaissements et des retards',
      'Relances par email',
    ],
    cta: 'Choisir Pro',
    featured: true,
  },
  {
    name: 'Entreprise',
    price: '15 000',
    unit: 'FCFA / mois',
    pitch: 'Pour une équipe qui partage le même carnet de clients.',
    features: [
      'Jusqu’à 5 utilisateurs',
      'Tableau de bord et encours par ancienneté',
      'Export comptable',
      'Support prioritaire',
    ],
    cta: 'Choisir Entreprise',
  },
];

/**
 * Grille tarifaire.
 *
 * Les prix sont en FCFA et sans centimes, comme partout ailleurs dans le
 * produit. Ils portent des chiffres tabulaires : trois montants alignés dans
 * trois colonnes doivent se comparer d'un coup d'œil.
 */
export function Pricing() {
  return (
    <>
      <div className={styles.grid}>
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`${styles.plan} ${plan.featured ? styles.featured : ''}`}
          >
            {plan.featured && <span className={styles.ribbon}>Le plus choisi</span>}

            <p className={styles.name}>{plan.name}</p>
            <p className={styles.price}>
              {plan.price}
              <span className={styles.unit}>{plan.unit}</span>
            </p>
            <p className={styles.pitch}>{plan.pitch}</p>

            <ul className={styles.features}>
              {plan.features.map((feature) => (
                <li key={feature} className={styles.feature}>
                  <Check className={styles.check} size={16} strokeWidth={2.6} aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            <CtaButton
              href="/inscription"
              variant={plan.featured ? 'primary' : 'secondary'}
              showIcon={false}
              block
            >
              {plan.cta}
            </CtaButton>
          </div>
        ))}
      </div>

      <p className={styles.note}>
        Sans engagement, sans carte bancaire. Vous changez de formule ou vous arrêtez quand vous
        voulez.
      </p>
    </>
  );
}
