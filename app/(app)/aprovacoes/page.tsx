import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchPurchaseLineItems } from '@/lib/purchase-line-items';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AprovacoesTable, type ApprovalListItem } from './aprovacoes-table';

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

  const { orderCodesByPurchaseId } = await fetchPurchaseLineItems(supabase, purchases ?? []);

  const rows: ApprovalListItem[] = await Promise.all(
    (purchases ?? []).map(async (purchase) => {
      let receiptUrl: string | null = null;
      if (purchase.receipt_path) {
        const { data } = await supabase.storage.from('receipts').createSignedUrl(purchase.receipt_path, 60);
        receiptUrl = data?.signedUrl ?? null;
      }
      return {
        id: purchase.id,
        purchase_date: purchase.purchase_date,
        amount_cents: purchase.amount_cents,
        merchant_name: purchase.merchant_name,
        supplier_name: purchase.supplier_name,
        description: purchase.description,
        requisition_number: purchase.requisition_number,
        orderCodes: orderCodesByPurchaseId.get(purchase.id) ?? [],
        requesterLabel:
          (purchase.user_id ? requesterMap.get(purchase.user_id) : null) ?? purchase.requester_name ?? '—',
        receiptUrl,
      };
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
          <AprovacoesTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
