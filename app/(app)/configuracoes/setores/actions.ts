'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_PATH = '/configuracoes/setores';

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

const departmentSchema = z.object({
  name: z.string().min(1, 'Informe o nome do setor.'),
  manager_id: z.string(),
});

export async function createDepartment(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const parsed = departmentSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    manager_id: String(formData.get('manager_id') ?? '').trim(),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('departments').insert({
    name: parsed.data.name,
    manager_id: parsed.data.manager_id || null,
  });

  if (error) {
    if (error.code === '23505') redirectWithError('Já existe um setor com esse nome.');
    redirectWithError('Não foi possível salvar o setor.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateDepartment(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  const parsed = departmentSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    manager_id: String(formData.get('manager_id') ?? '').trim(),
  });

  if (!id) redirectWithError('Setor inválido.');
  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('departments')
    .update({
      name: parsed.data.name,
      manager_id: parsed.data.manager_id || null,
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') redirectWithError('Já existe um setor com esse nome.');
    redirectWithError('Não foi possível atualizar o setor.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteDepartment(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirectWithError('Setor inválido.');

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('departments').delete().eq('id', id);

  if (error) {
    redirectWithError(
      'Não foi possível excluir o setor. Verifique se não há cartões vinculados a ele.',
    );
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
