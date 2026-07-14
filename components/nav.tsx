'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/domain';

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const ALL_ROLES: Role[] = ['colaborador', 'gestor', 'financeiro', 'admin'];

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ALL_ROLES },
  { href: '/compras', label: 'Compras', roles: ALL_ROLES },
  { href: '/aprovacoes', label: 'Aprovações', roles: ['gestor', 'financeiro', 'admin'] },
  { href: '/faturas', label: 'Faturas', roles: ['financeiro', 'admin'] },
  { href: '/relatorios', label: 'Relatórios', roles: ['gestor', 'financeiro', 'admin'] },
  { href: '/configuracoes', label: 'Configurações', roles: ['financeiro', 'admin'] },
];

export function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
