import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CategoriaFormDialog } from './categorias-form';
import { deleteCategory } from './actions';

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const { data: categories } = await supabase.from('categories').select('id, name').order('name');
  const categoryList = categories ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categorias</h1>
          <p className="text-sm text-muted-foreground">Cadastro de categorias usadas nas compras.</p>
        </div>
        <CategoriaFormDialog mode="create" />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryList.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>{category.name}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <CategoriaFormDialog mode="edit" category={category} />
                      <form action={deleteCategory}>
                        <input type="hidden" name="id" value={category.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Excluir
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categoryList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Nenhuma categoria cadastrada.
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
