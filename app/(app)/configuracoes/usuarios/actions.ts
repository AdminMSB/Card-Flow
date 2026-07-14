'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { Role } from '@/types/domain';

const BASE_PATH = '/configuracoes/usuarios';
const ROLE_VALUES: Role[] = ['colaborador', 'gestor', 'financeiro', 'admin'];

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

function isRole(value: string): value is Role {
  return ROLE_VALUES.includes(value as Role);
}

const inviteSchema = z.object({
  full_name: z.string().min(1, 'Informe o nome completo.'),
  email: z.string().email('Informe um e-mail válido.'),
  role: z.string().refine(isRole, { message: 'Selecione um papel válido.' }),
  department_id: z.string(),
});

/** Convida um novo usuário por e-mail; o trigger `handle_new_user` cria a linha em `profiles`. */
export async function inviteUser(formData: FormData): Promise<void> {
  const profile = await requireRole('financeiro', 'admin');

  const parsed = inviteSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    role: String(formData.get('role') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '').trim(),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  // Financeiro pode convidar colaboradores/gestores/financeiro, mas não outro admin.
  if (parsed.data.role === 'admin' && profile.role !== 'admin') {
    redirectWithError('Apenas administradores podem convidar outro administrador.');
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      department_id: parsed.data.department_id || null,
    },
  });

  if (error) {
    const message = /already|registered|existe/i.test(error.message)
      ? 'Este e-mail já está cadastrado.'
      : 'Não foi possível enviar o convite.';
    redirectWithError(message);
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

const roleUpdateSchema = z.object({
  role: z.string().refine(isRole, { message: 'Selecione um papel válido.' }),
  department_id: z.string(),
});

/**
 * Atualiza papel/setor de outro usuário. Restrito a `admin` — a policy `profiles_update`
 * do Postgres já bloqueia isso para não-admins, mas validamos aqui também para dar
 * uma mensagem amigável em vez de deixar a query falhar silenciosamente.
 */
export async function updateUserRole(formData: FormData): Promise<void> {
  await requireRole('admin');

  const userId = String(formData.get('user_id') ?? '').trim();
  const parsed = roleUpdateSchema.safeParse({
    role: String(formData.get('role') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '').trim(),
  });

  if (!userId) redirectWithError('Usuário inválido.');
  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      role: parsed.data.role,
      department_id: parsed.data.department_id || null,
    })
    .eq('id', userId);

  if (error) {
    redirectWithError('Não foi possível atualizar o usuário.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
