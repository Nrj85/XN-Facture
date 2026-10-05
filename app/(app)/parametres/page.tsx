import type { Metadata } from 'next';
import { LetterheadForm } from '@/components/settings/letterhead-form';
import { MfaForm } from '@/components/settings/mfa-form';
import { PersonalForm } from '@/components/settings/personal-form';
import { SecurityForm } from '@/components/settings/security-form';
import { SettingsForm } from '@/components/settings/settings-form';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/db/queries';
import { getLocale } from '@/lib/i18n';

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
    ⚠️ **ON NE LIT QUE LA PRÉSENCE DE L'EN-TÊTE, PAS L'IMAGE.** Un `select`
    sur `data_url` ferait transiter des centaines de kilo-octets jusqu'au
    navigateur pour afficher « En-tête enregistré ». `head: true` avec un
    décompte ne rapporte qu'un nombre.
  */
  const { count: enTetes } = await supabase
    .from('company_letterheads')
    .select('company_id', { count: 'exact', head: true })
    .eq('company_id', session.companyId);
  const aDejaUnEnTete = (enTetes ?? 0) > 0;

  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', session.companyId)
    .not('number', 'is', null);

  return (
    <div className="space-y-5">
      <SettingsForm issuedCount={count ?? 0} />
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
      {/*
        Le papier à en-tête change la FORME de chaque document émis, pas les
        réglages de l'entreprise : il a sa propre carte, posée juste après les
        sections d'entreprise et avant ce qui n'appartient qu'à la personne.
      */}
      <LetterheadForm
        mode={session.company.letterheadMode}
        topMm={session.company.letterheadTopMm}
        bottomMm={session.company.letterheadBottomMm}
        keepLegal={session.company.letterheadKeepLegal}
        aDejaUneImage={aDejaUnEnTete}
      />

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
