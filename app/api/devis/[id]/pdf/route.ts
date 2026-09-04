import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/lib/pdf/invoice-document';
import { buildQuotePayload } from '@/lib/pdf/build';
import { pdfFileName } from '@/lib/pdf/payload';
import { getQuoteView, requireSession } from '@/lib/db/queries';
import { createClient } from '@/lib/supabase/server';
import type { ClientRow } from '@/lib/db/types';
import { toClient } from '@/lib/db/mappers';

export const runtime = 'nodejs';

/** PDF d'un devis. Même gabarit que la facture, à trois libellés près. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();

  const quote = await getQuoteView(session.companyId, params.id);
  if (!quote) {
    return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
  }

  const supabase = createClient();
  const { data: clientRow } = await supabase
    .from('clients')
    .select('*')
    .eq('id', quote.clientId)
    .maybeSingle<ClientRow>();

  const payload = buildQuotePayload(
    quote,
    session.company,
    clientRow ? toClient(clientRow) : undefined,
  );

  try {
    const buffer = await renderToBuffer(InvoiceDocument({ payload }));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFileName(payload)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (cause) {
    console.error('Génération PDF impossible', cause);
    return NextResponse.json({ error: 'Génération du PDF impossible.' }, { status: 500 });
  }
}
