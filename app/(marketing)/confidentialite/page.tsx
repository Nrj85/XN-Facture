import type { Metadata } from 'next';
import { LegalPage, LegalSection, LegalTable } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Quelles données XN-Facture collecte, pourquoi, combien de temps elles sont conservées, et comment y accéder ou les supprimer.',
};

/**
 * Politique de confidentialité.
 *
 * Le contenu décrit le fonctionnement **réel** du produit, pas un texte type :
 * l'hébergement Supabase à Dublin, l'isolation par RLS, Resend pour les
 * emails, Vercel pour l'application. Décrire un traitement qui n'existe pas
 * serait une faute plus grave que de ne rien écrire.
 */
export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updated="5 septembre 2026"
      lead="Ce document explique quelles données XN-Facture conserve, pourquoi, où elles se trouvent, et comment vous en reprenez la main à tout moment."
    >
      <LegalSection title="1. Le principe">
        <p>
          XN-Facture est un outil de facturation. Nous conservons ce qu’il faut pour produire
          vos documents et vous montrer où en sont vos encaissements — <strong>rien de plus</strong>.
        </p>
        <p>
          Nous ne vendons aucune donnée, nous n’en louons aucune, et nous n’en transmettons à
          des tiers que dans les cas techniques listés au point 5.
        </p>
      </LegalSection>

      <LegalSection title="2. Les données que nous conservons">
        <p>Trois familles, et elles ne se mélangent pas :</p>
        <ul>
          <li>
            <strong>Votre compte</strong> — adresse email, mot de passe (jamais en clair : il
            est haché par le service d’authentification), date de création.
          </li>
          <li>
            <strong>Votre entreprise</strong> — raison sociale, NIU, RCCM, adresse, téléphone,
            logo, coordonnées bancaires et Mobile Money que vous choisissez de faire figurer
            sur vos documents.
          </li>
          <li>
            <strong>Votre activité</strong> — vos clients, vos factures, vos devis, vos lignes
            de prestation et vos encaissements.
          </li>
        </ul>
        <p>
          Nous ne collectons <strong>aucune donnée de navigation à des fins publicitaires</strong> :
          pas de traceur tiers, pas de régie, pas de profilage.
        </p>
      </LegalSection>

      <LegalSection title="3. Pourquoi nous les conservons">
        <ul>
          <li>
            <strong>Exécuter le service</strong> — sans vos clients et vos lignes, il n’y a pas
            de facture à produire.
          </li>
          <li>
            <strong>Vous identifier</strong> — l’email et le mot de passe servent à ouvrir votre
            session et à rien d’autre.
          </li>
          <li>
            <strong>Répondre à vos obligations comptables</strong> — une facture émise est une
            pièce comptable : elle ne peut pas être effacée à la légère.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Combien de temps">
        <LegalTable>
          <thead>
            <tr>
              <th scope="col">Donnée</th>
              <th scope="col">Durée de conservation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Compte et entreprise</td>
              <td>Tant que le compte existe, puis 30 jours après sa suppression</td>
            </tr>
            <tr>
              <td>Factures et devis émis</td>
              <td>10 ans — durée légale de conservation des pièces comptables</td>
            </tr>
            <tr>
              <td>Brouillons jamais émis</td>
              <td>Supprimés avec le compte, sans délai</td>
            </tr>
            <tr>
              <td>Journaux techniques</td>
              <td>30 jours</td>
            </tr>
          </tbody>
        </LegalTable>
        <p>
          Le délai de 30 jours après suppression existe pour une raison précise : il permet de
          revenir en arrière si le compte a été effacé par erreur.
        </p>
      </LegalSection>

      <LegalSection title="5. Où sont vos données, et qui y touche">
        <p>
          Nous nous appuyons sur trois prestataires techniques, et sur aucun autre :
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — base de données et authentification, hébergées en
            Irlande (région <code>eu-west-1</code>).
          </li>
          <li>
            <strong>Vercel</strong> — exécution de l’application et distribution des pages.
          </li>
          <li>
            <strong>Resend</strong> — acheminement des emails d’authentification, uniquement.
            Aucune donnée de facturation ne lui est transmise.
          </li>
        </ul>
        <p>
          <strong>Vos données sont cloisonnées au niveau de la base elle-même</strong>, et pas
          seulement par l’interface. Chaque table applique une politique de sécurité qui
          rattache chaque ligne à une entreprise : une requête émise depuis un autre compte ne
          renvoie rien, et n’écrit rien. Ce cloisonnement a été éprouvé par des tentatives de
          contournement délibérées, en lecture comme en écriture.
        </p>
      </LegalSection>

      <LegalSection title="6. Vos droits">
        <p>Vous pouvez à tout moment :</p>
        <ul>
          <li>
            <strong>Consulter et corriger</strong> vos informations depuis la page Paramètres.
          </li>
          <li>
            <strong>Récupérer vos documents</strong> — chaque facture et chaque devis
            s’exporte en PDF.
          </li>
          <li>
            <strong>Demander la suppression de votre compte</strong> en écrivant à l’adresse
            indiquée en bas de page.
          </li>
        </ul>
        <p>
          Une réserve à connaître : une facture <strong>déjà émise</strong> ne peut pas être
          supprimée sur simple demande. C’est une pièce comptable, et sa conservation
          s’impose à nous comme à vous.
        </p>
      </LegalSection>

      <LegalSection title="7. Sécurité">
        <ul>
          <li>Tous les échanges passent par HTTPS.</li>
          <li>Les mots de passe sont hachés, jamais stockés en clair, et jamais lisibles par nous.</li>
          <li>
            L’accès aux données est filtré par la base, pas par l’interface — c’est la
            différence entre « l’écran ne l’affiche pas » et « le serveur refuse de le donner ».
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Modifications">
        <p>
          Toute modification substantielle de ce document vous sera signalée par email au moins
          30 jours avant son entrée en vigueur.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
