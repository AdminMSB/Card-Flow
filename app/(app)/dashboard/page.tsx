import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Primeiro dia do mês atual (inclusive) e primeiro dia do mês seguinte (exclusive), em ISO yyyy-mm-dd. */
function currentMonthRange(reference = new Date()): { start: string; end: string } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  const toISO = (date: Date) => date.toISOString().slice(0, 10);
  return { start: toISO(start), end: toISO(end) };
}

function sumAmountCents(rows: { amount_cents: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + row.amount_cents, 0);
}

function IndicatorCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent />
    </Card>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();
  const { start, end } = currentMonthRange();

  const isManagerOrAbove =
    profile.role === 'gestor' || profile.role === 'financeiro' || profile.role === 'admin';
  const isFinanceOrAdmin = profile.role === 'financeiro' || profile.role === 'admin';

  const [{ count: myPendingCount }, { data: myMonthPurchases }] = await Promise.all([
    supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('status', 'pending'),
    supabase
      .from('purchases')
      .select('amount_cents')
      .eq('user_id', profile.id)
      .gte('purchase_date', start)
      .lt('purchase_date', end),
  ]);

  const cards: JSX.Element[] = [
    <IndicatorCard key="my-pending" title="Minhas compras pendentes" value={String(myPendingCount ?? 0)} />,
    <IndicatorCard
      key="my-month"
      title="Minhas compras do mês"
      value={formatCurrencyCents(sumAmountCents(myMonthPurchases))}
    />,
  ];

  if (isManagerOrAbove) {
    const [{ count: pendingApprovalsCount }, { count: reconcilingInvoicesCount }, { data: reconcilingInvoices }] =
      await Promise.all([
        // RLS já escopa: gestor vê apenas o setor dos seus cartões; financeiro/admin veem tudo.
        supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'reconciling'),
        supabase.from('invoices').select('id').eq('status', 'reconciling'),
      ]);

    const reconcilingInvoiceIds = (reconcilingInvoices ?? []).map((invoice) => invoice.id);

    let matchedPercentLabel = '0%';
    if (reconcilingInvoiceIds.length > 0) {
      const [{ count: totalItemsCount }, { count: matchedItemsCount }] = await Promise.all([
        supabase
          .from('invoice_items')
          .select('*', { count: 'exact', head: true })
          .in('invoice_id', reconcilingInvoiceIds),
        supabase
          .from('invoice_items')
          .select('*', { count: 'exact', head: true })
          .in('invoice_id', reconcilingInvoiceIds)
          .in('match_status', ['auto_matched', 'manually_matched']),
      ]);

      const total = totalItemsCount ?? 0;
      const matched = matchedItemsCount ?? 0;
      matchedPercentLabel = total > 0 ? `${Math.round((matched / total) * 100)}%` : '0%';
    }

    cards.push(
      <IndicatorCard
        key="pending-approvals"
        title="Aprovações pendentes"
        value={String(pendingApprovalsCount ?? 0)}
      />,
      <IndicatorCard
        key="reconciling-invoices"
        title="Faturas em conciliação"
        value={String(reconcilingInvoicesCount ?? 0)}
      />,
      <IndicatorCard key="matched-percent" title="% conciliado" value={matchedPercentLabel} />,
    );
  }

  if (isFinanceOrAdmin) {
    const { count: closedThisMonthCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'closed')
      .gte('closed_at', start)
      .lt('closed_at', end);

    cards.push(
      <IndicatorCard
        key="closed-this-month"
        title="Faturas fechadas este mês"
        value={String(closedThisMonthCount ?? 0)}
      />,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Olá, {profile.fullName}.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards}</div>
    </div>
  );
}
