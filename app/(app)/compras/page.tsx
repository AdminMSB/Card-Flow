import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { PurchaseStatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CompraForm } from './compra-form';
import { PurchaseRowActions } from './purchase-row-actions';

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const { data: purchases } = await supabase
    .from('purchases')
    .select('*')
    .order('purchase_date', { ascending: false });

  const { data: categories } = await supabase.from('categories').select('id, name').order('name');
  const { data: costCenters } = await supabase.from('cost_centers').select('id, name').order('name');

  // Cartões visíveis para o formulário: primeiro os próprios cartões ativos; se o usuário
  // não tiver nenhum, caímos para todos os cartões ativos (ex.: cartões "de setor" sem titular fixo).
  const { data: ownCards } = await supabase
    .from('cards')
    .select('id, last_four_digits')
    .eq('holder_id', profile.id)
    .eq('active', true);

  let cards = ownCards ?? [];
  if (cards.length === 0) {
    const { data: activeCards } = await supabase.from('cards').select('id, last_four_digits').eq('active', true);
    cards = activeCards ?? [];
  }

  const categoryMap = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const costCenterMap = new Map((costCenters ?? []).map((costCenter) => [costCenter.id, costCenter.name]));

  const rows = await Promise.all(
    (purchases ?? []).map(async (purchase) => {
      let receiptUrl: string | null = null;
      if (purchase.receipt_path) {
        const { data } = await supabase.storage.from('receipts').createSignedUrl(purchase.receipt_path, 60);
        receiptUrl = data?.signedUrl ?? null;
      }
      return { ...purchase, receiptUrl };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Compras</h1>
          <p className="text-sm text-muted-foreground">Registre e acompanhe as despesas do cartão corporativo.</p>
        </div>
        {cards.length > 0 && (
          <CompraForm mode="create" categories={categories ?? []} costCenters={costCenters ?? []} cards={cards} />
        )}
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      {cards.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum cartão cadastrado — peça ao financeiro para cadastrar um cartão em Configurações.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Minhas compras</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comprovante</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                  <TableCell>{purchase.merchant_name}</TableCell>
                  <TableCell>{purchase.category_id ? categoryMap.get(purchase.category_id) ?? '—' : '—'}</TableCell>
                  <TableCell>
                    {purchase.cost_center_id ? costCenterMap.get(purchase.cost_center_id) ?? '—' : '—'}
                  </TableCell>
                  <TableCell>{formatCurrencyCents(purchase.amount_cents)}</TableCell>
                  <TableCell>
                    <PurchaseStatusBadge status={purchase.status} />
                  </TableCell>
                  <TableCell>
                    {purchase.receiptUrl ? (
                      <a
                        href={purchase.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Ver comprovante
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {purchase.user_id === profile.id && purchase.status === 'pending' ? (
                      <PurchaseRowActions
                        purchase={purchase}
                        categories={categories ?? []}
                        costCenters={costCenters ?? []}
                        cards={cards}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhuma compra registrada ainda.
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
