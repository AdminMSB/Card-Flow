'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { PurchaseStatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyCents, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PurchaseRowActions } from './purchase-row-actions';
import type { CardOption, OptionRow, PurchaseDefaults } from './compra-form';
import { isPurchaseLiberado, type PurchaseStatus } from '@/types/domain';

export interface PurchaseListItem extends PurchaseDefaults {
  status: PurchaseStatus;
  requesterLabel: string;
  costCenterName: string | null;
  approvalNotes: string | null;
  approvedAt: string | null;
  receiptUrl: string | null;
  canManage: boolean;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium sm:text-right">{value}</span>
    </div>
  );
}

interface ComprasTableProps {
  rows: PurchaseListItem[];
  costCenters: OptionRow[];
  cards: CardOption[];
}

/** Tabela resumida de compras; clicar em uma linha abre um painel com todos os detalhes. */
export function ComprasTable({ rows, costCenters, cards }: ComprasTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Requisição</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Valor (R$)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => setSelectedId(row.id)}
              className={cn('cursor-pointer', isPurchaseLiberado(row.status) && 'bg-success/10')}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setSelectedId(row.id);
              }}
            >
              <TableCell>{row.requisition_number ?? '—'}</TableCell>
              <TableCell>{row.requesterLabel}</TableCell>
              <TableCell>{formatDate(row.purchase_date)}</TableCell>
              <TableCell>{row.supplier_name ?? row.merchant_name}</TableCell>
              <TableCell>{formatCurrencyCents(row.amount_cents)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhuma compra registrada ainda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={selected !== null} onClose={() => setSelectedId(null)} title="Detalhes da compra">
        {selected && (
          <>
            <div className="flex flex-col">
              <DetailRow label="Data" value={formatDate(selected.purchase_date)} />
              <DetailRow label="Solicitante" value={selected.requesterLabel} />
              {selected.is_marketplace_purchase ? (
                <>
                  <DetailRow label="Estabelecimento / Site" value={selected.merchant_name} />
                  <DetailRow label="Fornecedor real" value={selected.supplier_name ?? '—'} />
                </>
              ) : (
                <DetailRow label="Estabelecimento / Fornecedor" value={selected.merchant_name} />
              )}
              <DetailRow label="CNPJ do fornecedor" value={selected.supplier_cnpj ?? '—'} />
              <DetailRow label="Nº da requisição" value={selected.requisition_number ?? '—'} />
              <DetailRow label="Código de OC" value={selected.purchase_order_code ?? '—'} />
              <DetailRow label="Nº da NF / fatura / boleto" value={selected.invoice_document_number ?? '—'} />
              <DetailRow label="Centro de custo" value={selected.costCenterName ?? '—'} />
              <DetailRow label="Valor" value={formatCurrencyCents(selected.amount_cents)} />
              <DetailRow label="Status" value={<PurchaseStatusBadge status={selected.status} />} />
              {selected.description && <DetailRow label="Descrição" value={selected.description} />}
              {selected.approvalNotes && <DetailRow label="Observação da aprovação" value={selected.approvalNotes} />}
              {selected.approvedAt && (
                <DetailRow label="Aprovada/rejeitada em" value={formatDateTime(selected.approvedAt)} />
              )}
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

            {selected.canManage && (
              <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
                <PurchaseRowActions purchase={selected} costCenters={costCenters} cards={cards} />
              </div>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
