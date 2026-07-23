'use client';

import { useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PurchaseStatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PurchaseRowActions } from './purchase-row-actions';
import type { CardOption, CollaboratorOption, OptionRow, PurchaseDefaults } from './compra-form';
import { isPurchaseLiberado, type PurchaseStatus } from '@/types/domain';

export interface PurchaseListItem extends PurchaseDefaults {
  status: PurchaseStatus;
  requesterLabel: string;
  costCenterName: string | null;
  approvalNotes: string | null;
  canEdit: boolean;
  canDelete: boolean;
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
  departments: OptionRow[];
  collaborators: CollaboratorOption[];
  cards: CardOption[];
}

/** Tabela resumida de compras; clicar em uma linha abre um painel com todos os detalhes. */
export function ComprasTable({ rows, departments, collaborators, cards }: ComprasTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [requesterLabel, setRequesterLabel] = useState('');
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const requesterOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.requesterLabel))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (dateFrom && row.purchase_date < dateFrom) return false;
      if (dateTo && row.purchase_date > dateTo) return false;
      if (departmentId && row.department_id !== departmentId) return false;
      if (requesterLabel && row.requesterLabel !== requesterLabel) return false;
      if (!query) return true;

      const haystack = [
        row.requisition_number,
        row.requesterLabel,
        row.supplier_name,
        row.merchant_name,
        ...row.invoiceDocuments.map((document) => document.documentNumber),
        ...row.orderCodes.map((item) => item.code),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search, dateFrom, dateTo, departmentId, requesterLabel]);

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="compras-filtro-de">De</Label>
          <Input id="compras-filtro-de" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="compras-filtro-ate">Até</Label>
          <Input id="compras-filtro-ate" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="compras-filtro-cc">Centro de custo</Label>
          <Select
            id="compras-filtro-cc"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">Todos</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="compras-filtro-solicitante">Solicitante</Label>
          <Select
            id="compras-filtro-solicitante"
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
          <Label htmlFor="compras-filtro-busca">Buscar</Label>
          <Input
            id="compras-filtro-busca"
            type="search"
            placeholder="Requisição, fornecedor, NF, código..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Requisição</TableHead>
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
              <TableCell>{formatDate(row.purchase_date)}</TableCell>
              <TableCell>{row.merchant_name && row.merchant_name !== row.supplier_name ? row.merchant_name : '—'}</TableCell>
              <TableCell>{row.supplier_name ?? '—'}</TableCell>
              <TableCell>
                {row.invoiceDocuments.length > 0
                  ? row.invoiceDocuments.map((document) => document.documentNumber).join(' / ')
                  : '—'}
              </TableCell>
              <TableCell>{formatCurrencyCents(row.amount_cents)}</TableCell>
            </TableRow>
          ))}
          {filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
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
              <DetailRow
                label="Código de Lançamento"
                value={
                  selected.orderCodes.length > 0
                    ? selected.orderCodes
                        .map((item) =>
                          item.amountCents != null
                            ? `${item.code} (NF: ${formatCurrencyCents(item.amountCents)})`
                            : item.code,
                        )
                        .join(' / ')
                    : '—'
                }
              />
              <DetailRow
                label="Nº da NF / fatura / boleto"
                value={
                  selected.invoiceDocuments.length > 0
                    ? selected.invoiceDocuments
                        .map((document) =>
                          document.amountCents != null
                            ? `${document.documentNumber} (${formatCurrencyCents(document.amountCents)})`
                            : document.documentNumber,
                        )
                        .join(' / ')
                    : '—'
                }
              />
              <DetailRow label="Centro de custo" value={selected.costCenterName ?? '—'} />
              <DetailRow label="Valor" value={formatCurrencyCents(selected.amount_cents)} />
              <DetailRow label="Status" value={<PurchaseStatusBadge status={selected.status} />} />
              {selected.description && <DetailRow label="Descrição" value={selected.description} />}
              {selected.approvalNotes && <DetailRow label="Observação da aprovação" value={selected.approvalNotes} />}
            </div>

            {(selected.canEdit || selected.canDelete) && (
              <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
                <PurchaseRowActions
                  purchase={selected}
                  departments={departments}
                  collaborators={collaborators}
                  cards={cards}
                  canEdit={selected.canEdit}
                  canDelete={selected.canDelete}
                />
              </div>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
