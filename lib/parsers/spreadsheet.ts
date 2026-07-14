import * as XLSX from 'xlsx';
import type { ParsedFile } from './types';

/**
 * Converte uma célula para texto sem deixar a formatação "inteligente" da
 * biblioteca `xlsx` reinterpretar o conteúdo (ela tenta adivinhar locale de data
 * e acaba corrompendo datas em texto como "05/07/2026" para "5/6/26"). Datas
 * reais de planilha (`cellDates: true`) são formatadas aqui mesmos como ISO,
 * usando os componentes UTC para não sofrer deslocamento de fuso horário.
 */
function cellToString(cell: unknown): string {
  if (cell instanceof Date) {
    const year = cell.getUTCFullYear();
    const month = String(cell.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cell.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(cell ?? '').trim();
}

function matrixToParsedFile(matrix: unknown[][]): ParsedFile {
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((cell, index) => {
    const label = cellToString(cell);
    return label || `coluna_${index + 1}`;
  });

  const rows = matrix
    .slice(1)
    .filter((row) => row.some((cell) => cellToString(cell) !== ''))
    .map((row, index) => {
      const columns: Record<string, string> = {};
      headers.forEach((header, colIndex) => {
        columns[header] = cellToString(row[colIndex]);
      });
      return { rowIndex: index, columns };
    });

  return { headers, rows };
}

/** Faz parsing de um arquivo CSV (texto) em linhas/colunas, preservando o texto original das células. */
export function parseCSV(text: string): ParsedFile {
  const workbook = XLSX.read(text, { type: 'string', raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, {
    header: 1,
    raw: true,
    defval: '',
  });
  return matrixToParsedFile(matrix);
}

/** Faz parsing de um arquivo XLSX/XLS (buffer binário) em linhas/colunas. */
export function parseXLSX(buffer: ArrayBuffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: 'array', raw: true, cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, {
    header: 1,
    raw: true,
    defval: '',
  });
  return matrixToParsedFile(matrix);
}
