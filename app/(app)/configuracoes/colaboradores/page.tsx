import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ColaboradorFormDialog } from './colaborador-form';
import { deleteCollaborator } from './actions';

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const [{ data: collaborators }, { data: departments }] = await Promise.all([
    supabase.from('collaborators').select('id, full_name, department_id, email').order('full_name'),
    supabase.from('departments').select('id, name').order('name'),
  ]);

  const collaboratorList = collaborators ?? [];
  const departmentList = departments ?? [];
  const departmentNameById = new Map(departmentList.map((department) => [department.id, department.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">
            Nome, centro de custo e e-mail usados para preencher automaticamente o Solicitante ao registrar uma
            compra.
          </p>
        </div>
        <ColaboradorFormDialog mode="create" departments={departmentList} />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaboratorList.map((collaborator) => (
                <TableRow key={collaborator.id}>
                  <TableCell>{collaborator.full_name}</TableCell>
                  <TableCell>
                    {collaborator.department_id ? departmentNameById.get(collaborator.department_id) ?? '—' : '—'}
                  </TableCell>
                  <TableCell>{collaborator.email ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <ColaboradorFormDialog mode="edit" departments={departmentList} collaborator={collaborator} />
                      <form action={deleteCollaborator}>
                        <input type="hidden" name="id" value={collaborator.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Excluir
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {collaboratorList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum colaborador cadastrado.
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
