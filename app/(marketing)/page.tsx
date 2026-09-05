import type { Metadata } from 'next';
import {
  BarChart3,
  Calculator,
  FileWarning,
  FilePlus2,
  Send,
  Sparkles,
  Timer,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { Hero } from '@/components/marketing/hero';
import { Section } from '@/components/marketing/section';
import { InfoCardGrid, type InfoItem } from '@/components/marketing/info-card';
import { Pricing } from '@/components/marketing/pricing';
import { Testimonials } from '@/components/marketing/testimonials';
import { FinalCta } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  // Titre absolu : le gabarit « %s · XN-Facture » doublerait la marque.
  title: { absolute: 'XN-Facture — La facturation simple, en FCFA' },
  description:
    'Créez des factures et des devis conformes en francs CFA, avec la TVA calculée automatiquement, les mentions légales NIU et RCCM, et le suivi de vos encaissements.',
};

const DEFIS: InfoItem[] = [
  {
    icon: FileWarning,
    badge: 'sand',
    title: 'Des factures qui font amateur',
    text: 'Un document bricolé sur Word passe mal auprès d’un donneur d’ordre, et il retarde la validation du paiement.',
  },
  {
    icon: Calculator,
    badge: 'sand',
    title: 'La TVA recalculée à la main',
    text: 'Un arrondi ligne par ligne et le total ne tombe plus juste. Votre client, lui, refait le calcul.',
  },
  {
    icon: Timer,
    badge: 'sand',
    title: 'Personne ne sait qui doit quoi',
    text: 'Les impayés se perdent dans les emails. On relance au hasard, ou trop tard.',
  },
];

const FONCTIONNALITES: InfoItem[] = [
  {
    icon: FilePlus2,
    title: 'Factures et devis',
    text: 'Un aperçu du document se compose à mesure que vous saisissez. Ce que vous voyez est exactement ce que le PDF contiendra.',
  },
  {
    icon: Calculator,
    title: 'TVA sans calcul',
    text: 'Un seul arrondi par base taxable, à 19,25 % ou au taux que vous fixez. Le total tombe juste, toujours.',
  },
  {
    icon: BarChart3,
    title: 'Encours par ancienneté',
    text: 'À échoir, 1–30 jours, 31–60, plus de 60. Vous voyez d’un coup d’œil qui relancer en premier.',
  },
  {
    icon: Wallet,
    title: 'Encaissements partiels',
    text: 'Vous saisissez le montant reçu, le statut et le reste dû s’en déduisent. Aucune facture ne se perd.',
  },
  {
    icon: Sparkles,
    title: 'Mentions légales portées',
    text: 'NIU et RCCM figurent sur chaque document, sans que vous ayez à y penser à chaque fois.',
  },
  {
    icon: Users,
    title: 'Carnet de clients',
    text: 'Coordonnées, historique et encours par client. Un client rattaché à des factures ne peut pas être effacé par mégarde.',
  },
  {
    icon: Send,
    title: 'Devis convertis en un clic',
    text: 'Le devis accepté devient une facture, au taux de TVA que le client a accepté — pas un autre.',
  },
  {
    icon: Timer,
    title: 'Numérotation sans trou',
    text: 'Le numéro s’attribue à l’envoi, jamais à la création. Un brouillon ne consomme rien.',
  },
];

const ETAPES: InfoItem[] = [
  {
    icon: UserPlus,
    badge: 'soft',
    step: '01',
    title: 'Créez votre compte',
    text: 'Votre email, un mot de passe, le nom de votre entreprise. Trente secondes, et vous êtes dedans.',
  },
  {
    icon: FilePlus2,
    badge: 'soft',
    step: '02',
    title: 'Renseignez vos mentions',
    text: 'NIU, RCCM, logo, coordonnées de règlement. Une fois pour toutes : chaque document les reprendra.',
  },
  {
    icon: Send,
    badge: 'soft',
    step: '03',
    title: 'Facturez et encaissez',
    text: 'Le PDF part à votre client, et le tableau de bord vous dit où en est chaque règlement.',
  },
];

export default function LandingPage() {
  return (
    <>
      <Hero />

      <Section
        tone="surface"
        eyebrow="Le problème"
        title="Facturer prend trop de temps, et ça se voit"
        subtitle="Trois choses reviennent dans la bouche de tous les entrepreneurs à qui nous avons parlé."
      >
        <InfoCardGrid items={DEFIS} columns={3} onSurface />
      </Section>

      <Section
        id="fonctionnalites"
        eyebrow="Ce que ça fait"
        title="Tout ce qu’il faut pour facturer, et rien de plus"
        subtitle="Chaque fonction répond à une contrainte réelle du marché camerounais et de la zone CEMAC."
      >
        <InfoCardGrid items={FONCTIONNALITES} columns={4} />
      </Section>

      <Section
        id="etapes"
        tone="sand"
        eyebrow="Prise en main"
        title="De l’inscription à la première facture en trois étapes"
        subtitle="Aucune formation, aucun paramétrage compliqué."
      >
        <InfoCardGrid items={ETAPES} columns={3} />
      </Section>

      <Section
        id="tarifs"
        tone="surface"
        eyebrow="Tarifs"
        title="Des prix en FCFA, lisibles"
        subtitle="Commencez gratuitement. Passez à la formule supérieure le jour où vous en avez besoin."
      >
        <Pricing />
      </Section>

      <Section
        id="temoignages"
        eyebrow="Retours"
        title="Ce qu’en disent les premiers utilisateurs"
        subtitle="Des ateliers, des cabinets, des indépendants — les mêmes contraintes, le même besoin de clarté."
      >
        <Testimonials />
      </Section>

      <FinalCta />
    </>
  );
}
