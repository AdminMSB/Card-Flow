'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCostCenter, updateCostCenter } from './actions';

interface CostCenter {
  id: string;
  name: string;
  code: string;
}

interface CentroCustoFormDialogProps {
  mode: 'create' | 'edit';
  costCenter?: CostCenter;
}

export function CentroCustoFormDialog({ mode, costCenter }: CentroCustoFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = mode === 'edit' && Boolean(costCenter);
  const action = isEdit ? updateCostCenter : createCostCenter;
  const fieldSuffix = costCenter?.id ?? 'new';

  return (
    <>
      <Button
        type="button"
        variant={isEdit ? 'secondary' : 'primary'}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {isEdit ? 'Editar' : 'Novo centro de custo'}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? 'Editar centro de custo' : 'Novo centro de custo'}
      >
        <form action={action} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          {isEdit && costCenter && <input type="hidden" name="id" value={costCenter.id} />}

          <div>
            <Label htmlFor={`name-${fieldSuffix}`}>Nome</Label>
            <Input id={`name-${fieldSuffix}`} name="name" defaultValue={costCenter?.name} required />
          </div>

          <div>
            <Label htmlFor={`code-${fieldSuffix}`}>Código</Label>
            <Input id={`code-${fieldSuffix}`} name="code" defaultValue={costCenter?.code} required />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
