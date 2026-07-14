'use client';

import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS, type Role } from '@/types/domain';

export function UserMenu({ fullName, role }: { fullName: string; role: Role }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium leading-none">{fullName}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={handleSignOut}>
        Sair
      </Button>
    </div>
  );
}
