import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { SetorFormDialog } from './setores-form';
import { deleteDepartment } from './actions';

export default async function SetoresPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const [{ data: departments }, { data: managers }] = await Promise.all([
    supabase.from('departments').select('id, name, manager_id').order('name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'gestor').order('full_name'),
  ]);

  const managerList = managers ?? [];
  const departmentList = departments ?? [];
  const managerNameById = new Map(managerList.map((manager) => [manager.id, manager.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Setores</h1>
          <p className="text-sm text-muted-foreground">Cadastro de setores e seus gestores.</p>
        </div>
        <SetorFormDialog mode="create" managers={managerList} />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Gestor</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departmentList.map((department) => (
                <TableRow key={department.id}>
                  <TableCell>{department.name}</TableCell>
                  <TableCell>
                    {department.manager_id ? managerNameById.get(department.manager_id) ?? '—' : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <SetorFormDialog mode="edit" managers={managerList} department={department} />
                      <form action={deleteDepartment}>
                        <input type="hidden" name="id" value={department.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Excluir
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {departmentList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum setor cadastrado.
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
