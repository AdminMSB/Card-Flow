import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchPurchaseLineItems } from '@/lib/purchase-line-items';
import { formatCurrencyCents } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PurchaseStatus } from '@/types/domain';
import { RelatoriosTable, type RelatoriosRow } from './relatorios-table';

const exportLinkClassName = cn(
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-muted px-4',
  'text-sm font-medium text-foreground transition-colors hover:bg-muted/80',
);

interface RelatoriosPageProps {
  searchParams: { error?: string };
}

interface PurchaseRow {
  id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string | null;
  status: PurchaseStatus;
  user_id: string | null;
  requester_name: string | null;
  supplier_name: string | null;
  department_id: string | null;
  requisition_number: string | null;
  purchase_order_code: string | null;
  invoice_document_number: string | null;
  description: string | null;
  receipt_path: string | null;
}

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  await requireRole('gestor', 'financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const { data: departments } = await supabase.from('departments').select('id, name').order('name');

  const { data: purchasesData } = await supabase
    .from('purchases')
    .select(
      'id, purchase_date, amount_cents, merchant_name, status, user_id, requester_name, supplier_name, department_id, requisition_number, purchase_order_code, invoice_document_number, description, receipt_path',
    )
    .order('purchase_date', { ascending: false });

  const rows: PurchaseRow[] = purchasesData ?? [];

  // Nome do solicitante é resolvido em lote (sem embutir joins no select do Postgrest, já
  // que o tipo `Database` não declara `Relationships`). Centro de custo reutiliza
  // `departments`, já que são o mesmo conceito.
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter((id): id is string => !!id)));

  const { data: profilesData } = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] as { id: string; full_name: string }[] };

  const costCenterNameById = new Map((departments ?? []).map((department) => [department.id, department.name]));
  const fullNameById = new Map((profilesData ?? []).map((profile) => [profile.id, profile.full_name]));
  const { orderCodesByPurchaseId, invoiceDocumentsByPurchaseId } = await fetchPurchaseLineItems(supabase, rows);

  const relatoriosRows: RelatoriosRow[] = await Promise.all(
    rows.map(async (row) => {
      let receiptUrl: string | null = null;
      if (row.receipt_path) {
        const { data } = await supabase.storage.from('receipts').createSignedUrl(row.receipt_path, 60);
        receiptUrl = data?.signedUrl ?? null;
      }
      return {
        id: row.id,
        purchase_date: row.purchase_date,
        amount_cents: row.amount_cents,
        merchant_name: row.merchant_name,
        supplier_name: row.supplier_name,
        description: row.description,
        requisition_number: row.requisition_number,
        status: row.status,
        requesterLabel: row.requester_name ?? (row.user_id ? fullNameById.get(row.user_id) : null) ?? '—',
        costCenterName: row.department_id ? costCenterNameById.get(row.department_id) ?? null : null,
        orderCodes: orderCodesByPurchaseId.get(row.id) ?? [],
        invoiceDocuments: invoiceDocumentsByPurchaseId.get(row.id) ?? [],
        receiptUrl,
      };
    }),
  );

  const totalItens = rows.length;
  const totalCents = rows.reduce((total, row) => total + row.amount_cents, 0);
  const totalReconciled = rows.filter((row) => row.status === 'reconciled').length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Encontre uma compra por requisição, solicitante, valor ou NF/fatura/boleto.
        </p>
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total de itens</CardDescription>
            <CardTitle className="text-2xl">{totalItens}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Soma total</CardDescription>
            <CardTitle className="text-2xl">{formatCurrencyCents(totalCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Conciliadas</CardDescription>
            <CardTitle className="text-2xl">{totalReconciled}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/relatorios/export?formato=excel" className={exportLinkClassName}>
          Exportar Excel
        </a>
        <a href="/api/relatorios/export?formato=pdf" className={exportLinkClassName}>
          Exportar PDF
        </a>
      </div>

      <RelatoriosTable rows={relatoriosRows} />
    </div>
  );
}
