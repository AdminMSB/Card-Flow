'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createDepartment, updateDepartment } from './actions';

interface Manager {
  id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
  manager_id: string | null;
}

interface SetorFormDialogProps {
  managers: Manager[];
  mode: 'create' | 'edit';
  department?: Department;
}

export function SetorFormDialog({ managers, mode, department }: SetorFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = mode === 'edit' && Boolean(department);
  const action = isEdit ? updateDepartment : createDepartment;
  const fieldSuffix = department?.id ?? 'new';

  return (
    <>
      <Button
        type="button"
        variant={isEdit ? 'secondary' : 'primary'}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {isEdit ? 'Editar' : 'Novo setor'}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar setor' : 'Novo setor'}>
        <form action={action} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          {isEdit && department && <input type="hidden" name="id" value={department.id} />}

          <div>
            <Label htmlFor={`name-${fieldSuffix}`}>Nome</Label>
            <Input id={`name-${fieldSuffix}`} name="name" defaultValue={department?.name} required />
          </div>

          <div>
            <Label htmlFor={`manager-${fieldSuffix}`}>Gestor</Label>
            <Select id={`manager-${fieldSuffix}`} name="manager_id" defaultValue={department?.manager_id ?? ''}>
              <option value="">Nenhum</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name}
                </option>
              ))}
            </Select>
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
