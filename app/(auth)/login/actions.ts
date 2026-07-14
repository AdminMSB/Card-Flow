'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '/dashboard');

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('Informe e-mail e senha.')}`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent('E-mail ou senha inválidos.')}`);
  }

  redirect(redirectTo || '/dashboard');
}
