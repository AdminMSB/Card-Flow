'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
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
 * só que sem sair desta tela). */
export function RelatoriosTable({ rows }: { rows: RelatoriosRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <>
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
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Nenhum resultado para os filtros selecionados.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
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
