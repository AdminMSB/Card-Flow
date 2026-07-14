import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from '@/types/domain';

const PURCHASE_STATUSES: PurchaseStatus[] = ['pending', 'approved', 'rejected', 'reconciled'];

function isPurchaseStatus(value: string | undefined): value is PurchaseStatus {
  return !!value && (PURCHASE_STATUSES as string[]).includes(value);
}

interface PurchaseRow {
  id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string;
  status: PurchaseStatus;
  user_id: string;
  category_id: string | null;
  cost_center_id: string | null;
  requisition_number: string | null;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  invoice_document_number: string | null;
  purchase_order_code: string | null;
}

interface ReportLine {
  data: string;
  solicitante: string;
  estabelecimento: string;
  fornecedor: string;
  cnpjFornecedor: string;
  requisicao: string;
  ordemCompra: string;
  notaFiscal: string;
  categoria: string;
  centroCusto: string;
  valorCents: number;
  status: string;
}

/** Busca todas as compras (sem limite de linhas) que casam com os filtros da querystring. */
async function fetchAllMatchingPurchases(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  filters: { de?: string; ate?: string; departmentId?: string; costCenterId?: string; status?: PurchaseStatus },
): Promise<PurchaseRow[]> {
  let cardIdsForDepartment: string[] | null = null;
  if (filters.departmentId) {
    const { data: cardsInDepartment } = await supabase
      .from('cards')
      .select('id')
      .eq('department_id', filters.departmentId);
    cardIdsForDepartment = (cardsInDepartment ?? []).map((card) => card.id);
  }
  if (cardIdsForDepartment !== null && cardIdsForDepartment.length === 0) {
    return [];
  }

  let query = supabase
    .from('purchases')
    .select(
      'id, purchase_date, amount_cents, merchant_name, status, user_id, category_id, cost_center_id, requisition_number, supplier_name, supplier_cnpj, invoice_document_number, purchase_order_code',
    );

  if (filters.de) query = query.gte('purchase_date', filters.de);
  if (filters.ate) query = query.lte('purchase_date', filters.ate);
  if (filters.costCenterId) query = query.eq('cost_center_id', filters.costCenterId);
  if (filters.status) query = query.eq('status', filters.status);
  if (cardIdsForDepartment) query = query.in('card_id', cardIdsForDepartment);

  const { data } = await query.order('purchase_date', { ascending: false });
  return data ?? [];
}

