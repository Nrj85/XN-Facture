import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/marketing/legal-page';
import { PLANS, planMonthsFree, planPriceLabel, planYearlyLabel } from '@/lib/plans';

/**
 * ⚠️ **LES PRIX SONT LUS DANS `lib/plans.ts`, JAMAIS RECOPIÉS ICI.** C'est la
 * règle de la source unique du §5, et elle compte davantage dans un contrat
 * que partout ailleurs : un tarif écrit en dur deviendrait une **seconde
 * vérité**, et le jour où la grille changerait, les conditions générales
 * annonceraient un prix que la caisse ne pratique plus. Un document qui ment
 * sur le prix est pire qu'un document absent.
 *
 * ⚠️ **ET ON NE REND QUE `features`, JAMAIS `upcoming`.** La séparation des
 * deux champs a été conçue pour qu'un rendu qui ignore `upcoming` n'affiche
 * que ce qui existe. Sur la page qui vend, promettre une fonction absente est
 * une faute ; **dans un contrat, c'en est une autre** — on s'engagerait à
 * fournir ce qu'on n'a pas.
 *
 * ⚠️ **La page doit rester STATIQUE (`○ /conditions` au build).** `lib/plans`
 * ne contient que des constantes et des fonctions pures : aucun `cookies()`,
 * donc rien qui force le rendu à la requête.
 */

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description:
    'Les règles d’usage du service XN-Facture : ce que nous fournissons, ce que vous restez seul à garantir, et comment le contrat prend fin.',
};

