import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Client com a service role key — ignora RLS. Uso restrito a código server-only
 * que precisa da Auth Admin API (convidar/criar usuários em /configuracoes/usuarios).
 * NUNCA importar este módulo de um Client Component.
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