/** Resolve nomes de categoria/centro de custo/solicitante em lote para as linhas encontradas. */
async function buildReportLines(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  rows: PurchaseRow[],
): Promise<ReportLine[]> {
  const categoryIds = Array.from(new Set(rows.map((row) => row.category_id).filter((id): id is string => !!id)));
  const costCenterIds = Array.from(
    new Set(rows.map((row) => row.cost_center_id).filter((id): id is string => !!id)),
  );
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));

  const [{ data: categoriesData }, { data: costCentersData }, { data: profilesData }] = await Promise.all([
    categoryIds.length
      ? supabase.from('categories').select('id, name').in('id', categoryIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    costCenterIds.length
      ? supabase.from('cost_centers').select('id, name, code').in('id', costCenterIds)
      : Promise.resolve({ data: [] as { id: string; name: string; code: string }[] }),
    userIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const categoryNameById = new Map((categoriesData ?? []).map((category) => [category.id, category.name]));
  const costCenterNameById = new Map(
    (costCentersData ?? []).map((costCenter) => [costCenter.id, `${costCenter.name} (${costCenter.code})`]),
  );
  const fullNameById = new Map((profilesData ?? []).map((profile) => [profile.id, profile.full_name]));

  return rows.map((row) => ({
    data: formatDate(row.purchase_date),
    solicitante: fullNameById.get(row.user_id) ?? '—',
    estabelecimento: row.merchant_name,
    fornecedor: row.supplier_name ?? '—',
    cnpjFornecedor: row.supplier_cnpj ?? '—',
    requisicao: row.requisition_number ?? '—',
    ordemCompra: row.purchase_order_code ?? '—',
    notaFiscal: row.invoice_document_number ?? '—',
    categoria: row.category_id ? categoryNameById.get(row.category_id) ?? '—' : '—',
    centroCusto: row.cost_center_id ? costCenterNameById.get(row.cost_center_id) ?? '—' : '—',
    valorCents: row.amount_cents,
    status: PURCHASE_STATUS_LABELS[row.status],
  }));
}

async function buildExcelResponse(lines: ReportLine[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Relatório');

  sheet.columns = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Solicitante', key: 'solicitante', width: 28 },
    { header: 'Estabelecimento', key: 'estabelecimento', width: 28 },
    { header: 'Fornecedor', key: 'fornecedor', width: 28 },
    { header: 'CNPJ Fornecedor', key: 'cnpjFornecedor', width: 20 },
    { header: 'Requisição', key: 'requisicao', width: 14 },
    { header: 'Nº OC', key: 'ordemCompra', width: 14 },
    { header: 'NF/Fatura/Boleto', key: 'notaFiscal', width: 18 },
    { header: 'Categoria', key: 'categoria', width: 20 },
    { header: 'Centro de Custo', key: 'centroCusto', width: 24 },
    { header: 'Valor', key: 'valor', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  if (lines.length === 0) {
    sheet.addRow({ data: 'Nenhum resultado encontrado para os filtros selecionados.' });
  } else {
    for (const line of lines) {
      sheet.addRow({
        data: line.data,
        solicitante: line.solicitante,
        estabelecimento: line.estabelecimento,
        fornecedor: line.fornecedor,
        cnpjFornecedor: line.cnpjFornecedor,
        requisicao: line.requisicao,
        ordemCompra: line.ordemCompra,
        notaFiscal: line.notaFiscal,
        categoria: line.categoria,
        centroCusto: line.centroCusto,
        valor: line.valorCents / 100,
        status: line.status,
      });
    }
  }

  sheet.getColumn('valor').numFmt = '"R$" #,##0.00';

  return workbook.xlsx.writeBuffer();
}

// A4 paisagem (mais larga) para caber as colunas extras vindas da planilha original.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;
const LINE_HEIGHT = 16;

const COLUMN_ORDER = [
  'data',
  'solicitante',
  'estabelecimento',
  'fornecedor',
  'requisicao',
  'ordemCompra',
  'categoria',
  'centroCusto',
  'valor',
  'status',
] as const;
type ColumnKey = (typeof COLUMN_ORDER)[number];

const COLUMN_X: Record<ColumnKey, number> = {
  data: MARGIN,
  solicitante: MARGIN + 45,
  estabelecimento: MARGIN + 155,
  fornecedor: MARGIN + 285,
  requisicao: MARGIN + 415,
  ordemCompra: MARGIN + 465,
  categoria: MARGIN + 515,
  centroCusto: MARGIN + 585,
  valor: MARGIN + 655,
  status: MARGIN + 715,
};

const COLUMN_LABEL: Record<ColumnKey, string> = {
  data: 'Data',
  solicitante: 'Solicitante',
  estabelecimento: 'Estabelecimento',
  fornecedor: 'Fornecedor',
  requisicao: 'Requis.',
  ordemCompra: 'OC',
  categoria: 'Categoria',
  centroCusto: 'C. Custo',
  valor: 'Valor',
  status: 'Status',
};

const COLUMN_MAX_CHARS: Partial<Record<ColumnKey, number>> = {
  solicitante: 18,
  estabelecimento: 22,
  fornecedor: 22,
  requisicao: 10,
  ordemCompra: 10,
  categoria: 14,
  centroCusto: 12,
  status: 10,
};

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

/** Extrai o texto de uma célula para a coluna dada — evita indexar `ReportLine` com uma
 * chave genérica, já que o campo de valor monetário se chama `valorCents`, não `valor`. */
function cellText(line: ReportLine, key: ColumnKey): string {
  switch (key) {
    case 'data':
      return line.data;
    case 'solicitante':
      return line.solicitante;
    case 'estabelecimento':
      return line.estabelecimento;
    case 'fornecedor':
      return line.fornecedor;
    case 'requisicao':
      return line.requisicao;
    case 'ordemCompra':
      return line.ordemCompra;
    case 'categoria':
      return line.categoria;
    case 'centroCusto':
      return line.centroCusto;
    case 'valor':
      return formatCurrencyCents(line.valorCents);
    case 'status':
      return line.status;
  }
}

async function buildPdfResponse(lines: ReportLine[], filters: { de?: string; ate?: string }): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawHeaderRow() {
    for (const key of COLUMN_ORDER) {
      page.drawText(COLUMN_LABEL[key], { x: COLUMN_X[key], y, size: 9, font: fontBold, color: rgb(0, 0, 0) });
    }
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 14;
  }

  function ensureSpace() {
    if (y < MARGIN + LINE_HEIGHT) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawHeaderRow();
    }
  }

  page.drawText('Relatório de Conciliação — Cartão Corporativo', {
    x: MARGIN,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  const periodoLabel = `Período: ${filters.de ? formatDate(filters.de) : 'início'} até ${
    filters.ate ? formatDate(filters.ate) : 'hoje'
  }`;
  page.drawText(periodoLabel, { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 24;

  drawHeaderRow();

  if (lines.length === 0) {
    page.drawText('Nenhum resultado encontrado para os filtros selecionados.', {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    y -= LINE_HEIGHT;
  } else {
    let totalCents = 0;
    for (const line of lines) {
      ensureSpace();
      for (const key of COLUMN_ORDER) {
        const rawValue = cellText(line, key);
        const maxChars = COLUMN_MAX_CHARS[key];
        const text = maxChars ? truncate(rawValue, maxChars) : rawValue;
        page.drawText(text, { x: COLUMN_X[key], y, size: 8, font, color: rgb(0, 0, 0) });
      }
      totalCents += line.valorCents;
      y -= LINE_HEIGHT;
    }

    ensureSpace();
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 16;
    page.drawText(`Total geral: ${formatCurrencyCents(totalCents)}`, {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  }

  return pdfDoc.save();
}

export async function GET(request: NextRequest) {
  await requireRole('gestor', 'financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const { searchParams } = new URL(request.url);
  const de = searchParams.get('de') ?? undefined;
  const ate = searchParams.get('ate') ?? undefined;
  const departmentId = searchParams.get('department_id') ?? undefined;
  const costCenterId = searchParams.get('cost_center_id') ?? undefined;
  const rawStatus = searchParams.get('status') ?? undefined;
  const status = isPurchaseStatus(rawStatus) ? rawStatus : undefined;
  const formato = searchParams.get('formato') === 'pdf' ? 'pdf' : 'excel';

  const rows = await fetchAllMatchingPurchases(supabase, { de, ate, departmentId, costCenterId, status });
  const lines = await buildReportLines(supabase, rows);

  if (formato === 'pdf') {
    const pdfBytes = await buildPdfResponse(lines, { de, ate });
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="relatorio-conciliacao.pdf"',
      },
    });
  }

  const excelBuffer = await buildExcelResponse(lines);
  return new NextResponse(Buffer.from(excelBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="relatorio-conciliacao.xlsx"',
    },
  });
}
