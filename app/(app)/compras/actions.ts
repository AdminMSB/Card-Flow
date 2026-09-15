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
  requesterName: z.string().trim().min(1, 'Informe o solicitante.'),
  purchaseDate: z.string().min(1, 'Informe a data da compra.'),
  amount: z.string().min(1, 'Informe o valor da compra.'),
  discount: z.string(),
  surcharge: z.string(),
  merchantName: z.string(),
  supplierName: z.string(),
  departmentId: z.string(),
  description: z.string(),
  requisitionNumber: z.string(),
  supplierCnpj: z.string(),
});

/** Redireciona para /compras com uma mensagem de erro amigável na query string. */
function fail(message: string): never {
  redirect(`/compras?error=${encodeURIComponent(message)}`);
}

interface DocumentRow {
  documentNumber: string | null;
  amountCents: number | null;
}

/** Uma linha pode ter mais de um lançamento (OC + Diário de Fatura) — os campos chegam
 * como múltiplos valores com o mesmo name (FormData.getAll), aqui só filtramos os em
 * branco. */
function parseTextList(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
}

/** Uma OC pode ter mais de uma NF anexada, cada uma com seu próprio valor (opcional) —
 * número e valor chegam em arrays paralelos (mesmo índice = mesma linha do formulário).
 * Uma linha totalmente em branco (nem número nem valor) é descartada; uma linha com só o
 * valor (ex.: número da NF ilegível/não identificado) fica registrada mesmo assim — o
 * número pode ser completado depois. */
function parseDocumentRows(formData: FormData): DocumentRow[] {
  const numbers = formData.getAll('invoiceDocumentNumber').map((value) => String(value).trim());
  const amounts = formData.getAll('invoiceDocumentAmount').map((value) => String(value).trim());

  const rows: DocumentRow[] = [];
  numbers.forEach((documentNumber, index) => {
    const amountText = amounts[index] ?? '';
    const amountCents = amountText ? parseCurrencyToCents(amountText) : 0;
    if (!documentNumber && amountCents <= 0) return;
    rows.push({ documentNumber: documentNumber || null, amountCents: amountCents > 0 ? amountCents : null });
  });
  return rows;
}

function parsePurchaseFields(formData: FormData) {
  const parsed = purchaseSchema.safeParse({
    cardId: String(formData.get('cardId') ?? ''),
    requesterName: String(formData.get('requesterName') ?? ''),
    purchaseDate: String(formData.get('purchaseDate') ?? ''),
    amount: String(formData.get('amount') ?? ''),
    discount: String(formData.get('discount') ?? ''),
    surcharge: String(formData.get('surcharge') ?? ''),
    merchantName: String(formData.get('merchantName') ?? ''),
    supplierName: String(formData.get('supplierName') ?? ''),
    departmentId: String(formData.get('departmentId') ?? ''),
    description: String(formData.get('description') ?? ''),
    requisitionNumber: String(formData.get('requisitionNumber') ?? ''),
    supplierCnpj: String(formData.get('supplierCnpj') ?? ''),
  });

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const orderCodes = parseTextList(formData, 'purchaseOrderCode');
  const invoiceDocuments = parseDocumentRows(formData);

  // O valor da compra é a soma dos documentos anexados, quando algum deles tiver valor
  // informado (a UI já calcula isso e reflete no campo Valor, mas recalculamos aqui como
  // fonte da verdade — não dá pra confiar só no que o cliente enviou), ajustada por
  // desconto/acréscimo — a fatura do cartão pode vir com esse valor líquido/bruto
  // diferente do que a NF ou os documentos somam.
  const documentsTotalCents = invoiceDocuments.reduce((sum, document) => sum + (document.amountCents ?? 0), 0);
  const baseAmountCents = documentsTotalCents > 0 ? documentsTotalCents : parseCurrencyToCents(parsed.data.amount);
  const discountCents = parsed.data.discount ? parseCurrencyToCents(parsed.data.discount) : 0;
  const surchargeCents = parsed.data.surcharge ? parseCurrencyToCents(parsed.data.surcharge) : 0;
  const amountCents = baseAmountCents - discountCents + surchargeCents;
  if (amountCents <= 0) {
    fail('Informe um valor válido maior que zero.');
  }

  // Site é sempre manual — nunca herda o Fornecedor (nem toda compra passa por uma
  // plataforma, e ficar preenchido "sozinho" com o valor do Fornecedor só confundia,
  // reaparecendo como se tivesse sido digitado). Fornecedor também é opcional na compra
  // online: às vezes só se sabe o nome dele quando a NF chega — a compra fica registrada
  // incompleta (pendente) até ser complementada na edição. Só exigimos que pelo menos um
  // dos dois esteja preenchido.
  const supplierName = parsed.data.supplierName.trim();
  const merchantName = parsed.data.merchantName.trim();
  if (!merchantName && !supplierName) {
    fail('Informe o Site ou o Fornecedor.');
  }

  return {
    ...parsed.data,
    amountCents,
    discountCents,
    surchargeCents,
    merchantName: merchantName || null,
    supplierName,
    orderCodes,
    invoiceDocuments,
  };
}

