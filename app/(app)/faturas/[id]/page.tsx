import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate, formatDateTime, formatMonthYear } from '@/lib/format';
import { InvoiceStatusBadge, MatchStatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Página de detalhe somente leitura — usada para faturas já fechadas. */
export default async function FaturaDetalhePage({ params }: { params: { id: string } }) {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', params.id).single();
  if (!invoice) redirect('/faturas');
  if (invoice.status === 'mapping') redirect(`/faturas/${invoice.id}/mapear`);
  if (invoice.status === 'reconciling') redirect(`/faturas/${invoice.id}/conciliacao`);

  const { data: card } = await supabase.from('cards').select('id, last_four_digits').eq('id', invoice.card_id).single();
  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('item_date', { ascending: true });

  const itemList = items ?? [];

  const matchedPurchaseIds = Array.from(
    new Set(itemList.map((item) => item.matched_purchase_id).filter((id): id is string => Boolean(id))),
  );

  let purchasesById = new Map<string, { id: string; purchase_date: string; amount_cents: number; merchant_name: string }>();
  if (matchedPurchaseIds.length > 0) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, purchase_date, amount_cents, merchant_name')
      .in('id', matchedPurchaseIds);
    purchasesById = new Map((purchases ?? []).map((purchase) => [purchase.id, purchase]));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/faturas" className="text-sm text-primary hover:underline">
          ← Voltar para faturas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          Fatura de {formatMonthYear(invoice.reference_month)} — cartão •••• {card?.last_four_digits ?? '----'}
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <InvoiceStatusBadge status={invoice.status} />
          <span className="text-sm text-muted-foreground">
            Importada em {formatDateTime(invoice.imported_at)}
            {invoice.closed_at ? ` — fechada em ${formatDateTime(invoice.closed_at)}` : ''}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens da fatura ({itemList.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compra conciliada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemList.map((item) => {
                const purchase = item.matched_purchase_id ? purchasesById.get(item.matched_purchase_id) : undefined;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.item_date)}</TableCell>
                    <TableCell>{formatCurrencyCents(item.amount_cents)}</TableCell>
                    <TableCell>{item.merchant_raw}</TableCell>
                    <TableCell>
                      <MatchStatusBadge status={item.match_status} />
                    </TableCell>
                    <TableCell>
                      {purchase
                        ? `${formatDate(purchase.purchase_date)} — ${formatCurrencyCents(purchase.amount_cents)} — ${purchase.merchant_name}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {itemList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum item nesta fatura.
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
