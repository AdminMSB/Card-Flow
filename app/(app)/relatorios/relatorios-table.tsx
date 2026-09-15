'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PurchaseStatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import type { InvoiceDocumentItem } from '@/lib/purchase-line-items';
import { AprovarDialog } from '../aprovacoes/aprovar-dialog';
import { RejeitarDialog } from '../aprovacoes/rejeitar-dialog';
import type { PurchaseStatus } from '@/types/domain';

export interface RelatoriosRow {
  id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string | null;
  supplier_name: string | null;
  description: string | null;
  requisition_number: string | null;
  status: PurchaseStatus;
  requesterLabel: string;
  costCenterName: string | null;
  orderCodes: string[];
  invoiceDocuments: InvoiceDocumentItem[];
  receiptUrl: string | null;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium sm:text-right">{value}</span>
    </div>
  );
}

/** Tabela de Relatórios; clicar em uma linha abre um painel com os detalhes — e, se a
 * compra ainda estiver pendente, as ações de Liberar/Rejeitar (mesmo fluxo de Aprovações,
 * só que sem sair desta tela). Filtros iguais aos de Aprovações: requisição, solicitante,
 * valor e NF/fatura/boleto — todos aplicados em memória sobre os dados já carregados. */
export function RelatoriosTable({ rows }: { rows: RelatoriosRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requisitionQuery, setRequisitionQuery] = useState('');
  const [requesterLabel, setRequesterLabel] = useState('');
  const [amountQuery, setAmountQuery] = useState('');
  const [documentQuery, setDocumentQuery] = useState('');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const requesterOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.requesterLabel))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const requisitionFilter = requisitionQuery.trim().toLowerCase();
    const amountFilter = amountQuery.trim().toLowerCase();
    const documentFilter = documentQuery.trim().toLowerCase();

    return rows.filter((row) => {
      if (requesterLabel && row.requesterLabel !== requesterLabel) return false;
      if (requisitionFilter && !(row.requisition_number ?? '').toLowerCase().includes(requisitionFilter)) {
        return false;
      }
      if (amountFilter && !formatCurrencyCents(row.amount_cents).toLowerCase().includes(amountFilter)) {
        return false;
      }
      if (documentFilter) {
        const documentText = row.invoiceDocuments
          .map((document) => document.documentNumber ?? '')
          .join(' ')
          .toLowerCase();
        if (!documentText.includes(documentFilter)) return false;
      }
      return true;
    });
  }, [rows, requisitionQuery, requesterLabel, amountQuery, documentQuery]);

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="relatorios-filtro-requisicao">Requisição</Label>
          <Input
            id="relatorios-filtro-requisicao"
            type="search"
            value={requisitionQuery}
            onChange={(event) => setRequisitionQuery(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="relatorios-filtro-solicitante">Solicitante</Label>
          <Select
            id="relatorios-filtro-solicitante"
            value={requesterLabel}
            onChange={(event) => setRequesterLabel(event.target.value)}
          >
            <option value="">Todos</option>
            {requesterOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="relatorios-filtro-valor">Valor</Label>
          <Input
            id="relatorios-filtro-valor"
            type="search"
            placeholder="Ex.: 53,42"
            value={amountQuery}
            onChange={(event) => setAmountQuery(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="relatorios-filtro-documento">NF/Fatura/Boleto</Label>
          <Input
            id="relatorios-filtro-documento"
            type="search"
            value={documentQuery}
            onChange={(event) => setDocumentQuery(event.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Requisição</TableHead>
            <TableHead>Código de Lançamento</TableHead>
            <TableHead>Centro de custo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                {rows.length === 0 ? 'Nenhuma compra registrada ainda.' : 'Nenhuma compra encontrada para esse filtro.'}
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setSelectedId(row.id);
                }}
              >
                <TableCell>{formatDate(row.purchase_date)}</TableCell>
                <TableCell>{row.requesterLabel}</TableCell>
                <TableCell>{row.merchant_name && row.merchant_name !== row.supplier_name ? row.merchant_name : '—'}</TableCell>
                <TableCell>{row.supplier_name ?? '—'}</TableCell>
                <TableCell>{row.requisition_number ?? '—'}</TableCell>
                <TableCell>{row.orderCodes.length > 0 ? row.orderCodes.join(' / ') : '—'}</TableCell>
                <TableCell>{row.costCenterName ?? '—'}</TableCell>
                <TableCell>{formatCurrencyCents(row.amount_cents)}</TableCell>
                <TableCell>
                  <PurchaseStatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={selected !== null} onClose={() => setSelectedId(null)} title="Detalhes da compra">
        {selected && (
          <>
            <div className="flex flex-col">
              <DetailRow label="Data" value={formatDate(selected.purchase_date)} />
              <DetailRow label="Solicitante" value={selected.requesterLabel} />
              <DetailRow
                label="Site"
                value={
                  selected.merchant_name && selected.merchant_name !== selected.supplier_name
                    ? selected.merchant_name
                    : '—'
                }
              />
              <DetailRow label="Fornecedor" value={selected.supplier_name ?? '—'} />
              <DetailRow label="Nº da requisição" value={selected.requisition_number ?? '—'} />
              <DetailRow
                label="Código de Lançamento"
                value={selected.orderCodes.length > 0 ? selected.orderCodes.join(' / ') : '—'}
              />
              <DetailRow
                label="Nº da NF / fatura / boleto"
                value={
                  selected.invoiceDocuments.length > 0
                    ? selected.invoiceDocuments
                        .map((document) => {
                          const number = document.documentNumber ?? 'Sem número';
                          return document.amountCents != null
                            ? `${number} (${formatCurrencyCents(document.amountCents)})`
                            : number;
                        })
                        .join(' / ')
                    : '—'
                }
              />
              <DetailRow label="Centro de custo" value={selected.costCenterName ?? '—'} />
              <DetailRow label="Valor" value={formatCurrencyCents(selected.amount_cents)} />
              <DetailRow label="Status" value={<PurchaseStatusBadge status={selected.status} />} />
              {selected.description && <DetailRow label="Descrição" value={selected.description} />}
              <DetailRow
                label="Comprovante"
                value={
                  selected.receiptUrl ? (
                    <a href={selected.receiptUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                      Ver comprovante
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </div>

            {selected.status === 'pending' && (
              <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
                <AprovarDialog purchaseId={selected.id} existingCodes={selected.orderCodes} returnTo={returnTo} />
                <RejeitarDialog purchaseId={selected.id} returnTo={returnTo} />
              </div>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
