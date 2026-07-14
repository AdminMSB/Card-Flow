-- Row Level Security: autorização é aplicada no Postgres, não apenas na aplicação.
-- Perfis: colaborador (só o próprio), gestor (setor do cartão), financeiro/admin (tudo).

alter table departments enable row level security;
alter table profiles enable row level security;
alter table cost_centers enable row level security;
alter table categories enable row level security;
alter table cards enable row level security;
alter table purchases enable row level security;
alter table invoices enable row level security;
alter table invoice_raw_rows enable row level security;
alter table invoice_items enable row level security;
alter table reconciliation_audit_log enable row level security;

-- Impede que um usuário sem papel "admin" promova a si mesmo ou mude de setor.
create or replace function prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth_role() <> 'admin' then
    if new.role is distinct from old.role or new.department_id is distinct from old.department_id then
      raise exception 'Apenas administradores podem alterar perfil ou setor.';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_role_escalation();

-- profiles ---------------------------------------------------------------

create policy profiles_select on profiles for select to authenticated using (
  id = auth.uid()
  or auth_role() in ('financeiro', 'admin')
  or (auth_role() = 'gestor' and department_id = auth_department())
);

create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or auth_role() = 'admin')
  with check (id = auth.uid() or auth_role() = 'admin');

-- departments / cost_centers / categories ---------------------------------

create policy departments_select on departments for select to authenticated using (true);
create policy departments_write on departments for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));

create policy cost_centers_select on cost_centers for select to authenticated using (true);
create policy cost_centers_write on cost_centers for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));

create policy categories_select on categories for select to authenticated using (true);
create policy categories_write on categories for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));

-- cards --------------------------------------------------------------------

create policy cards_select on cards for select to authenticated using (true);
create policy cards_write on cards for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));

-- purchases ------------------------------------------------------------------

create policy purchases_select on purchases for select to authenticated using (
  user_id = auth.uid()
  or auth_role() in ('financeiro', 'admin')
  or (
    auth_role() = 'gestor'
    and exists (select 1 from cards c where c.id = purchases.card_id and c.department_id = auth_department())
  )
);

create policy purchases_insert on purchases for insert to authenticated with check (
  user_id = auth.uid()
);

-- Dono edita os próprios dados só enquanto pendente (não pode se auto-aprovar).
create policy purchases_update_owner on purchases for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

-- Gestor do setor do cartão (ou financeiro/admin) aprova, rejeita ou concilia.
create policy purchases_update_approver on purchases for update to authenticated
  using (
    auth_role() in ('financeiro', 'admin')
    or (
      auth_role() = 'gestor'
      and exists (select 1 from cards c where c.id = purchases.card_id and c.department_id = auth_department())
    )
  )
  with check (
    auth_role() in ('financeiro', 'admin')
    or (
      auth_role() = 'gestor'
      and exists (select 1 from cards c where c.id = purchases.card_id and c.department_id = auth_department())
    )
  );

create policy purchases_delete on purchases for delete to authenticated using (
  (user_id = auth.uid() and status = 'pending')
  or auth_role() = 'admin'
);

-- invoices / invoice_raw_rows / invoice_items / reconciliation_audit_log ------
-- Leitura liberada para o gestor do setor do cartão (visibilidade em relatórios);
-- escrita (importar, mapear, conciliar) restrita a financeiro/admin.

create policy invoices_select on invoices for select to authenticated using (
  auth_role() in ('financeiro', 'admin')
  or (
    auth_role() = 'gestor'
    and exists (select 1 from cards c where c.id = invoices.card_id and c.department_id = auth_department())
  )
);

create policy invoices_write on invoices for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));

create policy invoice_raw_rows_select on invoice_raw_rows for select to authenticated using (
  auth_role() in ('financeiro', 'admin')
  or (
    auth_role() = 'gestor'
    and exists (
      select 1 from invoices i
      join cards c on c.id = i.card_id
      where i.id = invoice_raw_rows.invoice_id and c.department_id = auth_department()
    )
  )
);

create policy invoice_raw_rows_write on invoice_raw_rows for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));

create policy invoice_items_select on invoice_items for select to authenticated using (
  auth_role() in ('financeiro', 'admin')
  or (
    auth_role() = 'gestor'
    and exists (
      select 1 from invoices i
      join cards c on c.id = i.card_id
      where i.id = invoice_items.invoice_id and c.department_id = auth_department()
    )
  )
);

create policy invoice_items_write on invoice_items for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));

create policy reconciliation_audit_log_select on reconciliation_audit_log for select to authenticated using (
  auth_role() in ('financeiro', 'admin')
  or (
    auth_role() = 'gestor'
    and exists (
      select 1 from invoice_items ii
      join invoices i on i.id = ii.invoice_id
      join cards c on c.id = i.card_id
      where ii.id = reconciliation_audit_log.invoice_item_id and c.department_id = auth_department()
    )
  )
);

create policy reconciliation_audit_log_write on reconciliation_audit_log for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));
