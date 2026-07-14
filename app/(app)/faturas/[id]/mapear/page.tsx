import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatMonthYear } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { detectColumnMapping, type ParsedFile } from '@/lib/parsers';
import { MapeamentoForm } from './mapeamento-form';

const SAMPLE_SIZE = 10;

export default async function MapearFaturaPage({
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
  if (invoice.status === 'reconciling') redirect(`/faturas/${invoice.id}/conciliacao`);
  if (invoice.status === 'closed') redirect(`/faturas/${invoice.id}`);

  const { data: sampleRows } = await supabase
    .from('invoice_raw_rows')
    .select('row_index, raw_data')
    .eq('invoice_id', invoice.id)
    .order('row_index', { ascending: true })
    .limit(SAMPLE_SIZE);

  const rows = sampleRows ?? [];

  // Amostra para pré-visualização e detecção heurística: headers = chaves da
  // primeira linha crua (o mapeamento completo, com a união de todas as
  // chaves, só é reconstruído em `confirmMapping` sobre TODAS as linhas).
  const headers = rows.length > 0 ? Object.keys(rows[0]!.raw_data as Record<string, string>) : [];

  const partialParsed: ParsedFile = {
    headers,
    rows: rows.map((row) => ({ rowIndex: row.row_index, columns: row.raw_data as Record<string, string> })),
  };

  const detected = detectColumnMapping(partialParsed);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Mapear colunas da fatura</h1>
        <p className="text-sm text-muted-foreground">
          {formatMonthYear(invoice.reference_month)} — {invoice.file_name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecione as colunas</CardTitle>
          <CardDescription>
            Indicamos automaticamente as colunas mais prováveis pelo nome do cabeçalho. Revise e confirme antes de
            continuar — isso vai gerar os itens da fatura e já sugerir conciliações automáticas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {searchParams.error && <p className="mb-4 text-sm text-destructive">{searchParams.error}</p>}

          {headers.length === 0 ? (
            <p className="text-sm text-destructive">
              Não foi possível carregar as linhas cruas desta fatura. Importe o arquivo novamente.
            </p>
          ) : (
            <MapeamentoForm invoiceId={invoice.id} headers={headers} detected={detected} />
          )}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia (primeiras {rows.length} linhas)</CardTitle>
            <CardDescription>Amostra das primeiras linhas do arquivo, como foram lidas.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.row_index}>
                    {headers.map((header) => (
                      <TableCell key={header}>{(row.raw_data as Record<string, string>)[header] ?? ''}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
