'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Redireciona para /aprovacoes com uma mensagem de erro amigável na query string. */
function fail(message: string): never {
  redirect(`/aprovacoes?error=${encodeURIComponent(message)}`);
}

const approveSchema = z.object({
  purchaseOrderCode: z.string().trim().min(1, 'Informe o código da OC ou Diário de Fatura.'),
});

export async function approvePurchase(formData: FormData) {
  const profile = await requireRole('gestor', 'financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const id = String(formData.get('id') ?? '');
  if (!id) fail('Compra inválida.');

  const parsed = approveSchema.safeParse({ purchaseOrderCode: String(formData.get('purchaseOrderCode') ?? '') });
  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? 'Informe o código da OC ou Diário de Fatura.');
  }

  // RLS garante que só um gestor/financeiro/admin com visibilidade sobre a compra
  // consegue atualizar; o filtro por status evita reaprovar algo já decidido.
  const { error } = await supabase
    .from('purchases')
    .update({
      status: 'approved',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
      approval_notes: null,
      purchase_order_code: parsed.data.purchaseOrderCode,
    })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) fail('Não foi possível aprovar a compra.');

  revalidatePath('/aprovacoes');
  revalidatePath('/compras');
  redirect('/aprovacoes');
}

const rejectSchema = z.object({
  notes: z.string().trim().min(3, 'Informe uma observação com pelo menos 3 caracteres.'),
});

export async function rejectPurchase(formData: FormData) {
  const profile = await requireRole('gestor', 'financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const id = String(formData.get('id') ?? '');
  if (!id) fail('Compra inválida.');

  const parsed = rejectSchema.safeParse({ notes: String(formData.get('notes') ?? '') });
  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? 'Informe uma observação válida.');
  }

  const { error } = await supabase
    .from('purchases')
    .update({
      status: 'rejected',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
      approval_notes: parsed.data.notes,
    })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) fail('Não foi possível rejeitar a compra.');

  revalidatePath('/aprovacoes');
  redirect('/aprovacoes');
}
