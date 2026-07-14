import { parseCurrencyToCents } from '@/lib/format';
import type { ColumnMapping, NormalizedInvoiceLine, ParsedFile, PartialColumnMapping } from './types';

const DATE_HINTS = ['data', 'date', 'dt'];
const AMOUNT_HINTS = ['valor', 'amount', 'value', 'total', 'montante'];
const DESCRIPTION_HINTS = ['descri', 'estabelec', 'merchant', 'histor', 'lancamento', 'lançamento'];

function findHeaderByHints(headers: string[], hints: string[]): string | undefined {
  const normalized = headers.map((h) => h.toLowerCase());
  for (const hint of hints) {
    const index = normalized.findIndex((h) => h.includes(hint));
    if (index !== -1) return headers[index];
  }
  return undefined;
}

/** Heurística de auto-detecção de colunas por nome de cabeçalho, para pré-preencher a tela de mapeamento. */
export function detectColumnMapping(parsed: ParsedFile): PartialColumnMapping {
  return {
    date: findHeaderByHints(parsed.headers, DATE_HINTS),
    amount: findHeaderByHints(parsed.headers, AMOUNT_HINTS),
    description: findHeaderByHints(parsed.headers, DESCRIPTION_HINTS),
  };
}

/** Converte "dd/mm/aaaa", "dd-mm-aaaa" ou "aaaa-mm-dd" em ISO yyyy-mm-dd. Retorna null se não reconhecer. */
function parseDateToISO(raw: string): string | null {
  const trimmed = raw.trim();

  const brMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch as [string, string, string, string];
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  return null;
}

/** Aplica o mapeamento de colunas confirmado pelo usuário e normaliza cada linha da fatura. */
export function normalizeRows(parsed: ParsedFile, mapping: ColumnMapping): NormalizedInvoiceLine[] {
  const lines: NormalizedInvoiceLine[] = [];

  for (const row of parsed.rows) {
    const rawDate = row.columns[mapping.date] ?? '';
    const rawAmount = row.columns[mapping.amount] ?? '';
    const rawDescription = (row.columns[mapping.description] ?? '').trim();

    const isoDate = parseDateToISO(rawDate);
    const amountCents = Math.abs(parseCurrencyToCents(rawAmount));

    if (!isoDate || !amountCents) continue;

    lines.push({
      itemDate: isoDate,
      amountCents,
      merchantRaw: rawDescription || '(sem descrição)',
      descriptionRaw: rawDescription || null,
    });
  }

  return lines;
}
