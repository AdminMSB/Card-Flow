import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { CurrentProfile, Role } from '@/types/domain';

/**
 * Retorna o perfil (profile + role) do usuário autenticado na requisição atual,
 * ou `null` se não houver sessão. Não redireciona — use `requireProfile` quando
 * a página exigir autenticação.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, department_id')
    .eq('id', userData.user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    departmentId: profile.department_id,
  };
}

/** Garante autenticação; redireciona para /login se não houver sessão. */
export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

/** Garante autenticação + um dos perfis informados; caso contrário, redireciona para /dashboard. */
export async function requireRole(...roles: Role[]): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect('/dashboard');
  return profile;
}
