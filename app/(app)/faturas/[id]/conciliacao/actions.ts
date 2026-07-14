'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function conciliacaoPath(invoiceId: string): string {
  return `/faturas/${invoiceId}/conciliacao`;
}

function redirectWithError(invoiceId: string, message: string): never {
  redirect(`${conciliacaoPath(invoiceId)}?error=${encodeURIComponent(message)}`);
}

async function insertAuditLog(
  supabase: SupabaseServerClient,
  invoiceItemId: string,
  action: string,
  performedBy: string,
  notes: string | null = null,
): Promise<void> {
  await supabase.from('reconciliation_audit_log').insert({
    invoice_item_id: invoiceItemId,
    action,
    performed_by: performedBy,
    notes,
  });
}

/**
 * Confirma uma sugestão automática ('auto_matched'). DECISÃO DE DESIGN: o
 * match_status permanece 'auto_matched' — esse status já significa "sugestão
 * pendente de confirmação humana", então confirmar não precisa de um novo
 * valor de enum. O que marca a confirmação é a entrada 'confirmed' gravada em
 * `reconciliation_audit_log`; a tela de conciliação lê essas entradas (uma
 * única query em lote) e exibe um selo "Confirmado" nos itens já confirmados,
 * sem duplicar o significado de 'manually_matched' (reservado para match
 * humano-iniciado do zero). A compra vinculada só passa a 'reconciled' quando
 * a fatura é fechada (confirmação implícita final) ou se o item for
 * explicitamente conciliado manualmente.
 */
export async function confirmSuggestion(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) redirect('/faturas');

  const invoiceItemId = String(formData.get('invoice_item_id') ?? '').trim();
  if (!invoiceItemId) redirectWithError(invoiceId, 'Item inválido.');

  const supabase = await createServerSupabaseClient();
  await insertAuditLog(supabase, invoiceItemId, 'confirmed', profile.id);

  revalidatePath(conciliacaoPath(invoiceId));
  redirect(conciliacaoPath(invoiceId));
}

/** Rejeita uma sugestão automática: o item volta para 'unmatched' para ser tratado manualmente. */
export async function rejectSuggestion(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) redirect('/faturas');

  const invoiceItemId = String(formData.get('invoice_item_id') ?? '').trim();
  if (!invoiceItemId) redirectWithError(invoiceId, 'Item inválido.');

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('invoice_items')
    .update({ matched_purchase_id: null, match_status: 'unmatched', match_confidence: null })
    .eq('id', invoiceItemId);

  if (error) redirectWithError(invoiceId, 'Não foi possível rejeitar a sugestão.');

  await insertAuditLog(supabase, invoiceItemId, 'unmatched', profile.id, 'Sugestão automática rejeitada.');

  revalidatePath(conciliacaoPath(invoiceId));
  redirect(conciliacaoPath(invoiceId));
}

/** Concilia manualmente um item sem correspondência com a compra escolhida pelo usuário. */
export async function manualMatch(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) redirect('/faturas');

  const invoiceItemId = String(formData.get('invoice_item_id') ?? '').trim();
  const purchaseId = String(formData.get('purchase_id') ?? '').trim();

  if (!invoiceItemId || !purchaseId) {
    redirectWithError(invoiceId, 'Selecione uma compra para conciliar manualmente.');
  }

  const supabase = await createServerSupabaseClient();

  const { error: itemError } = await supabase
    .from('invoice_items')
    .update({ matched_purchase_id: purchaseId, match_status: 'manually_matched', match_confidence: null })
    .eq('id', invoiceItemId);

  if (itemError) redirectWithError(invoiceId, 'Não foi possível conciliar manualmente este item.');

  const { error: purchaseError } = await supabase
    .from('purchases')
    .update({ status: 'reconciled' })
    .eq('id', purchaseId);

  if (purchaseError) {
    redirectWithError(invoiceId, 'Item conciliado, mas houve falha ao atualizar o status da compra.');
  }

  await insertAuditLog(supabase, invoiceItemId, 'manually_matched', profile.id);

  revalidatePath(conciliacaoPath(invoiceId));
  redirect(conciliacaoPath(invoiceId));
}

