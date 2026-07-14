'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_PATH = '/configuracoes/cartoes';

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

const cardSchema = z.object({
  last_four_digits: z.string().regex(/^\d{4}$/, 'Informe exatamente 4 dígitos.'),
  holder_id: z.string(),
  department_id: z.string().min(1, 'Selecione um setor.'),
});

export async function createCard(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const parsed = cardSchema.safeParse({
    last_four_digits: String(formData.get('last_four_digits') ?? '').trim(),
    holder_id: String(formData.get('holder_id') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '').trim(),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const active = formData.get('active') === 'on';

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('cards').insert({
    last_four_digits: parsed.data.last_four_digits,
    holder_id: parsed.data.holder_id || null,
    department_id: parsed.data.department_id,
    active,
  });

  if (error) {
    redirectWithError('Não foi possível salvar o cartão.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateCard(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  const parsed = cardSchema.safeParse({
    last_four_digits: String(formData.get('last_four_digits') ?? '').trim(),
    holder_id: String(formData.get('holder_id') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '').trim(),
  });

  if (!id) redirectWithError('Cartão inválido.');
  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const active = formData.get('active') === 'on';

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('cards')
    .update({
      last_four_digits: parsed.data.last_four_digits,
      holder_id: parsed.data.holder_id || null,
      department_id: parsed.data.department_id,
      active,
    })
    .eq('id', id);

  if (error) {
    redirectWithError('Não foi possível atualizar o cartão.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteCard(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirectWithError('Cartão inválido.');

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('cards').delete().eq('id', id);

  if (error) {
    redirectWithError('Não foi possível excluir o cartão. Verifique se não há compras ou faturas vinculadas a ele.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
