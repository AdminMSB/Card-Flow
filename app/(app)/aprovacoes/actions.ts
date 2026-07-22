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

export async function approvePurchase(formData: FormData) {
  const profile = await requireRole('gestor', 'financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const id = String(formData.get('id') ?? '');
  if (!id) fail('Compra inválida.');

  const newCode = String(formData.get('purchaseOrderCode') ?? '').trim();

  // A compra pode já ter lançamento registrado no cadastro/edição (uma linha pode ter OC
  // e Diário de Fatura); só exigimos um aqui se ainda não existir nenhum.
  const { count: existingCodeCount } = await supabase
    .from('purchase_order_codes')
    .select('id', { count: 'exact', head: true })
    .eq('purchase_id', id);

  if (!newCode && !existingCodeCount) {
    fail('Informe o código da OC ou Diário de Fatura.');
  }

  if (newCode) {
    const { error: codeError } = await supabase.from('purchase_order_codes').insert({ purchase_id: id, code: newCode });
    if (codeError) fail('Não foi possível registrar o código de lançamento.');
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
