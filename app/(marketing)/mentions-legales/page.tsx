import type { Metadata } from 'next';
import { LegalPage, LegalSection, LegalTable } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Éditeur, hébergement et propriété intellectuelle du service XN-Facture.',
};

/**
 * Mentions légales.
 *
 * ⚠️ Les champs d'identification de l'éditeur — raison sociale, NIU, RCCM,
 * adresse, représentant légal — sont laissés en **espaces réservés visibles**.
 * Y inventer une immatriculation serait exactement la faute que le produit
 * apprend à ses utilisateurs à ne pas commettre. Ils sont rassemblés dans un
 * seul tableau, pour qu'il n'y ait qu'un endroit à remplir.
 *
 * ⚠️ **Tout ce qui n'est pas entre crochets décrit l'infrastructure RÉELLE** :
 * les sous-traitants nommés sont ceux réellement employés, et la localisation
 * des données est celle réellement configurée. Décrire un traitement qui
 * n'existe pas serait pire que de ne rien écrire.
 *
 * Les questions à poser au juriste sont dans
 * `docs/mentions-legales-questions-juriste.md`, hors de cette page : elles
 * s'adressent au relecteur, pas au visiteur.
 */
export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      updated="17 septembre 2026"
      lead="Informations relatives à l’éditeur du site et du service XN-Facture, à son hébergement et aux droits qui s’y attachent."
    >
      <LegalSection title="1. Identification de l’éditeur">
        <p>
          <strong>À COMPLÉTER avant l’ouverture au public.</strong> Ces champs dépendent de
          l’immatriculation réelle de la structure et ne peuvent pas être renseignés d’avance.
          Un produit qui impose le NIU et le RCCM sur chaque facture ne peut pas en inventer
          pour lui-même.
        </p>
        <LegalTable>
          <tbody>
            <tr><th scope="row">Dénomination sociale</th><td>[à compléter]</td></tr>
            <tr><th scope="row">Forme juridique</th><td>[à compléter — SARL, SA, établissement, entreprise individuelle…]</td></tr>
            <tr><th scope="row">Capital social</th><td>[à compléter, en FCFA]</td></tr>
            <tr><th scope="row">Siège social</th><td>[à compléter — adresse complète, ville, Cameroun]</td></tr>
            <tr><th scope="row">Numéro d’identifiant unique (NIU)</th><td>[à compléter]</td></tr>
            <tr><th scope="row">Registre du commerce (RCCM)</th><td>[à compléter — numéro et greffe d’immatriculation]</td></tr>
            <tr><th scope="row">Représentant légal</th><td>[à compléter — nom et qualité]</td></tr>
            <tr><th scope="row">Directeur de la publication</th><td>[à compléter]</td></tr>
            <tr><th scope="row">Téléphone</th><td>[à compléter]</td></tr>
            <tr><th scope="row">Adresse électronique</th><td><a href="mailto:contact@xn-facture.com">contact@xn-facture.com</a></td></tr>
          </tbody>
        </LegalTable>
        <p>
          L’éditeur exploite le service de facturation en ligne accessible à l’adresse{' '}
          <strong>www.xn-facture.com</strong>, destiné aux entrepreneurs et petites structures,
          avec le Cameroun et la zone CEMAC comme marché principal.
        </p>
      </LegalSection>

      <LegalSection title="2. Hébergement et sous-traitants techniques">
        <p>
          Le service ne dispose pas de serveurs propres. Il s’appuie sur quatre prestataires,
          dont voici la liste complète et le rôle exact. Aucun autre n’a accès aux données.
        </p>
        <LegalTable>
          <thead>
            <tr>
              <th scope="col">Prestataire</th>
              <th scope="col">Rôle</th>
              <th scope="col">Localisation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Vercel Inc.</strong><br />340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</td>
              <td>Hébergement et distribution de l’application</td>
              <td>États-Unis, avec diffusion par réseau mondial</td>
            </tr>
            <tr>
              <td><strong>Supabase</strong></td>
              <td>Base de données et authentification — c’est ici que résident vos factures, vos devis et vos clients</td>
              <td><strong>Irlande</strong> (région <code>eu-west-1</code>)</td>
            </tr>
            <tr>
              <td><strong>Resend</strong></td>
              <td>Acheminement des courriers électroniques du service : confirmation d’adresse, réinitialisation de mot de passe, avis d’échéance</td>
              <td>Union européenne (Irlande)</td>
            </tr>
            <tr>
              <td><strong>LWS</strong></td>
              <td>Enregistrement du nom de domaine et gestion de la zone DNS</td>
              <td>France</td>
            </tr>
          </tbody>
        </LegalTable>
        <p>
          <strong>Les données de facturation sont donc conservées en Irlande</strong>, et non au
          Cameroun. Cette information figure ici parce qu’elle est susceptible d’intéresser
          l’utilisateur avant qu’il ne confie sa comptabilité au service, et non parce qu’une
          obligation l’imposerait.
        </p>
      </LegalSection>

      <LegalSection title="3. Propriété intellectuelle">
        <p>
          La dénomination XN-Facture, le nom de domaine, la charte graphique, les textes,
          l’interface et le code de l’application sont la propriété de l’éditeur. Toute
          reproduction, adaptation ou diffusion, totale ou partielle, sans autorisation écrite
          préalable, est interdite.
        </p>
        <p>
          <strong>Les contenus que vous saisissez restent les vôtres.</strong> Vos clients, vos
          factures, vos devis, vos paramètres et votre logo ne nous appartiennent à aucun titre.
          L’éditeur n’en acquiert aucun droit d’exploitation, ne les revend pas et ne les
          communique à aucun tiers en dehors des sous-traitants techniques énumérés ci-dessus.
        </p>
        <p>
          Les documents que vous produisez — factures et devis au format PDF — sont vos pièces
          comptables. Vous pouvez les télécharger à tout moment, y compris après la fin de votre
          abonnement.
        </p>
      </LegalSection>

      <LegalSection title="4. Données à caractère personnel">
        <p>
          Le traitement des données personnelles, les finalités poursuivies, les durées de
          conservation et les moyens d’exercer vos droits sont décrits dans la{' '}
          <a href="/confidentialite">politique de confidentialité</a>, qui fait partie
          intégrante des présentes mentions.
        </p>
        <p>
          En deux mots : chaque entreprise ne voit que ses propres données, et cette séparation
          est appliquée par la base de données elle-même, non par l’interface.
        </p>
      </LegalSection>

      <LegalSection title="5. Cookies">
        <p>
          Le site ne dépose <strong>aucun cookie publicitaire, aucun traceur de mesure
          d’audience tiers et aucun outil de profilage</strong>.
        </p>
        <p>Deux cookies seulement sont utilisés, tous deux strictement nécessaires :</p>
        <ul>
          <li>
            <strong>Le cookie de session</strong>, qui vous maintient connecté d’une page à
            l’autre. Il disparaît à la déconnexion.
          </li>
          <li>
            <strong>Le cookie de langue</strong> (<code>xn-langue</code>), qui retient si vous
            avez choisi l’interface française ou anglaise.
          </li>
        </ul>
        <p>
          Étant indispensables au fonctionnement du service, ils ne requièrent pas de
          consentement préalable.
        </p>
      </LegalSection>

      <LegalSection title="6. Disponibilité du service">
        <p>
          L’éditeur met en œuvre les moyens raisonnables pour assurer la disponibilité du
          service, sans pouvoir la garantir de façon absolue : des interruptions peuvent
          survenir du fait de la maintenance, d’une défaillance d’un prestataire ou d’un
          événement indépendant de sa volonté. Les conditions applicables en pareil cas figurent
          dans les <a href="/conditions">conditions générales d’utilisation</a>.
        </p>
      </LegalSection>

      <LegalSection title="7. Droit applicable et règlement des litiges">
        <p>
          Les présentes mentions sont régies par le droit camerounais. En cas de différend, les
          parties s’efforceront de trouver une solution amiable avant toute action contentieuse ;
          à défaut, les tribunaux compétents seront ceux du ressort du siège social de
          l’éditeur.
        </p>
      </LegalSection>

      <LegalSection title="8. Signaler un problème">
        <p>
          Pour signaler un contenu illicite, une erreur dans ces mentions ou toute difficulté
          liée au service, écrivez à{' '}
          <a href="mailto:contact@xn-facture.com">contact@xn-facture.com</a>.
        </p>
        <p>
          <strong>Les failles de sécurité sont traitées en priorité.</strong> Si vous en
          découvrez une, signalez-la à cette même adresse plutôt que de la rendre publique : une
          divulgation immédiate exposerait les données des utilisateurs avant qu’un correctif
          n’existe.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
