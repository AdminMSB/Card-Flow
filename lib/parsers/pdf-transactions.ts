import type { ParsedFileRow } from './types';

export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
}

// Posições em pontos (pt) observadas na fatura mensal Santander "Empresas Mastercard
// Platinum" (Demonstrativo de Transações): Data ~18, Descrição ~66, Local ~220, valor em
// R$ ~473-495, Cotação dólar ~519 em diante. Faturas de outras operadoras/bandeiras podem
// usar posições diferentes — se o import não detectar linhas, ajuste as constantes abaixo
// ou use a tela de mapeamento manual com outro formato (CSV/XLSX/OFX) como alternativa.
const DATE_COLUMN_X = 18.42;
const DATE_COLUMN_TOLERANCE = 6;
const DESCRIPTION_COLUMN_MIN_X = 60;
const DESCRIPTION_COLUMN_MAX_X = 218;
const AMOUNT_COLUMN_MIN_X = 460;
const AMOUNT_COLUMN_MAX_X = 500;
const LINE_Y_TOLERANCE = 2;

const DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;
const MONEY_PATTERN = /^-?[\d.]+,\d{2}$/;

// Linhas que são encargos/tarifas/pagamentos da fatura, não compras de um estabelecimento —
// não devem virar candidatos de conciliação.
const EXCLUDED_DESCRIPTION_PATTERNS = [
  /^IOF\b/i,
  /^ANUIDADE/i,
  /^PAGAMENTO DE FATURA/i,
  /^ENCARGOS?\b/i,
  /^MULTAS?\b/i,
  /^JUROS\b/i,
  /^SEGURO\b/i,
];

/** Agrupa itens de texto na mesma linha visual (mesma coordenada Y, com tolerância). */
export function clusterTextItemsIntoLines(items: PositionedTextItem[]): PositionedTextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PositionedTextItem[][] = [];
  let currentY: number | null = null;
  let currentLine: PositionedTextItem[] = [];

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) > LINE_Y_TOLERANCE) {
      if (currentLine.length) lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }
  if (currentLine.length) lines.push(currentLine);

  return lines;
}

/**
 * Extrai linhas de transação (data, descrição, valor em R$) de linhas já agrupadas por Y.
 * Uma linha só é considerada transação se tiver, ao mesmo tempo: um item na coluna de data
 * (posição X da 1ª coluna) no formato dd-mm-aaaa, e um item na faixa de X da coluna R$ no
 * formato monetário brasileiro. Isso filtra automaticamente cabeçalhos, resumos e rodapés,
 * que não têm essa combinação exata de colunas.
 */
export function extractRowsFromLines(lines: PositionedTextItem[][], startIndex = 0): ParsedFileRow[] {
  const rows: ParsedFileRow[] = [];
  let rowIndex = startIndex;

  for (const line of lines) {
    const sorted = [...line].sort((a, b) => a.x - b.x);

    const dateItem = sorted.find(
      (item) => Math.abs(item.x - DATE_COLUMN_X) <= DATE_COLUMN_TOLERANCE && DATE_PATTERN.test(item.str.trim()),
    );
    if (!dateItem) continue;

    const amountItem = sorted.find(
      (item) =>
        item.x >= AMOUNT_COLUMN_MIN_X && item.x <= AMOUNT_COLUMN_MAX_X && MONEY_PATTERN.test(item.str.trim()),
    );
    if (!amountItem) continue;

    const amountRaw = amountItem.str.trim();
    if (amountRaw.startsWith('-')) continue; // pagamento/crédito/estorno, não é uma compra

    const description = sorted
      .filter((item) => item.x > DESCRIPTION_COLUMN_MIN_X && item.x < DESCRIPTION_COLUMN_MAX_X)
      .map((item) => item.str.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!description) continue;
    if (EXCLUDED_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description))) continue;

    const match = dateItem.str.trim().match(DATE_PATTERN);
    if (!match) continue;
    const [, day, month, year] = match as [string, string, string, string];

    rows.push({
      rowIndex: rowIndex++,
      columns: {
        data: `${year}-${month}-${day}`,
        valor: amountRaw,
        descricao: description,
      },
    });
  }

  return rows;
}
