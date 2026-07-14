'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_PATH = '/configuracoes/centros-de-custo';

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

const costCenterSchema = z.object({
  name: z.string().min(1, 'Informe o nome do centro de custo.'),
  code: z.string().min(1, 'Informe o código do centro de custo.'),
});

export async function createCostCenter(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const parsed = costCenterSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    code: String(formData.get('code') ?? '').trim(),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('cost_centers').insert({
    name: parsed.data.name,
    code: parsed.data.code,
  });

  if (error) {
    if (error.code === '23505') redirectWithError('Já existe um centro de custo com esse código.');
    redirectWithError('Não foi possível salvar o centro de custo.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateCostCenter(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  const parsed = costCenterSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    code: String(formData.get('code') ?? '').trim(),
  });

  if (!id) redirectWithError('Centro de custo inválido.');
  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('cost_centers')
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') redirectWithError('Já existe um centro de custo com esse código.');
    redirectWithError('Não foi possível atualizar o centro de custo.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteCostCenter(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirectWithError('Centro de custo inválido.');

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('cost_centers').delete().eq('id', id);

  if (error) {
    redirectWithError('Não foi possível excluir o centro de custo.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
