'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { approvePurchase } from './actions';
import { RejeitarDialog } from './rejeitar-dialog';

export interface ApprovalListItem {
  id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string;
  description: string | null;
  requisition_number: string | null;
  purchase_order_code: string | null;
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
 * detalhes, o comprovante e as ações de aprovar/rejeitar. */
export function AprovacoesTable({ rows }: { rows: ApprovalListItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Solicitante</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Estabelecimento / Fornecedor</TableHead>
            <TableHead>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
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
              <TableCell>{row.requesterLabel}</TableCell>
              <TableCell>{formatDate(row.purchase_date)}</TableCell>
              <TableCell>{row.merchant_name}</TableCell>
              <TableCell>{formatCurrencyCents(row.amount_cents)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhuma compra pendente de aprovação.
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
              <DetailRow label="Estabelecimento / Fornecedor" value={selected.merchant_name} />
              <DetailRow label="Nº da requisição" value={selected.requisition_number ?? '—'} />
              <DetailRow label="Código de OC" value={selected.purchase_order_code ?? '—'} />
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
              <form action={approvePurchase}>
                <input type="hidden" name="id" value={selected.id} />
                <Button type="submit" variant="primary" size="sm">
                  Aprovar
                </Button>
              </form>
              <RejeitarDialog purchaseId={selected.id} />
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
