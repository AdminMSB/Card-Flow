import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CentroCustoFormDialog } from './centros-form';
import { deleteCostCenter } from './actions';

export default async function CentrosDeCustoPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const { data: costCenters } = await supabase
    .from('cost_centers')
    .select('id, name, code')
    .order('name');

  const costCenterList = costCenters ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Centros de Custo</h1>
          <p className="text-sm text-muted-foreground">Cadastro de centros de custo usados nas compras.</p>
        </div>
        <CentroCustoFormDialog mode="create" />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costCenterList.map((costCenter) => (
                <TableRow key={costCenter.id}>
                  <TableCell>{costCenter.name}</TableCell>
                  <TableCell>{costCenter.code}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <CentroCustoFormDialog mode="edit" costCenter={costCenter} />
                      <form action={deleteCostCenter}>
                        <input type="hidden" name="id" value={costCenter.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Excluir
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {costCenterList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum centro de custo cadastrado.
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
