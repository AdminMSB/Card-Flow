'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCategory, updateCategory } from './actions';

interface Category {
  id: string;
  name: string;
}

interface CategoriaFormDialogProps {
  mode: 'create' | 'edit';
  category?: Category;
}

export function CategoriaFormDialog({ mode, category }: CategoriaFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = mode === 'edit' && Boolean(category);
  const action = isEdit ? updateCategory : createCategory;
  const fieldSuffix = category?.id ?? 'new';

  return (
    <>
      <Button
        type="button"
        variant={isEdit ? 'secondary' : 'primary'}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {isEdit ? 'Editar' : 'Nova categoria'}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar categoria' : 'Nova categoria'}>
        <form action={action} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          {isEdit && category && <input type="hidden" name="id" value={category.id} />}

          <div>
            <Label htmlFor={`name-${fieldSuffix}`}>Nome</Label>
            <Input id={`name-${fieldSuffix}`} name="name" defaultValue={category?.name} required />
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
