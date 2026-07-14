import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CartaoFormDialog } from './cartoes-form';
import { deleteCard } from './actions';

export default async function CartoesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const [{ data: cards }, { data: profiles }, { data: departments }] = await Promise.all([
    supabase
      .from('cards')
      .select('id, last_four_digits, holder_id, department_id, active')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('departments').select('id, name').order('name'),
  ]);

  const cardList = cards ?? [];
  const profileList = profiles ?? [];
  const departmentList = departments ?? [];

  const nameById = new Map(profileList.map((profile) => [profile.id, profile.full_name]));
  const departmentNameById = new Map(departmentList.map((department) => [department.id, department.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cartões</h1>
          <p className="text-sm text-muted-foreground">Cadastro dos cartões corporativos e seus titulares.</p>
        </div>
        <CartaoFormDialog mode="create" holders={profileList} departments={departmentList} />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cartão</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cardList.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>•••• {card.last_four_digits}</TableCell>
                  <TableCell>{card.holder_id ? nameById.get(card.holder_id) ?? '—' : '—'}</TableCell>
                  <TableCell>{departmentNameById.get(card.department_id) ?? '—'}</TableCell>
                  <TableCell>
                    <Badge tone={card.active ? 'success' : 'neutral'}>{card.active ? 'Ativo' : 'Inativo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <CartaoFormDialog
                        mode="edit"
                        holders={profileList}
                        departments={departmentList}
                        card={card}
                      />
                      <form action={deleteCard}>
                        <input type="hidden" name="id" value={card.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Excluir
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {cardList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum cartão cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
