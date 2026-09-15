'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { approvePurchase } from './actions';

/** Botão + Dialog que pede o código da OC/Diário de Fatura antes de liberar a compra —
 * só obrigatório se a compra ainda não tiver nenhum lançamento registrado. `returnTo` é a
 * tela de onde a ação foi disparada (Aprovações ou Relatórios), pra voltar pra lá depois. */
export function AprovarDialog({
  purchaseId,
  existingCodes,
  returnTo = '/aprovacoes',
}: {
  purchaseId: string;
  existingCodes: string[];
  returnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasCodes = existingCodes.length > 0;

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        Liberar
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Liberar compra">
        <form action={approvePurchase} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={purchaseId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {hasCodes && (
            <p className="text-sm text-muted-foreground">
              Lançamento já registrado: {existingCodes.join(' / ')}
            </p>
          )}
          <div>
            <Label htmlFor={`purchaseOrderCode-${purchaseId}`}>
              {hasCodes ? 'Adicionar outro lançamento (opcional)' : 'Código da OC ou Diário de Fatura'}
            </Label>
            <Input
              id={`purchaseOrderCode-${purchaseId}`}
              name="purchaseOrderCode"
              type="text"
              required={!hasCodes}
              placeholder="Ex.: OC012743 ou nº do diário de fatura"
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
