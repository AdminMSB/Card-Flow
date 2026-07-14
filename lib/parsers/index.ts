import { detectFileType, type ParsedFile } from './types';
import { parseCSV, parseXLSX } from './spreadsheet';
import { parseOFX } from './ofx';

export * from './types';
export * from './normalize';

/** Detecta o formato pela extensão do arquivo e delega para o parser correspondente. */
export async function parseInvoiceFile(file: File): Promise<ParsedFile> {
  const type = detectFileType(file.name);
  if (!type) {
    throw new Error(`Formato de arquivo não suportado: ${file.name}. Use CSV, XLSX ou OFX.`);
  }

  if (type === 'csv') return parseCSV(await file.text());
  if (type === 'ofx') return parseOFX(await file.text());
  return parseXLSX(await file.arrayBuffer());
}
