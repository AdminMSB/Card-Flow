'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createCard, updateCard } from './actions';

interface Person {
  id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

interface CardRow {
  id: string;
  last_four_digits: string;
  holder_id: string | null;
  department_id: string;
  active: boolean;
}

interface CartaoFormDialogProps {
  mode: 'create' | 'edit';
  holders: Person[];
  departments: Department[];
  card?: CardRow;
}

export function CartaoFormDialog({ mode, holders, departments, card }: CartaoFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = mode === 'edit' && Boolean(card);
  const action = isEdit ? updateCard : createCard;
  const fieldSuffix = card?.id ?? 'new';

  return (
    <>
      <Button
        type="button"
        variant={isEdit ? 'secondary' : 'primary'}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {isEdit ? 'Editar' : 'Novo cartão'}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar cartão' : 'Novo cartão'}>
        <form action={action} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          {isEdit && card && <input type="hidden" name="id" value={card.id} />}

          <div>
            <Label htmlFor={`last-four-${fieldSuffix}`}>Últimos 4 dígitos</Label>
            <Input
              id={`last-four-${fieldSuffix}`}
              name="last_four_digits"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              defaultValue={card?.last_four_digits}
              placeholder="0000"
              required
            />
          </div>

          <div>
            <Label htmlFor={`holder-${fieldSuffix}`}>Titular</Label>
            <Select id={`holder-${fieldSuffix}`} name="holder_id" defaultValue={card?.holder_id ?? ''}>
              <option value="">Nenhum</option>
              {holders.map((holder) => (
                <option key={holder.id} value={holder.id}>
                  {holder.full_name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor={`department-${fieldSuffix}`}>Setor</Label>
            <Select
              id={`department-${fieldSuffix}`}
              name="department_id"
              defaultValue={card?.department_id ?? ''}
              required
            >
              <option value="" disabled>
                Selecione um setor
              </option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`active-${fieldSuffix}`}
              name="active"
              type="checkbox"
              defaultChecked={card ? card.active : true}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor={`active-${fieldSuffix}`} className="mb-0">
              Cartão ativo
            </Label>
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
