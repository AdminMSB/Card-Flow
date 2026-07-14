'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeRows, type ColumnMapping, type ParsedFile } from '@/lib/parsers';
import {
  suggestMatches,
  AUTO_MATCH_THRESHOLD,
  type MatchableInvoiceItem,
  type MatchableCandidatePurchase,
} from '@/lib/matching/engine';

function mapearPath(invoiceId: string): string {
  return `/faturas/${invoiceId}/mapear`;
}

function redirectWithError(invoiceId: string, message: string): never {
  redirect(`${mapearPath(invoiceId)}?error=${encodeURIComponent(message)}`);
}

/**
 * Etapa 2 do fluxo: aplica o mapeamento de colunas escolhido a TODAS as linhas
 * cruas da fatura (não só a amostra mostrada na tela), grava os `invoice_items`
 * normalizados, marca a fatura como 'reconciling' e já roda o motor de sugestão
 * de conciliação — gravando como 'auto_matched' os pares com score acima do
 * limiar de confiança automática. O usuário ainda confirma cada sugestão na
 * tela de conciliação (etapa 3); nada é fechado sozinho aqui.
 */
export async function confirmMapping(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) redirect('/faturas');

  const dateColumn = String(formData.get('date_column') ?? '').trim();
  const amountColumn = String(formData.get('amount_column') ?? '').trim();
  const descriptionColumn = String(formData.get('description_column') ?? '').trim();

  if (!dateColumn || !amountColumn || !descriptionColumn) {
    redirectWithError(invoiceId, 'Selecione as três colunas (data, valor e descrição) antes de confirmar.');
  }

  const mapping: ColumnMapping = { date: dateColumn, amount: amountColumn, description: descriptionColumn };

  const supabase = await createServerSupabaseClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    redirect('/faturas');
  }

  const { data: rawRows, error: rawRowsError } = await supabase
    .from('invoice_raw_rows')
    .select('row_index, raw_data')
    .eq('invoice_id', invoiceId)
    .order('row_index', { ascending: true });

  if (rawRowsError || !rawRows || rawRows.length === 0) {
    redirectWithError(invoiceId, 'Não foi possível carregar as linhas da fatura para aplicar o mapeamento.');
  }

  // Headers = união das chaves de todas as linhas cruas (arquivos podem ter
  // linhas com colunas inconsistentes entre si).
  const headerSet = new Set<string>();
  for (const row of rawRows) {
    Object.keys(row.raw_data as Record<string, string>).forEach((key) => headerSet.add(key));
  }

  const parsedFile: ParsedFile = {
    headers: Array.from(headerSet),
    rows: rawRows.map((row) => ({
      rowIndex: row.row_index,
      columns: row.raw_data as Record<string, string>,
    })),
  };

  const normalized = normalizeRows(parsedFile, mapping);

  if (normalized.length === 0) {
    redirectWithError(
      invoiceId,
      'Nenhuma linha válida foi encontrada com esse mapeamento. Revise as colunas escolhidas.',
    );
  }

  const { data: insertedItems, error: itemsError } = await supabase
    .from('invoice_items')
    .insert(
      normalized.map((line) => ({
        invoice_id: invoiceId,
        item_date: line.itemDate,
        amount_cents: line.amountCents,
        merchant_raw: line.merchantRaw,
        description_raw: line.descriptionRaw,
      })),
    )
    .select('id, item_date, amount_cents, merchant_raw');

  if (itemsError || !insertedItems) {
    redirectWithError(invoiceId, `Falha ao gravar os itens da fatura: ${itemsError?.message ?? 'erro desconhecido'}.`);
  }

  // Literal fresh (não a variável `mapping` tipada como ColumnMapping) para que o
  // TypeScript aceite a atribuição a `column_mapping: Record<string, string> | null`
  // sem exigir uma assinatura de índice explícita no tipo ColumnMapping.
  const { error: updateInvoiceError } = await supabase
    .from('invoices')
    .update({
      column_mapping: { date: dateColumn, amount: amountColumn, description: descriptionColumn },
      status: 'reconciling',
    })
    .eq('id', invoiceId);

  if (updateInvoiceError) {
    redirectWithError(invoiceId, `Falha ao atualizar a fatura: ${updateInvoiceError.message}.`);
  }

  // Sugestão automática de conciliação: só compras 'approved' do mesmo cartão
  // entram como candidatas (uma compra 'reconciled' já foi usada em outra fatura).
  const { data: candidatePurchases } = await supabase
    .from('purchases')
    .select('id, card_id, purchase_date, amount_cents, merchant_name')
    .eq('card_id', invoice.card_id)
    .eq('status', 'approved');

  const matchableItems: MatchableInvoiceItem[] = insertedItems.map((item) => ({
    id: item.id,
    itemDate: item.item_date,
    amountCents: item.amount_cents,
    merchantRaw: item.merchant_raw,
  }));

  const matchableCandidates: MatchableCandidatePurchase[] = (candidatePurchases ?? []).map((purchase) => ({
    id: purchase.id,
    cardId: purchase.card_id,
    purchaseDate: purchase.purchase_date,
    amountCents: purchase.amount_cents,
    merchantName: purchase.merchant_name,
  }));

  const suggestions = suggestMatches(matchableItems, matchableCandidates);

  for (const suggestion of suggestions) {
    if (suggestion.score < AUTO_MATCH_THRESHOLD) continue;

    const { error: matchUpdateError } = await supabase
      .from('invoice_items')
      .update({
        matched_purchase_id: suggestion.purchaseId,
        match_status: 'auto_matched',
        match_confidence: suggestion.score,
      })
      .eq('id', suggestion.invoiceItemId);

    if (matchUpdateError) continue;

    await supabase.from('reconciliation_audit_log').insert({
      invoice_item_id: suggestion.invoiceItemId,
      action: 'auto_matched',
      performed_by: profile.id,
      notes: `Sugestão automática com score de ${Math.round(suggestion.score * 100)}%.`,
    });
  }

  redirect(`/faturas/${invoiceId}/conciliacao`);
}
