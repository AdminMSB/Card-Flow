import type { PositionedTextItem } from './pdf-transactions';
import { clusterTextItemsIntoLines, extractRowsFromLines } from './pdf-transactions';
import type { ParsedFileRow } from './types';

// pdf.js carrega seu "worker" com um `import()` cujo caminho só é conhecido em runtime
// (não é um literal estático), então o rastreador de dependências da Vercel não consegue
// detectar esse arquivo sozinho e ele fica de fora do pacote da função serverless. O import
// estático abaixo, só pelo efeito colateral, força esse arquivo a entrar no pacote.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type { PositionedTextItem };
export { clusterTextItemsIntoLines, extractRowsFromLines };

/**
 * Faz parsing de uma fatura em PDF (testado com o layout "Fatura Mensal — Empresas
 * Mastercard Platinum" do Santander) extraindo data/descrição/valor de cada transação por
 * posição do texto na página, já que faturas em PDF não têm estrutura de tabela real (HTML
 * ou planilha) — apenas texto posicionado visualmente.
 */
export async function parsePDF(buffer: ArrayBuffer) {
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;

  const rows: ParsedFileRow[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PositionedTextItem[] = content.items.map((item) => {
      const textItem = item as { str: string; transform: number[] };
      return { str: textItem.str, x: textItem.transform[4]!, y: textItem.transform[5]! };
    });

    const lines = clusterTextItemsIntoLines(items);
    rows.push(...extractRowsFromLines(lines, rows.length));
  }

  return { headers: ['data', 'valor', 'descricao'], rows };
}
