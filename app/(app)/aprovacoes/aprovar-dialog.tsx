'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { approvePurchase } from './actions';

/** Botão + Dialog que pede o código da OC/Diário de Fatura antes de liberar a compra. */
export function AprovarDialog({ purchaseId, defaultValue }: { purchaseId: string; defaultValue: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        Liberar
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Liberar compra">
        <form action={approvePurchase} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={purchaseId} />
          <div>
            <Label htmlFor={`purchaseOrderCode-${purchaseId}`}>Código da OC ou Diário de Fatura</Label>
            <Input
              id={`purchaseOrderCode-${purchaseId}`}
              name="purchaseOrderCode"
              type="text"
              required
              placeholder="Ex.: OC012743 ou nº do diário de fatura"
              defaultValue={defaultValue ?? ''}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Confirmar liberação
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
