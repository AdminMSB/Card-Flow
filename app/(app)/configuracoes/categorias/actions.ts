'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_PATH = '/configuracoes/categorias';

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

const categorySchema = z.object({
  name: z.string().min(1, 'Informe o nome da categoria.'),
});

export async function createCategory(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const parsed = categorySchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('categories').insert({
    name: parsed.data.name,
  });

  if (error) {
    if (error.code === '23505') redirectWithError('Já existe uma categoria com esse nome.');
    redirectWithError('Não foi possível salvar a categoria.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateCategory(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  const parsed = categorySchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
  });

  if (!id) redirectWithError('Categoria inválida.');
  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('categories')
    .update({ name: parsed.data.name })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') redirectWithError('Já existe uma categoria com esse nome.');
    redirectWithError('Não foi possível atualizar a categoria.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirectWithError('Categoria inválida.');

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('categories').delete().eq('id', id);

  if (error) {
    redirectWithError('Não foi possível excluir a categoria.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
