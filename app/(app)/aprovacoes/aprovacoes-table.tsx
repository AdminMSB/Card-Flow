'use client';

import { useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import type { InvoiceDocumentItem } from '@/lib/purchase-line-items';
import { AprovarDialog } from './aprovar-dialog';
import { RejeitarDialog } from './rejeitar-dialog';

export interface ApprovalListItem {
  id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string | null;
  supplier_name: string | null;
  description: string | null;
  requisition_number: string | null;
  orderCodes: string[];
  invoiceDocuments: InvoiceDocumentItem[];
  requesterLabel: string;
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

/** Tabela resumida de aprovações pendentes; clicar em uma linha abre um painel com os
 * detalhes, o comprovante e as ações de aprovar/rejeitar. Colunas e filtros seguem o mesmo
 * padrão da tela de Compras. */
export function AprovacoesTable({ rows }: { rows: ApprovalListItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requisitionQuery, setRequisitionQuery] = useState('');
  const [requesterLabel, setRequesterLabel] = useState('');
  const [amountQuery, setAmountQuery] = useState('');
  const [documentQuery, setDocumentQuery] = useState('');
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
          <Label htmlFor="aprovacoes-filtro-requisicao">Requisição</Label>
          <Input
            id="aprovacoes-filtro-requisicao"
            type="search"
            value={requisitionQuery}
            onChange={(event) => setRequisitionQuery(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="aprovacoes-filtro-solicitante">Solicitante</Label>
          <Select
            id="aprovacoes-filtro-solicitante"
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
          <Label htmlFor="aprovacoes-filtro-valor">Valor</Label>
          <Input
            id="aprovacoes-filtro-valor"
            type="search"
            placeholder="Ex.: 53,42"
            value={amountQuery}
            onChange={(event) => setAmountQuery(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="aprovacoes-filtro-documento">NF/Fatura/Boleto</Label>
          <Input
            id="aprovacoes-filtro-documento"
            type="search"
            value={documentQuery}
            onChange={(event) => setDocumentQuery(event.target.value)}
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
              className="cursor-pointer"
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
                  ? row.invoiceDocuments.map((document) => document.documentNumber ?? '(sem nº)').join(' / ')
                  : '—'}
              </TableCell>
              <TableCell>{formatCurrencyCents(row.amount_cents)}</TableCell>
            </TableRow>
          ))}
          {filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {rows.length === 0 ? 'Nenhuma compra pendente de aprovação.' : 'Nenhuma compra encontrada para esse filtro.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={selected !== null} onClose={() => setSelectedId(null)} title="Detalhes da compra">
        {selected && (
          <>
            <div className="flex flex-col">
              <DetailRow label="Solicitante" value={selected.requesterLabel} />
              <DetailRow label="Data" value={formatDate(selected.purchase_date)} />
              <DetailRow
                label="Site"
                value={selected.merchant_name && selected.merchant_name !== selected.supplier_name ? selected.merchant_name : '—'}
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
              <DetailRow label="Valor" value={formatCurrencyCents(selected.amount_cents)} />
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

            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
              <AprovarDialog purchaseId={selected.id} existingCodes={selected.orderCodes} />
              <RejeitarDialog purchaseId={selected.id} />
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
