'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_PATH = '/configuracoes/colaboradores';

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

const collaboratorSchema = z.object({
  fullName: z.string().trim().min(1, 'Informe o nome do colaborador.'),
  departmentId: z.string(),
  email: z.string().trim().email('Informe um e-mail válido.').or(z.literal('')),
});

function parseFields(formData: FormData) {
  const parsed = collaboratorSchema.safeParse({
    fullName: String(formData.get('fullName') ?? ''),
    departmentId: String(formData.get('departmentId') ?? ''),
    email: String(formData.get('email') ?? '').trim(),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  return parsed.data;
}

export async function createCollaborator(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');
  const fields = parseFields(formData);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('collaborators').insert({
    full_name: fields.fullName,
    department_id: fields.departmentId || null,
    email: fields.email || null,
  });

  if (error) {
    redirectWithError(
      error.code === '23505' ? 'Já existe um colaborador com esse nome.' : 'Não foi possível salvar o colaborador.',
    );
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function updateCollaborator(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirectWithError('Colaborador inválido.');

  const fields = parseFields(formData);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('collaborators')
    .update({
      full_name: fields.fullName,
      department_id: fields.departmentId || null,
      email: fields.email || null,
    })
    .eq('id', id);

  if (error) {
    redirectWithError(
      error.code === '23505' ? 'Já existe um colaborador com esse nome.' : 'Não foi possível atualizar o colaborador.',
    );
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteCollaborator(formData: FormData): Promise<void> {
  await requireRole('financeiro', 'admin');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirectWithError('Colaborador inválido.');

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('collaborators').delete().eq('id', id);

  if (error) {
    redirectWithError('Não foi possível excluir o colaborador.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
