'use client';

import { useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  const [search, setSearch] = useState('');
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.requisition_number,
        row.requesterLabel,
        row.supplier_name,
        row.merchant_name,
        row.invoice_document_number,
        row.purchase_order_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search]);

  return (
    <>
      <div className="mb-4">
        <Input
          type="search"
          placeholder="Filtrar por requisição, solicitante, fornecedor, NF ou código de lançamento..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Requisição</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>NF/Fatura/Boleto</TableHead>
            <TableHead>Valor (R$)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.map((row) => (
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
              <TableCell>{row.merchant_name && row.merchant_name !== row.supplier_name ? row.merchant_name : '—'}</TableCell>
              <TableCell>{row.supplier_name ?? '—'}</TableCell>
              <TableCell>{row.invoice_document_number ?? '—'}</TableCell>
              <TableCell>{formatCurrencyCents(row.amount_cents)}</TableCell>
            </TableRow>
          ))}
          {filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {rows.length === 0 ? 'Nenhuma compra registrada ainda.' : 'Nenhuma compra encontrada para esse filtro.'}
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
              <DetailRow
                label="Site"
                value={selected.merchant_name && selected.merchant_name !== selected.supplier_name ? selected.merchant_name : '—'}
              />
              <DetailRow label="Fornecedor" value={selected.supplier_name ?? '—'} />
              <DetailRow label="CNPJ do fornecedor" value={selected.supplier_cnpj ?? '—'} />
              <DetailRow label="Nº da requisição" value={selected.requisition_number ?? '—'} />
              <DetailRow label="Código de Lançamento" value={selected.purchase_order_code ?? '—'} />
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
