import type { PositionedTextItem } from './pdf-transactions';
import { clusterTextItemsIntoLines } from './pdf-transactions';

// Mesmo truque do parser de fatura: força o worker do pdf.js a entrar no pacote da função
// serverless da Vercel, já que o `import()` dinâmico dele não é rastreável estaticamente.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Extrai o texto de um PDF como linhas visuais (itens agrupados por coordenada Y e
 * ordenados por X), pra heurísticas de "valor perto da palavra-chave" funcionarem
 * independente do layout do documento (NF, DANFE, boleto — cada emissor é diferente). */
export async function extractPdfLines(buffer: ArrayBuffer): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PositionedTextItem[] = content.items.map((item) => {
      const textItem = item as { str: string; transform: number[] };
      return { str: textItem.str, x: textItem.transform[4]!, y: textItem.transform[5]! };
    });

    for (const line of clusterTextItemsIntoLines(items)) {
      const text = [...line]
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) lines.push(text);
    }
  }

  return lines;
}
