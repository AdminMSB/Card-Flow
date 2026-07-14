import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate, formatMonthYear } from '@/lib/format';
import { InvoiceStatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { DisputaButton } from './disputa-button';
import { closeInvoice, confirmSuggestion, manualMatch, rejectSuggestion, undoMatch } from './actions';

interface PurchaseOption {
  id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string;
}

function purchaseLabel(purchase: PurchaseOption): string {
  return `${formatDate(purchase.purchase_date)} — ${formatCurrencyCents(purchase.amount_cents)} — ${purchase.merchant_name}`;
}

export default async function ConciliacaoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', params.id).single();
  if (!invoice) redirect('/faturas');
  if (invoice.status === 'mapping') redirect(`/faturas/${invoice.id}/mapear`);
  if (invoice.status === 'closed') redirect(`/faturas/${invoice.id}`);

  const { data: card } = await supabase.from('cards').select('id, last_four_digits').eq('id', invoice.card_id).single();
  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('item_date', { ascending: true });

  const itemList = items ?? [];

  const autoMatched = itemList.filter((item) => item.match_status === 'auto_matched');
  const unmatched = itemList.filter((item) => item.match_status === 'unmatched');
  const manuallyMatched = itemList.filter((item) => item.match_status === 'manually_matched');
  const disputed = itemList.filter((item) => item.match_status === 'disputed');

  const matchedPurchaseIds = Array.from(
    new Set(itemList.map((item) => item.matched_purchase_id).filter((id): id is string => Boolean(id))),
  );

  let matchedPurchases: PurchaseOption[] = [];
  if (matchedPurchaseIds.length > 0) {
    const { data } = await supabase
      .from('purchases')
      .select('id, purchase_date, amount_cents, merchant_name')
      .in('id', matchedPurchaseIds);
    matchedPurchases = data ?? [];
  }

  const { data: approvedCandidates } = await supabase
    .from('purchases')
    .select('id, purchase_date, amount_cents, merchant_name')
    .eq('card_id', invoice.card_id)
    .eq('status', 'approved');

  const purchasesById = new Map(matchedPurchases.map((purchase) => [purchase.id, purchase]));

  // Candidatas ao match manual: aprovadas do mesmo cartão, excluindo as que já
  // estão referenciadas por algum item desta fatura (mesmo que ainda pendentes
  // de confirmação como 'auto_matched') — evita que a mesma compra seja
  // oferecida para dois itens ao mesmo tempo antes de virar 'reconciled'.
  const candidatePurchases = (approvedCandidates ?? []).filter((purchase) => !matchedPurchaseIds.includes(purchase.id));

  const autoMatchedIds = autoMatched.map((item) => item.id);
  let confirmedLogs: { invoice_item_id: string }[] = [];
  if (autoMatchedIds.length > 0) {
    const { data } = await supabase
      .from('reconciliation_audit_log')
      .select('invoice_item_id')
      .eq('action', 'confirmed')
      .in('invoice_item_id', autoMatchedIds);
    confirmedLogs = data ?? [];
  }

  const confirmedSet = new Set(confirmedLogs.map((log) => log.invoice_item_id));

  const disputedIds = disputed.map((item) => item.id);
  let disputeLogs: { invoice_item_id: string; notes: string | null; performed_at: string }[] = [];
  if (disputedIds.length > 0) {
    const { data } = await supabase
      .from('reconciliation_audit_log')
      .select('invoice_item_id, notes, performed_at')
      .eq('action', 'disputed')
      .in('invoice_item_id', disputedIds)
      .order('performed_at', { ascending: false });
    disputeLogs = data ?? [];
  }

  const disputeNoteByItem = new Map<string, string | null>();
  for (const log of disputeLogs) {
    if (!disputeNoteByItem.has(log.invoice_item_id)) disputeNoteByItem.set(log.invoice_item_id, log.notes);
  }

  const canClose = unmatched.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Conciliação da fatura</h1>
          <p className="text-sm text-muted-foreground">
            {formatMonthYear(invoice.reference_month)} — cartão •••• {card?.last_four_digits ?? '----'} —{' '}
            {invoice.file_name}
          </p>
          <div className="mt-2">
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <form action={closeInvoice}>
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <Button type="submit" disabled={!canClose}>
              Fechar fatura
            </Button>
          </form>
          {!canClose && (
            <p className="max-w-xs text-right text-xs text-muted-foreground">
              Ainda há {unmatched.length} item(ns) sem correspondência. Concilie ou marque como disputa antes de
              fechar.
            </p>
          )}
        </div>
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Sugestões automáticas ({autoMatched.length})</CardTitle>
          <CardDescription>
            Pareamentos com alta confiança encontrados automaticamente. Confirme para manter, ou rejeite para tratar
            manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {autoMatched.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sugestão pendente.</p>}
          {autoMatched.map((item) => {
            const purchase = item.matched_purchase_id ? purchasesById.get(item.matched_purchase_id) : undefined;
            const isConfirmed = confirmedSet.has(item.id);
            return (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Item da fatura</p>
                    <p className="text-sm">
                      {formatDate(item.item_date)} — {formatCurrencyCents(item.amount_cents)} — {item.merchant_raw}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Compra sugerida</p>
                    <p className="text-sm">
                      {purchase
                        ? `${formatDate(purchase.purchase_date)} — ${formatCurrencyCents(purchase.amount_cents)} — ${purchase.merchant_name}`
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Confiança: {Math.round((item.match_confidence ?? 0) * 100)}%
                  </span>

                  <div className="flex items-center gap-2">
                    {isConfirmed ? (
                      <Badge tone="success">Confirmado</Badge>
                    ) : (
                      <form action={confirmSuggestion}>
                        <input type="hidden" name="invoice_id" value={invoice.id} />
                        <input type="hidden" name="invoice_item_id" value={item.id} />
                        <Button type="submit" size="sm">
                          Confirmar
                        </Button>
                      </form>
                    )}
                    <form action={rejectSuggestion}>
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <input type="hidden" name="invoice_item_id" value={item.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Rejeitar sugestão
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sem correspondência ({unmatched.length})</CardTitle>
          <CardDescription>Escolha manualmente a compra correspondente ou marque o item como disputa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {unmatched.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item pendente.</p>}
          {unmatched.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3">
              <p className="text-sm">
                {formatDate(item.item_date)} — {formatCurrencyCents(item.amount_cents)} — {item.merchant_raw}
              </p>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <form action={manualMatch} className="flex flex-1 flex-wrap items-end gap-2">
                  <input type="hidden" name="invoice_id" value={invoice.id} />
                  <input type="hidden" name="invoice_item_id" value={item.id} />
                  <div className="min-w-[240px] flex-1">
                    <Select name="purchase_id" required defaultValue="">
                      <option value="" disabled>
                        Selecione a compra correspondente
                      </option>
                      {candidatePurchases.map((purchase) => (
                        <option key={purchase.id} value={purchase.id}>
                          {purchaseLabel(purchase)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" size="sm" disabled={candidatePurchases.length === 0}>
                    Conciliar manualmente
                  </Button>
                </form>

                <DisputaButton invoiceId={invoice.id} invoiceItemId={item.id} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conciliados ({manuallyMatched.length})</CardTitle>
          <CardDescription>
            Itens conciliados manualmente ou confirmados ao fechar a fatura anteriormente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {manuallyMatched.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item conciliado ainda.</p>}
          {manuallyMatched.map((item) => {
            const purchase = item.matched_purchase_id ? purchasesById.get(item.matched_purchase_id) : undefined;
            return (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Item da fatura</p>
                    <p className="text-sm">
                      {formatDate(item.item_date)} — {formatCurrencyCents(item.amount_cents)} — {item.merchant_raw}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Compra conciliada</p>
                    <p className="text-sm">
                      {purchase
                        ? `${formatDate(purchase.purchase_date)} — ${formatCurrencyCents(purchase.amount_cents)} — ${purchase.merchant_name}`
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <form action={undoMatch}>
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input type="hidden" name="invoice_item_id" value={item.id} />
                    <input type="hidden" name="purchase_id" value={item.matched_purchase_id ?? ''} />
                    <Button type="submit" variant="secondary" size="sm">
                      Desfazer
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {disputed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Em disputa ({disputed.length})</CardTitle>
            <CardDescription>Itens marcados como disputa — tratamento final ocorre fora do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {disputed.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3">
                <p className="text-sm">
                  {formatDate(item.item_date)} — {formatCurrencyCents(item.amount_cents)} — {item.merchant_raw}
                </p>
                {disputeNoteByItem.get(item.id) && (
                  <p className="mt-1 text-xs text-muted-foreground">Observação: {disputeNoteByItem.get(item.id)}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
