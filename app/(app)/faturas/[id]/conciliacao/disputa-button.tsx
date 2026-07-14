'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { markDisputed } from './actions';

interface DisputaButtonProps {
  invoiceId: string;
  invoiceItemId: string;
}

/** Botão + modal para marcar um item da fatura como disputa, com observação obrigatória. */
export function DisputaButton({ invoiceId, invoiceItemId }: DisputaButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Marcar como disputa
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Marcar item como disputa">
        <form action={markDisputed} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <input type="hidden" name="invoice_item_id" value={invoiceItemId} />

          <div>
            <Label htmlFor={`notes-${invoiceItemId}`}>Observação</Label>
            <Textarea
              id={`notes-${invoiceItemId}`}
              name="notes"
              required
              placeholder="Explique o motivo da disputa (ex.: cobrança duplicada, valor divergente, estabelecimento desconhecido)."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive">
              Confirmar disputa
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
