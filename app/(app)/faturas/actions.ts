'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parseInvoiceFile, type ParsedFile } from '@/lib/parsers';

const BASE_PATH = '/faturas';

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

/**
 * Etapa 1 do fluxo de conciliação: recebe o arquivo bruto da operadora, faz o
 * parsing (CSV/XLSX/OFX), envia o arquivo original para o Storage, grava a
 * fatura e todas as linhas cruas, e encaminha para a tela de mapeamento de
 * colunas (etapa 2). Nenhum `invoice_item` é criado aqui ainda — isso só
 * acontece depois que o usuário confirmar o mapeamento.
 */
export async function uploadInvoice(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const cardId = String(formData.get('card_id') ?? '').trim();
  const referenceMonthInput = String(formData.get('reference_month') ?? '').trim();
  const file = formData.get('file');

  if (!cardId) redirectWithError('Selecione o cartão da fatura.');
  if (!/^\d{4}-\d{2}$/.test(referenceMonthInput)) redirectWithError('Informe o mês de referência.');
  if (!(file instanceof File) || file.size === 0) redirectWithError('Selecione o arquivo da fatura.');

  const referenceMonth = `${referenceMonthInput}-01`;

  let parsed: ParsedFile;
  try {
    parsed = await parseInvoiceFile(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao ler o arquivo da fatura.';
    redirectWithError(message);
  }

  if (parsed.rows.length === 0) {
    redirectWithError('O arquivo não contém linhas reconhecíveis. Verifique o formato e tente novamente.');
  }

  const supabase = await createServerSupabaseClient();

  // Gera o id da fatura antecipadamente para poder usá-lo como pasta no Storage
  // antes do insert em `invoices` (que exige file_path não-nulo).
  const invoiceId = crypto.randomUUID();
  const objectPath = `${invoiceId}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(objectPath, file, { contentType: file.type || 'application/octet-stream' });

  if (uploadError) {
    redirectWithError(`Falha ao enviar o arquivo para o armazenamento: ${uploadError.message}`);
  }

  const { error: invoiceError } = await supabase.from('invoices').insert({
    id: invoiceId,
    card_id: cardId,
    reference_month: referenceMonth,
    file_path: objectPath,
    file_name: file.name,
    status: 'mapping',
    imported_by: profile.id,
  });

  if (invoiceError) {
    await supabase.storage.from('invoices').remove([objectPath]);
    redirectWithError(`Falha ao registrar a fatura: ${invoiceError.message}`);
  }

  const rawRows = parsed.rows.map((row) => ({
    invoice_id: invoiceId,
    row_index: row.rowIndex,
    raw_data: row.columns,
  }));

  const { error: rawRowsError } = await supabase.from('invoice_raw_rows').insert(rawRows);

  if (rawRowsError) {
    redirectWithError(`Falha ao salvar as linhas da fatura: ${rawRowsError.message}`);
  }

  redirect(`/faturas/${invoiceId}/mapear`);
}
