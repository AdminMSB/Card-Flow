'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createCollaborator, updateCollaborator } from './actions';

interface Department {
  id: string;
  name: string;
}

interface CollaboratorRow {
  id: string;
  full_name: string;
  department_id: string | null;
  email: string | null;
}

interface ColaboradorFormDialogProps {
  mode: 'create' | 'edit';
  departments: Department[];
  collaborator?: CollaboratorRow;
}

export function ColaboradorFormDialog({ mode, departments, collaborator }: ColaboradorFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = mode === 'edit' && Boolean(collaborator);
  const action = isEdit ? updateCollaborator : createCollaborator;
  const fieldSuffix = collaborator?.id ?? 'new';

  return (
    <>
      <Button type="button" variant={isEdit ? 'secondary' : 'primary'} size="sm" onClick={() => setOpen(true)}>
        {isEdit ? 'Editar' : 'Novo colaborador'}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar colaborador' : 'Novo colaborador'}>
        <form action={action} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          {isEdit && collaborator && <input type="hidden" name="id" value={collaborator.id} />}

          <div>
            <Label htmlFor={`fullName-${fieldSuffix}`}>Nome</Label>
            <Input
              id={`fullName-${fieldSuffix}`}
              name="fullName"
              type="text"
              defaultValue={collaborator?.full_name ?? ''}
              required
            />
          </div>

          <div>
            <Label htmlFor={`departmentId-${fieldSuffix}`}>Centro de custo</Label>
            <Select
              id={`departmentId-${fieldSuffix}`}
              name="departmentId"
              defaultValue={collaborator?.department_id ?? ''}
            >
              <option value="">Sem centro de custo</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor={`email-${fieldSuffix}`}>E-mail</Label>
            <Input
              id={`email-${fieldSuffix}`}
              name="email"
              type="email"
              defaultValue={collaborator?.email ?? ''}
              placeholder="nome@empresa.com"
            />
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
