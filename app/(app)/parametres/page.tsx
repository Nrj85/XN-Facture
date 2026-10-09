import type { Metadata } from 'next';
import { LetterheadForm } from '@/components/settings/letterhead-form';
import { MfaForm } from '@/components/settings/mfa-form';
import { PersonalForm } from '@/components/settings/personal-form';
import { SecurityForm } from '@/components/settings/security-form';
import { SettingsForm } from '@/components/settings/settings-form';
import { createClient } from '@/lib/supabase/server';
import { getLetterhead } from '@/lib/db/letterhead';
import { getSubscription, requireSession } from '@/lib/db/queries';
import { getLocale } from '@/lib/i18n';
import { effectivePlan, planAllowsLetterhead } from '@/lib/plans';
import { today } from '@/lib/today';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function ParametresPage() {
  const session = await requireSession();
  const locale = await getLocale();

  const supabase = createClient();

  /*
    État réel du second facteur, relu sur le compte à chaque affichage.
    ⚠️ **Il ne doit PAS venir d'un état local du composant** : après un échec
    silencieux, la carte aurait affiché « activée » sur un compte sans
    protection — exactement la fausse assurance que cette fonction doit éviter.
  */
  const { data: auth } = await supabase.auth.getUser();
  const mfaActive = (auth.user?.factors ?? []).some((f) => f.status === 'verified');

  /*
    ⚠️ **ON LIT L'IMAGE ENTIÈRE ICI — revirement assumé du 6 oct. 2026.**
    Cet écran ne lisait que la PRÉSENCE (`head: true` + décompte), pour
    s'épargner des centaines de kilo-octets. Le résultat était qu'on téléversait
    son papier à en-tête sans jamais le revoir : l'écran affichait « En-tête
    enregistré » et rien d'autre, et le seul moyen de vérifier ce qui avait été
    gardé — et où les marges tombaient dessus — était d'émettre une facture
    d'essai puis d'ouvrir son PDF.

    La règle « on ne lit que ce qui sert » n'est pas abandonnée, elle est
    appliquée : ici, l'image EST ce qui sert. Elle reste hors de `Company`,
    donc aucune autre page ne la transporte.
  */
  const letterhead = await getLetterhead(session.companyId);

  /*
    ⚠️ **LA FORMULE EFFECTIVE, jamais `subscriptions.plan` brut.** Un
    abonnement payé mais expiré redescend en Découverte, et c'est exactement ce
    que fait `plan_effectif()` côté base (migration 0021). Passer la formule
    brute ouvrirait le formulaire sur un compte dont la base refuserait
    l'enregistrement — la divergence précise contre laquelle `effectivePlan()`
    met en garde, et celle que la section « Abonnements » décrit comme « l'écran
    annonce Pro pendant que la base refuse ».

    ⚠️ **ON LIT L'IMAGE MÊME QUAND C'EST VERROUILLÉ, et c'est voulu** : le
    verrou porte sur l'écriture, pas sur l'impression. La carte verrouillée
    montre donc l'en-tête qui continue d'être dessiné sur les PDF — le cacher
    laisserait croire qu'il a disparu des factures.
  */
  const abonnement = await getSubscription(session.companyId);
  const plan = effectivePlan(abonnement.plan, abonnement.expiresAt, today());

  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', session.companyId)
    .not('number', 'is', null);

  return (
    <div className="space-y-5">
      <SettingsForm issuedCount={count ?? 0} />
      {/*
        Le papier à en-tête décrit l'ENTREPRISE — il s'applique aux documents de
        toute l'équipe — donc il reste du côté des réglages partagés, juste
        après eux. Il a sa propre carte parce qu'il change la FORME de chaque
        document émis et non une valeur imprimée dessus.

        ⚠️ **Il était d'abord posé APRÈS « Préférences personnelles », ce qui
        coupait les cartes personnelles en deux** — constaté en capture, pas à
        la relecture : le commentaire annonçait déjà ce placement-ci pendant que
        le code en faisait un autre. L'écran doit lire « ce qui est partagé,
        puis ce qui est à moi », sans retour en arrière.
      */}
      <LetterheadForm
        mode={session.company.letterheadMode}
        topMm={session.company.letterheadTopMm}
        bottomMm={session.company.letterheadBottomMm}
        keepLegal={session.company.letterheadKeepLegal}
        imageActuelle={letterhead}
        verrouille={!planAllowsLetterhead(plan)}
      />
      {/*
        Les préférences personnelles — nom et langue — sont posées APRÈS les
        réglages d'entreprise, dans leur propre carte : elles ne concernent que
        la personne au clavier, alors que tout ce qui précède est partagé par
        l'équipe. Les mêler aurait laissé croire qu'on renomme ses collègues.
      */}
      <PersonalForm current={locale} fullName={session.fullName} />
      {/*
        L'accès au compte vient APRÈS le confort : on ne met pas un champ de
        mot de passe à côté d'un sélecteur de langue.
      */}
      <SecurityForm currentEmail={session.email} />
      {/*
        La double authentification vient EN DERNIER : les cartes précédentes
        remplacent un identifiant, celle-ci en ajoute un. C'est aussi la seule
        dont l'effet se voit à la prochaine connexion et non tout de suite.
      */}
      <MfaForm active={mfaActive} />
    </div>
  );
}
