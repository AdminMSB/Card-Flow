'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parseCurrencyToCents } from '@/lib/format';

const ACCEPTED_RECEIPT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const purchaseSchema = z.object({
  cardId: z.string().min(1, 'Selecione um cartão.'),
  purchaseDate: z.string().min(1, 'Informe a data da compra.'),
  amount: z.string().min(1, 'Informe o valor da compra.'),
  merchantName: z.string().trim().min(1, 'Informe o estabelecimento.'),
  categoryId: z.string(),
  costCenterId: z.string(),
  description: z.string(),
  requisitionNumber: z.string(),
  purchaseOrderCode: z.string(),
  supplierName: z.string(),
  supplierCnpj: z.string(),
  invoiceDocumentNumber: z.string(),
});

/** Redireciona para /compras com uma mensagem de erro amigável na query string. */
function fail(message: string): never {
  redirect(`/compras?error=${encodeURIComponent(message)}`);
}

function parsePurchaseFields(formData: FormData) {
  const parsed = purchaseSchema.safeParse({
    cardId: String(formData.get('cardId') ?? ''),
    purchaseDate: String(formData.get('purchaseDate') ?? ''),
    amount: String(formData.get('amount') ?? ''),
    merchantName: String(formData.get('merchantName') ?? ''),
    categoryId: String(formData.get('categoryId') ?? ''),
    costCenterId: String(formData.get('costCenterId') ?? ''),
    description: String(formData.get('description') ?? ''),
    requisitionNumber: String(formData.get('requisitionNumber') ?? ''),
    purchaseOrderCode: String(formData.get('purchaseOrderCode') ?? ''),
    supplierName: String(formData.get('supplierName') ?? ''),
    supplierCnpj: String(formData.get('supplierCnpj') ?? ''),
    invoiceDocumentNumber: String(formData.get('invoiceDocumentNumber') ?? ''),
  });

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const amountCents = parseCurrencyToCents(parsed.data.amount);
  if (amountCents <= 0) {
    fail('Informe um valor válido maior que zero.');
  }

  return { ...parsed.data, amountCents };
}

/** Extrai o arquivo de comprovante do FormData, validando tipo e tamanho. Retorna null se nenhum arquivo foi enviado. */
function extractReceiptFile(formData: FormData): File | null {
  const entry = formData.get('receipt');
  const file = entry instanceof File && entry.size > 0 ? entry : null;
  if (!file) return null;

  if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
    fail('Comprovante deve ser uma imagem ou PDF.');
  }
  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    fail('Comprovante deve ter no máximo 10MB.');
  }

  return file;
}

export async function createPurchase(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const fields = parsePurchaseFields(formData);
  const file = extractReceiptFile(formData);

  const { data: inserted, error: insertError } = await supabase
    .from('purchases')
    .insert({
      card_id: fields.cardId,
      user_id: profile.id,
      purchase_date: fields.purchaseDate,
      amount_cents: fields.amountCents,
      merchant_name: fields.merchantName,
      category_id: fields.categoryId || null,
      cost_center_id: fields.costCenterId || null,
      description: fields.description || null,
      requisition_number: fields.requisitionNumber || null,
      purchase_order_code: fields.purchaseOrderCode || null,
      supplier_name: fields.supplierName || null,
      supplier_cnpj: fields.supplierCnpj || null,
      invoice_document_number: fields.invoiceDocumentNumber || null,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    fail('Não foi possível registrar a compra. Tente novamente.');
  }

  // Só faz upload depois que a compra foi criada com sucesso (evita comprovante "órfão").
  if (file) {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
    const path = `${profile.id}/${inserted.id}${extension ? `.${extension}` : ''}`;

    const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

    if (!uploadError) {
      await supabase.from('purchases').update({ receipt_path: path }).eq('id', inserted.id);
    }
    // Se o upload falhar, a compra permanece registrada sem comprovante; o usuário pode
    // editá-la (enquanto pending) para enviar o comprovante novamente.
  }

  revalidatePath('/compras');
  redirect('/compras');
}

export async function updatePurchase(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const id = String(formData.get('id') ?? '');
  if (!id) fail('Compra inválida.');

  const { data: existing } = await supabase
    .from('purchases')
    .select('id, user_id, status, receipt_path')
    .eq('id', id)
    .single();

  if (!existing) fail('Compra não encontrada.');
  if (existing.user_id !== profile.id || existing.status !== 'pending') {
    fail('Esta compra não pode mais ser editada.');
  }

  const fields = parsePurchaseFields(formData);
  const file = extractReceiptFile(formData);

  let receiptPath = existing.receipt_path;
  if (file) {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
    const path = `${profile.id}/${id}${extension ? `.${extension}` : ''}`;

    const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) fail('Não foi possível enviar o comprovante.');
    receiptPath = path;
  }

  const { error: updateError } = await supabase
    .from('purchases')
    .update({
      card_id: fields.cardId,
      purchase_date: fields.purchaseDate,
      amount_cents: fields.amountCents,
      merchant_name: fields.merchantName,
      category_id: fields.categoryId || null,
      cost_center_id: fields.costCenterId || null,
      description: fields.description || null,
      requisition_number: fields.requisitionNumber || null,
      purchase_order_code: fields.purchaseOrderCode || null,
      supplier_name: fields.supplierName || null,
      supplier_cnpj: fields.supplierCnpj || null,
      invoice_document_number: fields.invoiceDocumentNumber || null,
      receipt_path: receiptPath,
    })
    .eq('id', id)
    .eq('status', 'pending');

  if (updateError) fail('Não foi possível atualizar a compra.');

  revalidatePath('/compras');
  redirect('/compras');
}

export async function deletePurchase(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const id = String(formData.get('id') ?? '');
  if (!id) fail('Compra inválida.');

  const { data: existing } = await supabase
    .from('purchases')
    .select('id, user_id, status, receipt_path')
    .eq('id', id)
    .single();

  if (!existing) fail('Compra não encontrada.');
  if (existing.user_id !== profile.id || existing.status !== 'pending') {
    fail('Esta compra não pode mais ser excluída.');
  }

  const { error: deleteError } = await supabase.from('purchases').delete().eq('id', id).eq('status', 'pending');

  if (deleteError) fail('Não foi possível excluir a compra.');

  if (existing.receipt_path) {
    await supabase.storage.from('receipts').remove([existing.receipt_path]);
  }

  revalidatePath('/compras');
  redirect('/compras');
}
