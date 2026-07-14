import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatMonthYear } from '@/lib/format';
import { InvoiceStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { uploadInvoice } from './actions';
import type { InvoiceStatus } from '@/types/domain';

function stepHref(invoiceId: string, status: InvoiceStatus): string {
  if (status === 'mapping') return `/faturas/${invoiceId}/mapear`;
  if (status === 'reconciling') return `/faturas/${invoiceId}/conciliacao`;
  return `/faturas/${invoiceId}`;
}

function stepLabel(status: InvoiceStatus): string {
  if (status === 'closed') return 'Ver';
  return 'Continuar';
}

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole('financeiro', 'admin');
  const supabase = await createServerSupabaseClient();

  const [{ data: invoices }, { data: cards }, { data: itemRows }] = await Promise.all([
    supabase.from('invoices').select('*').order('imported_at', { ascending: false }),
    supabase.from('cards').select('id, last_four_digits').eq('active', true).order('last_four_digits'),
    supabase.from('invoice_items').select('invoice_id'),
  ]);

  const cardsById = new Map((cards ?? []).map((card) => [card.id, card]));

  const itemCountByInvoice = new Map<string, number>();
  for (const row of itemRows ?? []) {
    itemCountByInvoice.set(row.invoice_id, (itemCountByInvoice.get(row.invoice_id) ?? 0) + 1);
  }

  const invoiceList = invoices ?? [];
  const cardList = cards ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Faturas</h1>
        <p className="text-sm text-muted-foreground">
          Importe a fatura da operadora, mapeie as colunas e concilie com as compras registradas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Importar fatura</CardTitle>
          <CardDescription>
            Aceita arquivos .csv, .xlsx, .xls ou .ofx exportados pela operadora do cartão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {searchParams.error && <p className="mb-4 text-sm text-destructive">{searchParams.error}</p>}

          <form action={uploadInvoice} className="grid gap-4 sm:grid-cols-4 sm:items-end">
            <div>
              <Label htmlFor="card_id">Cartão</Label>
              <Select id="card_id" name="card_id" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {cardList.map((card) => (
                  <option key={card.id} value={card.id}>
                    •••• {card.last_four_digits}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="reference_month">Mês de referência</Label>
              <Input id="reference_month" name="reference_month" type="month" required />
            </div>

            <div>
              <Label htmlFor="file">Arquivo da fatura</Label>
              <Input id="file" name="file" type="file" accept=".csv,.xlsx,.xls,.ofx" required />
            </div>

            <Button type="submit">Importar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturas importadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês de referência</TableHead>
                <TableHead>Cartão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceList.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{formatMonthYear(invoice.reference_month)}</TableCell>
                  <TableCell>•••• {cardsById.get(invoice.card_id)?.last_four_digits ?? '----'}</TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell>{itemCountByInvoice.get(invoice.id) ?? 0}</TableCell>
                  <TableCell>{invoice.file_name}</TableCell>
                  <TableCell>
                    <Link
                      href={stepHref(invoice.id, invoice.status)}
                      className="font-medium text-primary hover:underline"
                    >
                      {stepLabel(invoice.status)}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {invoiceList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma fatura importada ainda.
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
