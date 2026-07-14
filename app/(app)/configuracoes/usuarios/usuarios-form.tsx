'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ROLE_LABELS, type Role } from '@/types/domain';
import { inviteUser, updateUserRole } from './actions';

interface Department {
  id: string;
  name: string;
}

const ROLE_ENTRIES = Object.entries(ROLE_LABELS) as [Role, string][];

export function InviteUserDialog({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Convidar usuário
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Convidar usuário">
        <form action={inviteUser} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          <div>
            <Label htmlFor="invite-full-name">Nome completo</Label>
            <Input id="invite-full-name" name="full_name" required />
          </div>

          <div>
            <Label htmlFor="invite-email">E-mail</Label>
            <Input id="invite-email" name="email" type="email" required />
          </div>

          <div>
            <Label htmlFor="invite-role">Papel</Label>
            <Select id="invite-role" name="role" defaultValue="colaborador" required>
              {ROLE_ENTRIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="invite-department">Setor</Label>
            <Select id="invite-department" name="department_id" defaultValue="">
              <option value="">Nenhum</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Enviar convite</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

interface UserRow {
  id: string;
  full_name: string;
  role: Role;
  department_id: string | null;
}

export function EditRoleDialog({ user, departments }: { user: UserRow; departments: Department[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Editar papel
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={`Editar ${user.full_name}`}>
        <form action={updateUserRole} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="user_id" value={user.id} />

          <div>
            <Label htmlFor={`role-${user.id}`}>Papel</Label>
            <Select id={`role-${user.id}`} name="role" defaultValue={user.role} required>
              {ROLE_ENTRIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor={`department-${user.id}`}>Setor</Label>
            <Select id={`department-${user.id}`} name="department_id" defaultValue={user.department_id ?? ''}>
              <option value="">Nenhum</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
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
