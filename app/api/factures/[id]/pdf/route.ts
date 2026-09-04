import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/lib/pdf/invoice-document';
import { buildInvoicePayload } from '@/lib/pdf/build';
import { pdfFileName } from '@/lib/pdf/payload';
import { getInvoiceView, requireSession } from '@/lib/db/queries';
import { createClient } from '@/lib/supabase/server';
import type { ClientRow } from '@/lib/db/types';
import { toClient } from '@/lib/db/mappers';

// `@react-pdf/renderer` a besoin des API Node (Buffer, streams) : la route ne
// peut pas tourner sur le runtime Edge.
export const runtime = 'nodejs';

/**
 * PDF d'une facture, lu en base.
 *
 * Le changement de fond par rapport à la phase 2 : la facture n'est plus
 * transmise par le navigateur mais relue côté serveur, sous RLS. Un document
 * ne peut donc plus être fabriqué pour une facture qui ne vous appartient pas
 * — `getInvoiceView` ne rendra rien pour une autre entreprise.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();

  const invoice = await getInvoiceView(session.companyId, params.id);
  if (!invoice) {
    return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
  }

  const supabase = createClient();
  const { data: clientRow } = await supabase
    .from('clients')
    .select('*')
    .eq('id', invoice.clientId)
    .maybeSingle<ClientRow>();

  const payload = buildInvoicePayload(
    invoice,
    session.company,
    clientRow ? toClient(clientRow) : undefined,
  );

  try {
    const buffer = await renderToBuffer(InvoiceDocument({ payload }));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFileName(payload)}"`,
        // Une facture peut être modifiée : un PDF mis en cache montrerait des
        // montants périmés.
        'Cache-Control': 'no-store',
      },
    });
  } catch (cause) {
    console.error('Génération PDF impossible', cause);
    return NextResponse.json({ error: 'Génération du PDF impossible.' }, { status: 500 });
  }
}