/** Substitui a lista de lançamentos/documentos de uma compra pelas listas atuais do
 * formulário (mais simples que diffar linha a linha, e o volume por compra é pequeno). */
async function replaceLineItems(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  purchaseId: string,
  orderCodes: string[],
  invoiceDocuments: DocumentRow[],
) {
  const { error: deleteCodesError } = await supabase.from('purchase_order_codes').delete().eq('purchase_id', purchaseId);
  const { error: deleteDocsError } = await supabase
    .from('purchase_invoice_documents')
    .delete()
    .eq('purchase_id', purchaseId);
  if (deleteCodesError || deleteDocsError) {
    fail('Não foi possível atualizar os lançamentos/documentos da compra.');
  }

  if (orderCodes.length > 0) {
    const { error } = await supabase
      .from('purchase_order_codes')
      .insert(orderCodes.map((code) => ({ purchase_id: purchaseId, code })));
    if (error) fail('Não foi possível salvar os lançamentos (OC/Diário de Fatura).');
  }
  if (invoiceDocuments.length > 0) {
    const { error } = await supabase.from('purchase_invoice_documents').insert(
      invoiceDocuments.map((document) => ({
        purchase_id: purchaseId,
        document_number: document.documentNumber,
        amount_cents: document.amountCents,
      })),
    );
    if (error) fail('Não foi possível salvar os documentos (NF/fatura/boleto).');
  }
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
      requester_name: fields.requesterName,
      purchase_date: fields.purchaseDate,
      amount_cents: fields.amountCents,
      discount_cents: fields.discountCents,
      surcharge_cents: fields.surchargeCents,
      merchant_name: fields.merchantName,
      supplier_name: fields.supplierName || null,
      department_id: fields.departmentId || null,
      description: fields.description || null,
      requisition_number: fields.requisitionNumber || null,
      supplier_cnpj: fields.supplierCnpj || null,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    fail('Não foi possível registrar a compra. Tente novamente.');
  }

  await replaceLineItems(supabase, inserted.id, fields.orderCodes, fields.invoiceDocuments);

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

  // Quem registrou a compra pode editá-la; gestor/financeiro/admin também podem, para
  // completar/corrigir dados antes de liberar (a RLS ainda restringe o gestor ao setor
  // do cartão, então uma tentativa fora do escopo dele simplesmente não afeta nenhuma linha).
  const isOwner = existing.user_id === profile.id;
  const canEditAnyPending = ['gestor', 'financeiro', 'admin'].includes(profile.role);
  if (existing.status !== 'pending' || !(isOwner || canEditAnyPending)) {
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

    // Se o upload falhar, mantém o comprovante anterior (ou nenhum) e segue salvando o
    // resto da edição — igual ao cadastro novo; perder Site/Fornecedor/etc. só porque o
    // anexo não subiu seria pior do que só pedir pra reenviar o comprovante depois.
    if (!uploadError) {
      receiptPath = path;
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('purchases')
    .update({
      card_id: fields.cardId,
      requester_name: fields.requesterName,
      purchase_date: fields.purchaseDate,
      amount_cents: fields.amountCents,
      discount_cents: fields.discountCents,
      surcharge_cents: fields.surchargeCents,
      merchant_name: fields.merchantName,
      supplier_name: fields.supplierName || null,
      department_id: fields.departmentId || null,
      description: fields.description || null,
      requisition_number: fields.requisitionNumber || null,
      supplier_cnpj: fields.supplierCnpj || null,
      receipt_path: receiptPath,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  // `updated` vem null tanto em erro real quanto quando a RLS silenciosamente não afeta
  // nenhuma linha (ex.: gestor tentando editar uma compra fora do setor dele). Mostra o
  // motivo exato do Postgres (temporário, pra diagnosticar) em vez de uma mensagem genérica.
  if (updateError) fail(`Não foi possível atualizar a compra: ${updateError.message}`);
  if (!updated) fail('Não foi possível atualizar a compra (nenhuma linha afetada — permissão?).');

  await replaceLineItems(supabase, id, fields.orderCodes, fields.invoiceDocuments);

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
