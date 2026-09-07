import type { Metadata } from 'next';
import { LanguageForm } from '@/components/settings/language-form';
import { SettingsForm } from '@/components/settings/settings-form';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/db/queries';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function ParametresPage() {
  const session = await requireSession();
  const locale = getLocale();

  const supabase = createClient();
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', session.companyId)
    .not('number', 'is', null);

  return (
    <div className="space-y-5">
      <SettingsForm issuedCount={count ?? 0} />
      {/*
        La préférence de langue est posée APRÈS les réglages d'entreprise, dans
        sa propre carte : elle ne concerne que la personne au clavier, alors que
        tout ce qui précède est partagé par l'équipe. Les mêler aurait laissé
        croire qu'on change la langue de ses collègues.
      */}
      <LanguageForm current={locale} />
    </div>
  );
}
