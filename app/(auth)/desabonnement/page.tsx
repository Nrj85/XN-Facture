import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { UnsubscribeForm } from '@/components/auth/unsubscribe-form';

export const metadata: Metadata = {
  title: 'Se désabonner',
  description: 'Ne plus recevoir les messages d’information de XN-Facture.',
  // Une page atteinte par un jeton personnel n'a rien à faire dans un index.
  robots: { index: false, follow: false },
};

/**
 * Désabonnement des emails de prospection.
 *
 * ⚠️ **Page PUBLIQUE, et elle doit le rester.** Elle est ajoutée aux
 * `PUBLIC_PATHS` du middleware : sans cela, le lien renverrait vers
 * `/connexion`, et se désabonner exigerait de se connecter — c'est-à-dire
 * n'existerait pas pour qui a oublié son mot de passe ou n'ouvre ses messages
 * que sur son téléphone.
 *
 * ⚠️ **Elle est dans le groupe `(auth)` et non `(marketing)`.** La coquille
 * d'authentification donne exactement ce qu'il faut — une carte centrée, le
 * logo qui ramène à l'accueil — alors que le groupe vitrine est STATIQUE et
 * bâti sur des modules CSS. Cette page lit un paramètre d'URL : elle ne peut
 * pas être statique.
 *
 * ⚠️ **Rien n'est enregistré au chargement.** Voir `UnsubscribeForm` : les
 * passerelles antispam visitent les liens des messages, et un désabonnement à
 * l'ouverture retirerait des gens qui n'ont jamais cliqué.
 */
export default function DesabonnementPage({
  searchParams,
}: {
  searchParams: { jeton?: string | string[] };
}) {
  const brut = Array.isArray(searchParams.jeton) ? searchParams.jeton[0] : searchParams.jeton;
  const jeton = (brut ?? '').trim();

  if (!jeton) {
    return (
      <AuthCard
        title="Lien incomplet"
        subtitle="Cette page se rejoint depuis le lien figurant en bas de nos messages."
        error="Le lien ne porte aucun identifiant. Il a probablement été tronqué en le copiant."
        footer={<Link href="/">Retour à l’accueil</Link>}
      >
        <p className="text-[13px] leading-relaxed text-ink-2">
          Rouvrez le message reçu et cliquez directement sur « Se désabonner » plutôt que de
          recopier l’adresse. Si le problème persiste, écrivez à{' '}
          <a href="mailto:contact@xn-facture.com" className="font-medium text-brand-hover">
            contact@xn-facture.com
          </a>{' '}
          et nous le ferons pour vous.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Se désabonner"
      subtitle="Vous ne recevrez plus nos messages d’information."
      footer={<Link href="/">Retour à l’accueil</Link>}
    >
      <UnsubscribeForm token={jeton} />
    </AuthCard>
  );
}
