import { NextResponse, type NextRequest } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { extractPdfLines } from '@/lib/parsers/document-pdf';
import { extractDocumentFields } from '@/lib/parsers/document-fields';

/** Lê o comprovante (NF/DANFE/boleto) anexado a uma compra e tenta extrair fornecedor,
 * CNPJ, valor, número do documento e data de emissão — só PDF (imagem exigiria OCR, fora
 * de escopo). É "melhor esforço": campos não identificados voltam null, a UI avisa. */
export async function POST(request: NextRequest) {
  await requireProfile();

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File) || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Envie um arquivo PDF.' }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const lines = await extractPdfLines(buffer);
    const fields = extractDocumentFields(lines);
    return NextResponse.json(fields);
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o documento.' }, { status: 422 });
  }
}