export default function ConditionsPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      updated="9 octobre 2026"
      lead="Ce que XN-Facture s’engage à faire, ce qui reste de votre ressort, et ce qui se passe le jour où vous partez."
    >
      <LegalSection title="1. Objet">
        <p>
          XN-Facture met à disposition un outil en ligne de création et de suivi de factures et
          de devis, libellés en francs CFA. En créant un compte, vous acceptez ces conditions.
        </p>
      </LegalSection>

      <LegalSection title="2. Le compte">
        <ul>
          <li>Vous devez fournir une adresse email valide et des informations exactes.</li>
          <li>
            Vous êtes responsable de la confidentialité de votre mot de passe et de tout ce qui
            se fait depuis votre compte.
          </li>
          <li>Un compte est nominatif. Il ne se revend pas et ne se prête pas.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Ce que vous restez seul à garantir">
        <p>
          Ce point est le plus important du document, et il n’est pas une clause de style.
        </p>
        <p>
          L’application calcule, met en forme et conserve. Elle ne vérifie ni la véracité, ni la
          conformité fiscale de ce que vous y saisissez. <strong>Vous restez seul responsable</strong> :
        </p>
        <ul>
          <li>de l’exactitude de votre NIU, de votre RCCM et de vos mentions légales ;</li>
          <li>du taux de TVA que vous appliquez et de son adéquation à votre régime ;</li>
          <li>de la réalité des prestations facturées ;</li>
          <li>de vos déclarations auprès de l’administration fiscale.</li>
        </ul>
        <p>
          Le taux de 19,25 % proposé par défaut est celui du régime camerounais courant. Il vous
          appartient de vérifier qu’il s’applique bien à votre activité.
        </p>
      </LegalSection>

      <LegalSection title="4. Usages interdits">
        <ul>
          <li>Émettre des factures pour des prestations fictives.</li>
          <li>Usurper l’identité ou les mentions légales d’une autre entreprise.</li>
          <li>Tenter d’accéder aux données d’un autre compte, ou d’en éprouver les limites sans autorisation écrite.</li>
          <li>Automatiser des requêtes au point de dégrader le service pour les autres.</li>
        </ul>
        <p>
          Un manquement à ces règles entraîne la suspension du compte, sans préavis lorsque la
          gravité le justifie.
        </p>
      </LegalSection>

      <LegalSection title="5. Disponibilité">
        <p>
          Nous faisons de notre mieux pour que le service reste joignable, sans nous engager sur
          un taux de disponibilité chiffré. Des interruptions peuvent survenir : maintenance,
          panne d’un hébergeur, incident réseau.
        </p>
        <p>
          <strong>Exportez régulièrement vos documents en PDF.</strong> C’est votre filet de
          sécurité, et le conseil vaut pour n’importe quel service en ligne.
        </p>
      </LegalSection>

      <LegalSection id="abonnement" title="6. Abonnement, tarifs et paiement">
        <p>
          Ce chapitre décrit un fonctionnement inhabituel, et c’est voulu :{' '}
          <strong>
            nous ne prélevons rien sur votre compte, et aucun abonnement ne se renouvelle tout
            seul.
          </strong>{' '}
          Le mobile money ne sait pas prélever. Chaque période est donc un paiement que{' '}
          <em>vous</em> décidez de faire, ou de ne pas faire.
        </p>

        <p>
          <strong>6.1 Les formules et leurs prix</strong>
        </p>
        <ul>
          {PLANS.map((formule) => {
            const annuel = planYearlyLabel(formule);
            const offerts = planMonthsFree(formule);
            return (
              <li key={formule.code}>
                <strong>{formule.name}</strong> — {planPriceLabel(formule)}
                {annuel !== null && (
                  <>
                    , ou {annuel}
                    {offerts > 0 && ` (soit ${offerts} mois offerts sur douze)`}
                  </>
                )}
                .
              </li>
            );
          })}
        </ul>
        <p>
          Les montants sont exprimés en francs CFA, sans centimes. Ils sont ceux affichés sur la{' '}
          <Link href="/#tarifs">grille tarifaire</Link> au jour de votre commande.
        </p>

        <p>
          <strong>6.2 Ce que chaque formule ouvre</strong>
        </p>
        <p>
          Les listes ci-dessous sont limitatives : <strong>elles ne comportent que des
          fonctions déjà disponibles</strong>. Une fonction annoncée comme « à venir » sur nos
          pages ne fait pas partie de ce contrat tant qu’elle n’y figure pas.
        </p>
        {PLANS.map((formule) => (
          <div key={formule.code}>
            <p>
              <strong>{formule.name}</strong>
            </p>
            <ul>
              {formule.features.map((ligne) => (
                <li key={ligne}>{ligne}</li>
              ))}
            </ul>
          </div>
        ))}
        <p>
          Le <strong>support prioritaire</strong> de la formule Entreprise signifie que vos
          demandes sont traitées avant les autres. Il ne s’accompagne pas d’un délai de réponse
          chiffré, pour la même raison que le point 5 : nous ne nous engageons pas sur ce que
          nous ne pouvons pas garantir.
        </p>

        <p>
          <strong>6.3 Durée, et absence de renouvellement automatique</strong>
        </p>
        <ul>
          <li>
            Une période payée vous ouvre la formule <strong>jusqu’à une date précise</strong>,
            affichée sur votre page Abonnement.
          </li>
          <li>
            <strong>Il n’y a ni prélèvement, ni reconduction tacite.</strong> À l’échéance,
            rien n’est débité et rien n’est prolongé : la formule redescend simplement en
            Découverte.
          </li>
          <li>
            Nous vous prévenons par email <strong>sept jours avant, la veille, et le jour même</strong>{' '}
            de l’échéance, afin que l’échéance ne vous surprenne pas.
          </li>
        </ul>
        <p>
          C’est pourquoi vous ne trouverez nulle part de bouton « résilier » :{' '}
          <strong>il n’y a aucun engagement à rompre</strong>. Ne pas renouveler suffit.
        </p>

        <p>
          <strong>6.4 Comment le règlement s’effectue</strong>
        </p>
        <ul>
          <li>
            Vous choisissez une formule et une périodicité depuis votre page Abonnement. Vous
            recevez alors une <strong>référence de commande</strong> (par exemple{' '}
            <span className="tabular">XN-PRO-A3F91C</span>).
          </li>
          <li>
            Vous réglez par les moyens indiqués sur cet écran — mobile money, ou le lien de
            paiement qui vous est proposé. <strong>Rappelez toujours la référence</strong> : elle
            est le seul lien entre votre versement et votre compte.
          </li>
          <li>
            <strong>Une commande n’est pas un paiement.</strong> La formule s’ouvre lorsque le
            règlement est constaté, ce qui peut demander un délai. Tant qu’il ne l’est pas, votre
            compte reste sur sa formule précédente.
          </li>
          <li>
            Un versement reçu sans référence identifiable ne peut pas être rattaché
            automatiquement. Écrivez-nous à{' '}
            <a href="mailto:contact@xn-facture.com">contact@xn-facture.com</a> avec la preuve du
            paiement : nous le rattacherons.
          </li>
        </ul>

        <p>
          <strong>6.5 Ce qui se passe à l’échéance — rien ne ferme</strong>
        </p>
        <p>
          C’est l’engagement le plus important de ce chapitre.{' '}
          <strong>
            Vos factures sont votre comptabilité : nous ne vous en coupons jamais l’accès.
          </strong>{' '}
          À l’expiration d’une formule payante :
        </p>
        <ul>
          <li>
            votre compte, vos clients, vos factures et vos devis{' '}
            <strong>restent intacts et consultables</strong> ;
          </li>
          <li>
            le <strong>téléchargement des PDF reste ouvert</strong>, y compris pour les
            documents émis pendant la période payante ;
          </li>
          <li>les devis restent illimités ;</li>
          <li>
            seule <strong>l’émission de nouvelles factures</strong> retrouve le plafond de la
            formule Découverte, et le réglage du papier à en-tête se verrouille — un en-tête déjà
            enregistré continue toutefois d’être imprimé sur vos documents.
          </li>
        </ul>
        <p>
          Reprendre une formule payante lève ces limites immédiatement, sans rien vous faire
          ressaisir.
        </p>

        <p>
          <strong>6.6 Déclarer que vous ne renouvellerez pas</strong>
        </p>
        <p>
          Vous pouvez le déclarer à tout moment depuis votre page Abonnement. Cela{' '}
          <strong>n’avance pas votre échéance</strong> : ce que vous avez payé vous reste dû
          jusqu’au terme. Les rappels d’échéance cessent, et la déclaration se défait d’un clic
          si vous changez d’avis.
        </p>

        <p>
          <strong>6.7 Remboursement</strong>
        </p>
        <p>
          L’accès est ouvert dès le paiement constaté et s’exécute en continu.{' '}
          <strong>Une période entamée n’est pas remboursée.</strong> Si une période a été réglée
          par erreur et n’a pas commencé, écrivez-nous : nous la remboursons ou la reportons.
        </p>
        <p>
          En cas d’interruption du service de notre fait, durable et imputable à nous seuls, nous
          prolongeons votre échéance d’autant.
        </p>

        <p>
          <strong>6.8 Changement de tarif</strong>
        </p>
        <ul>
          <li>La formule Découverte est gratuite et le restera.</li>
          <li>
            Une hausse de tarif est annoncée <strong>au moins 30 jours à l’avance</strong>.
          </li>
          <li>
            Elle ne s’applique <strong>jamais</strong> à une période déjà réglée. Comme rien ne se
            renouvelle automatiquement, un nouveau tarif ne peut vous être appliqué qu’au moment
            où vous décidez vous-même de repayer.
          </li>
          <li>
            Le tarif annuel est payé d’avance ; une hausse survenue en cours d’année ne le remet
            pas en cause.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Vos données vous appartiennent">
        <p>
          Le contenu que vous saisissez — clients, factures, devis — reste votre propriété.
          Nous ne l’exploitons pas à d’autres fins que celles décrites dans la{' '}
          <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation de responsabilité">
        <p>
          Notre responsabilité ne peut être engagée pour un préjudice indirect : perte de
          chiffre d’affaires, perte de clientèle, atteinte à l’image. En cas de dommage direct
          imputable au service, notre responsabilité est plafonnée aux sommes que vous nous avez
          versées au cours des douze derniers mois.
        </p>
      </LegalSection>

      <LegalSection title="9. Fin du contrat">
        <p>
          Vous pouvez fermer votre compte à tout moment. Nous pouvons le suspendre en cas de
          manquement aux règles du point 4, ou fermer le service moyennant un préavis de 90
          jours — délai prévu pour vous laisser exporter l’ensemble de vos documents.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit applicable">
        <p>
          Ces conditions sont régies par le droit camerounais. Tout différend sera d’abord
          traité à l’amiable ; à défaut d’accord, les tribunaux compétents seront ceux du siège
          de l’éditeur.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
