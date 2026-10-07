import { Check, Clock } from 'lucide-react';
import { CtaButton } from './cta-button';
import { PLANS, planSignupHref } from '@/lib/plans';
import { formatAmount } from '@/lib/money';
import styles from './pricing.module.css';

/**
 * Grille tarifaire.
 *
 * Les prix sont en FCFA et sans centimes, comme partout ailleurs dans le
 * produit. Ils portent des chiffres tabulaires : trois montants alignés dans
 * trois colonnes doivent se comparer d'un coup d'œil.
 *
 * ⚠️ **Les formules viennent de `lib/plans.ts`, plus de ce fichier.** Elles y
 * étaient en dur, et l'application en avait besoin de son côté : deux copies
 * auraient fini par annoncer un prix sur la page d'accueil et en réclamer un
 * autre à la caisse.
 *
 * ⚠️ **Chaque bouton porte désormais sa formule** — `?plan=pro`. Les trois
 * pointaient vers `/inscription` tout court : cliquer « Choisir Pro » ou
 * « Créer mon compte » menait exactement au même endroit, et le choix était
 * perdu à la seconde où on le faisait.
 */
export function Pricing() {
  return (
    <>
      <div className={styles.grid}>
        {PLANS.map((plan) => (
          <div
            key={plan.code}
            className={`${styles.plan} ${plan.featured ? styles.featured : ''}`}
          >
            {plan.featured && <span className={styles.ribbon}>Le plus choisi</span>}

            <p className={styles.name}>{plan.name}</p>
            <p className={styles.price}>
              {formatAmount(plan.monthlyPrice)}
              <span className={styles.unit}>
                {plan.monthlyPrice === 0 ? 'FCFA' : 'FCFA / mois'}
              </span>
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

            {/* ⚠️ **CE QUI N’EST PAS ENCORE LIVRÉ EST DIT, PAS CACHÉ — et surtout
                pas coché.** Trois arguments étaient annoncés ici avec la même
                coche verte que les fonctions réelles, sans aucune
                implémentation derrière. La distinction ne repose PAS sur la
                couleur (§6.2, règle 5) : elle tient à l’icône d’horloge et au
                mot « à venir », qui survivent au noir et blanc. */}
            {plan.upcoming.length > 0 && (
              <ul className={styles.upcoming}>
                {plan.upcoming.map((feature) => (
                  <li key={feature} className={styles.soon}>
                    <Clock className={styles.clock} size={16} strokeWidth={2.6} aria-hidden />
                    <span>
                      {feature} <span className={styles.badge}>à venir</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <CtaButton
              href={planSignupHref(plan.code)}
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
