'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { rejectPurchase } from './actions';

/** Botão + Dialog que exige uma observação antes de confirmar a rejeição de uma compra. */
export function RejeitarDialog({ purchaseId }: { purchaseId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Rejeitar
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Rejeitar compra">
        <form action={rejectPurchase} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={purchaseId} />
          <div>
            <Label htmlFor={`notes-${purchaseId}`}>Motivo da rejeição</Label>
            <Textarea
              id={`notes-${purchaseId}`}
              name="notes"
              rows={3}
              required
              minLength={3}
              placeholder="Explique o motivo da rejeição."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive">
              Confirmar rejeição
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
