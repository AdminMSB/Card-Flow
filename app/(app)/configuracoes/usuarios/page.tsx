import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ROLE_LABELS, type Role } from '@/types/domain';
import { InviteUserDialog, EditRoleDialog } from './usuarios-form';

const ROLE_TONES: Record<Role, BadgeTone> = {
  colaborador: 'neutral',
  gestor: 'info',
  financeiro: 'warning',
  admin: 'success',
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const currentProfile = await requireRole('financeiro', 'admin');
  const canEditRoles = currentProfile.role === 'admin';

  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  const [{ data: profiles }, { data: departments }, { data: usersPage }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, department_id').order('full_name'),
    supabase.from('departments').select('id, name').order('name'),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const profileList = profiles ?? [];
  const departmentList = departments ?? [];
  const emailById = new Map((usersPage?.users ?? []).map((user) => [user.id, user.email ?? '—']));
  const departmentNameById = new Map(departmentList.map((department) => [department.id, department.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Cadastro de usuários, papéis e setores.</p>
        </div>
        <InviteUserDialog departments={departmentList} />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      {!canEditRoles && (
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem alterar papéis e setores de outros usuários.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profileList.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>{profile.full_name}</TableCell>
                  <TableCell>{emailById.get(profile.id) ?? '—'}</TableCell>
                  <TableCell>
                    <Badge tone={ROLE_TONES[profile.role]}>{ROLE_LABELS[profile.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    {profile.department_id ? departmentNameById.get(profile.department_id) ?? '—' : '—'}
                  </TableCell>
                  <TableCell>
                    {canEditRoles ? (
                      <div className="flex justify-end">
                        <EditRoleDialog user={profile} departments={departmentList} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {profileList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum usuário cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
