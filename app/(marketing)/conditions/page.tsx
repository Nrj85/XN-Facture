import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description:
    'Les règles d’usage du service XN-Facture : ce que nous fournissons, ce que vous restez seul à garantir, et comment le contrat prend fin.',
};

export default function ConditionsPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      updated="5 septembre 2026"
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

      <LegalSection title="6. Tarifs">
        <ul>
          <li>La formule Découverte est gratuite et le restera.</li>
          <li>Les formules payantes sont sans engagement, résiliables à tout moment.</li>
          <li>
            Une hausse de tarif est annoncée au moins 30 jours à l’avance ; elle ne s’applique
            jamais à une période déjà réglée.
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
