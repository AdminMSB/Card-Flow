import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function ConfiguracoesPage() {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const [departments, costCenters, categories, cards, users] = await Promise.all([
    supabase.from('departments').select('*', { count: 'exact', head: true }),
    supabase.from('cost_centers').select('*', { count: 'exact', head: true }),
    supabase.from('categories').select('*', { count: 'exact', head: true }),
    supabase.from('cards').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ]);

  const sections = [
    {
      href: '/configuracoes/setores',
      title: 'Setores',
      description: `${departments.count ?? 0} setor(es) cadastrado(s)`,
    },
    {
      href: '/configuracoes/centros-de-custo',
      title: 'Centros de Custo',
      description: `${costCenters.count ?? 0} centro(s) de custo cadastrado(s)`,
    },
    {
      href: '/configuracoes/categorias',
      title: 'Categorias',
      description: `${categories.count ?? 0} categoria(s) cadastrada(s)`,
    },
    {
      href: '/configuracoes/cartoes',
      title: 'Cartões',
      description: `${cards.count ?? 0} cartão(ões) cadastrado(s)`,
    },
    {
      href: '/configuracoes/usuarios',
      title: 'Usuários',
      description: `${users.count ?? 0} usuário(s) cadastrado(s)`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os cadastros usados na conciliação de despesas de cartão corporativo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