/** Marca um item sem correspondência como disputa, com observação obrigatória. */
export async function markDisputed(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) redirect('/faturas');

  const invoiceItemId = String(formData.get('invoice_item_id') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!invoiceItemId) redirectWithError(invoiceId, 'Item inválido.');
  if (!notes) redirectWithError(invoiceId, 'Informe uma observação explicando a disputa.');

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('invoice_items').update({ match_status: 'disputed' }).eq('id', invoiceItemId);

  if (error) redirectWithError(invoiceId, 'Não foi possível marcar este item como disputa.');

  await insertAuditLog(supabase, invoiceItemId, 'disputed', profile.id, notes);

  revalidatePath(conciliacaoPath(invoiceId));
  redirect(conciliacaoPath(invoiceId));
}

/**
 * Desfaz uma conciliação (manual ou já confirmada): o item volta para
 * 'unmatched' e, se havia uma compra vinculada, ela volta para 'approved'
 * para poder ser conciliada de novo (com esta fatura ou outra).
 */
export async function undoMatch(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) redirect('/faturas');

  const invoiceItemId = String(formData.get('invoice_item_id') ?? '').trim();
  if (!invoiceItemId) redirectWithError(invoiceId, 'Item inválido.');

  const purchaseId = String(formData.get('purchase_id') ?? '').trim();

  const supabase = await createServerSupabaseClient();

  const { error: itemError } = await supabase
    .from('invoice_items')
    .update({ matched_purchase_id: null, match_status: 'unmatched', match_confidence: null })
    .eq('id', invoiceItemId);

  if (itemError) redirectWithError(invoiceId, 'Não foi possível desfazer esta conciliação.');

  if (purchaseId) {
    await supabase.from('purchases').update({ status: 'approved' }).eq('id', purchaseId);
  }

  await insertAuditLog(supabase, invoiceItemId, 'unmatched', profile.id, 'Conciliação desfeita.');

  revalidatePath(conciliacaoPath(invoiceId));
  redirect(conciliacaoPath(invoiceId));
}

/**
 * Fecha a fatura: só é permitido quando não há mais itens 'unmatched' (itens
 * em disputa são um estado terminal aceitável, tratado fora do sistema).
 * Fechar a fatura é a confirmação implícita final de qualquer sugestão
 * automática ainda pendente — por isso promove todo item 'auto_matched'
 * remanescente para 'manually_matched' e reconcilia a compra vinculada.
 */
export async function closeInvoice(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) redirect('/faturas');

  const supabase = await createServerSupabaseClient();

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('id, match_status, matched_purchase_id')
    .eq('invoice_id', invoiceId);

  if (itemsError || !items) {
    redirectWithError(invoiceId, 'Não foi possível carregar os itens da fatura.');
  }

  const hasUnmatched = items.some((item) => item.match_status === 'unmatched');
  if (hasUnmatched) {
    redirectWithError(
      invoiceId,
      'Ainda há itens sem correspondência. Concilie manualmente ou marque como disputa antes de fechar a fatura.',
    );
  }

  const pendingAutoMatched = items.filter((item) => item.match_status === 'auto_matched');

  for (const item of pendingAutoMatched) {
    const { error: updateError } = await supabase
      .from('invoice_items')
      .update({ match_status: 'manually_matched' })
      .eq('id', item.id);

    if (updateError) continue;

    if (item.matched_purchase_id) {
      await supabase.from('purchases').update({ status: 'reconciled' }).eq('id', item.matched_purchase_id);
    }

    await insertAuditLog(supabase, item.id, 'confirmed', profile.id, 'Confirmado implicitamente ao fechar a fatura.');
  }

  const { error: closeError } = await supabase
    .from('invoices')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (closeError) redirectWithError(invoiceId, 'Não foi possível fechar a fatura.');

  revalidatePath('/faturas');
  revalidatePath(conciliacaoPath(invoiceId));
  redirect('/faturas');
}
