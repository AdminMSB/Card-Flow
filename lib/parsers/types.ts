export interface ParsedFileRow {
  rowIndex: number;
  columns: Record<string, string>;
}

/** Resultado bruto do parsing de um arquivo (CSV, XLSX ou OFX) em linhas/colunas. */
export interface ParsedFile {
  headers: string[];
  rows: ParsedFileRow[];
}

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
}

export type PartialColumnMapping = Partial<ColumnMapping>;

/** Uma linha de fatura já normalizada, pronta para gravar em `invoice_items`. */
export interface NormalizedInvoiceLine {
  itemDate: string; // ISO yyyy-mm-dd
  amountCents: number;
  merchantRaw: string;
  descriptionRaw: string | null;
}

export type SupportedInvoiceFileType = 'csv' | 'xlsx' | 'ofx';

export function detectFileType(fileName: string): SupportedInvoiceFileType | null {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'ofx') return 'ofx';
  return null;
}
