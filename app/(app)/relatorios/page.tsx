import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { PurchaseStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from '@/types/domain';

const PURCHASE_STATUSES: PurchaseStatus[] = ['pending', 'approved', 'rejected', 'reconciled'];
const DISPLAY_LIMIT = 200;

const exportLinkClassName = cn(
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-muted px-4',
  'text-sm font-medium text-foreground transition-colors hover:bg-muted/80',
);

interface RelatoriosPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

function paramString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

function isPurchaseStatus(value: string | undefined): value is PurchaseStatus {
  return !!value && (PURCHASE_STATUSES as string[]).includes(value);
}

interface PurchaseRow {
  id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string;
  status: PurchaseStatus;
  user_id: string | null;
  requester_name: string | null;
  cost_center_id: string | null;
  requisition_number: string | null;
  purchase_order_code: string | null;
}

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  await requireRole('gestor', 'financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const de = paramString(searchParams.de);
  const ate = paramString(searchParams.ate);
  const departmentId = paramString(searchParams.department_id);
  const costCenterId = paramString(searchParams.cost_center_id);
  const rawStatus = paramString(searchParams.status);
  const status = isPurchaseStatus(rawStatus) ? rawStatus : undefined;

  const [{ data: departments }, { data: costCenters }] = await Promise.all([
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('cost_centers').select('id, name, code').order('name'),
  ]);

  // Filtro por setor: uma compra pode ter o setor direto (`department_id`, usado em dados
  // importados de um cartão compartilhado por vários setores) ou herdado do setor do
  // cartão — casa com qualquer um dos dois.
  let cardIdsForDepartment: string[] = [];
  if (departmentId) {
    const { data: cardsInDepartment } = await supabase
      .from('cards')
      .select('id')
      .eq('department_id', departmentId);
    cardIdsForDepartment = (cardsInDepartment ?? []).map((card) => card.id);
  }

  let rows: PurchaseRow[] = [];
  let allMatching: { amount_cents: number; status: PurchaseStatus }[] = [];

  {
    let detailQuery = supabase
      .from('purchases')
      .select(
        'id, purchase_date, amount_cents, merchant_name, status, user_id, requester_name, cost_center_id, requisition_number, purchase_order_code',
      );
    let summaryQuery = supabase.from('purchases').select('amount_cents, status');

    if (de) {
      detailQuery = detailQuery.gte('purchase_date', de);
      summaryQuery = summaryQuery.gte('purchase_date', de);
    }
    if (ate) {
      detailQuery = detailQuery.lte('purchase_date', ate);
      summaryQuery = summaryQuery.lte('purchase_date', ate);
    }
    if (costCenterId) {
      detailQuery = detailQuery.eq('cost_center_id', costCenterId);
      summaryQuery = summaryQuery.eq('cost_center_id', costCenterId);
    }
    if (status) {
      detailQuery = detailQuery.eq('status', status);
      summaryQuery = summaryQuery.eq('status', status);
    }
    if (departmentId) {
      const cardFilter = cardIdsForDepartment.length ? `,card_id.in.(${cardIdsForDepartment.join(',')})` : '';
      const orFilter = `department_id.eq.${departmentId}${cardFilter}`;
      detailQuery = detailQuery.or(orFilter);
      summaryQuery = summaryQuery.or(orFilter);
    }

    const [{ data: detailData }, { data: summaryData }] = await Promise.all([
      detailQuery.order('purchase_date', { ascending: false }).limit(DISPLAY_LIMIT),
      summaryQuery,
    ]);
    rows = detailData ?? [];
    allMatching = summaryData ?? [];
  }

  // Nomes de centro de custo/solicitante são resolvidos em lote (sem embutir joins no
  // select do Postgrest, já que o tipo `Database` não declara `Relationships`).
  const costCenterIdsInRows = Array.from(
    new Set(rows.map((row) => row.cost_center_id).filter((id): id is string => !!id)),
  );
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter((id): id is string => !!id)));

  const [{ data: costCentersForRows }, { data: profilesData }] = await Promise.all([
    costCenterIdsInRows.length
      ? supabase.from('cost_centers').select('id, name, code').in('id', costCenterIdsInRows)
      : Promise.resolve({ data: [] as { id: string; name: string; code: string }[] }),
    userIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const costCenterNameById = new Map(
    (costCentersForRows ?? []).map((costCenter) => [costCenter.id, `${costCenter.name} (${costCenter.code})`]),
  );
  const fullNameById = new Map((profilesData ?? []).map((profile) => [profile.id, profile.full_name]));

  const totalItens = allMatching.length;
  const totalCents = allMatching.reduce((total, row) => total + row.amount_cents, 0);
  const totalReconciled = allMatching.filter((row) => row.status === 'reconciled').length;

  const exportParams = new URLSearchParams();
  if (de) exportParams.set('de', de);
  if (ate) exportParams.set('ate', ate);
  if (departmentId) exportParams.set('department_id', departmentId);
  if (costCenterId) exportParams.set('cost_center_id', costCenterId);
  if (status) exportParams.set('status', status);

  const excelParams = new URLSearchParams(exportParams);
  excelParams.set('formato', 'excel');
  const pdfParams = new URLSearchParams(exportParams);
  pdfParams.set('formato', 'pdf');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Filtre as compras por período, setor, centro de custo e status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label htmlFor="de">De</Label>
              <Input id="de" type="date" name="de" defaultValue={de ?? ''} />
            </div>
            <div>
              <Label htmlFor="ate">Até</Label>
              <Input id="ate" type="date" name="ate" defaultValue={ate ?? ''} />
            </div>
            <div>
              <Label htmlFor="department_id">Setor</Label>
              <Select id="department_id" name="department_id" defaultValue={departmentId ?? ''}>
                <option value="">Todos</option>
                {(departments ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cost_center_id">Centro de custo</Label>
              <Select id="cost_center_id" name="cost_center_id" defaultValue={costCenterId ?? ''}>
                <option value="">Todos</option>
                {(costCenters ?? []).map((costCenter) => (
                  <option key={costCenter.id} value={costCenter.id}>
                    {costCenter.name} ({costCenter.code})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={status ?? ''}>
                <option value="">Todos</option>
                {PURCHASE_STATUSES.map((purchaseStatus) => (
                  <option key={purchaseStatus} value={purchaseStatus}>
                    {PURCHASE_STATUS_LABELS[purchaseStatus]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end lg:col-span-5">
              <Button type="submit">Filtrar</Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
        <a href={`/api/relatorios/export?${excelParams.toString()}`} className={exportLinkClassName}>
          Exportar Excel
        </a>
        <a href={`/api/relatorios/export?${pdfParams.toString()}`} className={exportLinkClassName}>
          Exportar PDF
        </a>
      </div>

      {totalItens > DISPLAY_LIMIT ? (
        <p className="text-sm text-muted-foreground">
          Mostrando as {DISPLAY_LIMIT} mais recentes de {totalItens} — exporte para ver tudo.
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead>Estabelecimento / Fornecedor</TableHead>
            <TableHead>Requisição</TableHead>
            <TableHead>OC</TableHead>
            <TableHead>Centro de custo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Nenhum resultado para os filtros selecionados.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.purchase_date)}</TableCell>
                <TableCell>
                  {(row.user_id ? fullNameById.get(row.user_id) : null) ?? row.requester_name ?? '—'}
                </TableCell>
                <TableCell>{row.merchant_name}</TableCell>
                <TableCell>{row.requisition_number ?? '—'}</TableCell>
                <TableCell>{row.purchase_order_code ?? '—'}</TableCell>
                <TableCell>
                  {row.cost_center_id ? costCenterNameById.get(row.cost_center_id) ?? '—' : '—'}
                </TableCell>
                <TableCell>{formatCurrencyCents(row.amount_cents)}</TableCell>
                <TableCell>
                  <PurchaseStatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
