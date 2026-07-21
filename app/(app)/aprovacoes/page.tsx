import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { approvePurchase } from './actions';
import { RejeitarDialog } from './rejeitar-dialog';

export default async function AprovacoesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole('gestor', 'financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  // RLS já restringe: gestor só vê pendentes do setor do cartão; financeiro/admin veem todas.
  const { data: purchases } = await supabase
    .from('purchases')
    .select('*')
    .eq('status', 'pending')
    .order('purchase_date', { ascending: false });

  const requesterIds = Array.from(
    new Set((purchases ?? []).map((purchase) => purchase.user_id).filter((id): id is string => Boolean(id))),
  );

  let requesters: { id: string; full_name: string }[] = [];
  if (requesterIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', requesterIds);
    requesters = data ?? [];
  }

  const requesterMap = new Map(requesters.map((requester) => [requester.id, requester.full_name]));

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
      <div>
        <h1 className="text-2xl font-semibold">Aprovações</h1>
        <p className="text-sm text-muted-foreground">Compras pendentes de aprovação.</p>
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Solicitante</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Estabelecimento / Fornecedor</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Comprovante</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    {(purchase.user_id ? requesterMap.get(purchase.user_id) : null) ?? purchase.requester_name ?? '—'}
                  </TableCell>
                  <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                  <TableCell>{purchase.merchant_name}</TableCell>
                  <TableCell>{formatCurrencyCents(purchase.amount_cents)}</TableCell>
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
                    <div className="flex items-center gap-2">
                      <form action={approvePurchase}>
                        <input type="hidden" name="id" value={purchase.id} />
                        <Button type="submit" variant="primary" size="sm">
                          Aprovar
                        </Button>
                      </form>
                      <RejeitarDialog purchaseId={purchase.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma compra pendente de aprovação.
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
