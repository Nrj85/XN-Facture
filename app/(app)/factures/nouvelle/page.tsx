import type { Metadata } from 'next';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { getClients, requireSession } from '@/lib/db/queries';
import { today } from '@/lib/today';
import { letterheadIfUsed } from '@/lib/db/letterhead';

export const metadata: Metadata = { title: 'Créer une facture' };

export default async function NouvelleFacturePage() {
  const session = await requireSession();
  const clients = await getClients(session.companyId);

  // L'image du papier a en-tete, lue UNIQUEMENT si l'entreprise est en mode
  // << en-tete televerse >>. L'apercu doit montrer le document tel qu'il sera
  // imprime : sans elle, il afficherait une page blanche la ou le PDF dessine
  // l'en-tete, et la personne croirait que la fonction ne marche pas.
  const letterhead = await letterheadIfUsed(session.companyId, session.company.letterheadMode);

  return <InvoiceForm clients={clients} today={today()} letterheadDataUrl={letterhead} />;
}
