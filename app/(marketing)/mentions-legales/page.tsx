import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Éditeur, hébergement et propriété intellectuelle du service XN-Facture.',
};

/**
 * Mentions légales.
 *
 * ⚠️ Les champs d'identification de l'éditeur — raison sociale, NIU, RCCM,
 * adresse, directeur de publication — sont laissés en **espaces réservés
 * visibles**. Y inventer une immatriculation serait exactement la faute que le
 * produit apprend à ses utilisateurs à ne pas commettre.
 */
export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      updated="5 septembre 2026"
      lead="Informations relatives à l’éditeur du site et du service XN-Facture."
    >
      <LegalSection title="1. Éditeur du service">
        <p>
          <strong>À COMPLÉTER avant l’ouverture au public.</strong> Ces champs ne sont pas
          renseignés parce qu’ils dépendent de l’immatriculation réelle de la structure. Un
          produit qui impose le NIU et le RCCM sur chaque facture ne peut pas en inventer pour
          lui-même.
        </p>
        <ul>
          <li><strong>Raison sociale</strong> — [à compléter]</li>
          <li><strong>Forme juridique</strong> — [à compléter]</li>
          <li><strong>Siège social</strong> — [à compléter]</li>
          <li><strong>NIU</strong> — [à compléter]</li>
          <li><strong>RCCM</strong> — [à compléter]</li>
          <li><strong>Directeur de la publication</strong> — [à compléter]</li>
          <li><strong>Contact</strong> — contact@xn-facture.cm</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Hébergement">
        <p>L’infrastructure repose sur deux prestataires :</p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> — hébergement et distribution de l’application.
            340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
          </li>
          <li>
            <strong>Supabase</strong> — base de données et authentification. Données hébergées
            en Irlande (région <code>eu-west-1</code>).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Propriété intellectuelle">
        <p>
          La marque XN-Facture, le nom de domaine, la charte graphique et le code de
          l’application sont la propriété de l’éditeur. Toute reproduction sans autorisation
          écrite est interdite.
        </p>
        <p>
          En revanche, <strong>les contenus que vous saisissez restent les vôtres</strong> :
          vos clients, vos factures, vos devis et votre logo ne nous appartiennent à aucun
          titre.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookies">
        <p>
          Le site ne dépose <strong>aucun cookie publicitaire ni aucun traceur de mesure
          d’audience tiers</strong>.
        </p>
        <p>
          Un seul cookie est utilisé, strictement nécessaire au fonctionnement : celui qui
          maintient votre session ouverte une fois connecté. Il disparaît à la déconnexion.
          Étant indispensable au service, il ne requiert pas de consentement préalable.
        </p>
      </LegalSection>

      <LegalSection title="5. Signaler un problème">
        <p>
          Pour signaler un contenu illicite, une faille de sécurité ou une erreur dans ces
          mentions, écrivez à <a href="mailto:contact@xn-facture.cm">contact@xn-facture.cm</a>.
          Les signalements de sécurité sont traités en priorité.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
