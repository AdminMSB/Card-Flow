-- Suporte a importação de compras históricas que ainda não têm uma conta de usuário
-- vinculada (ex.: planilha antiga, com o nome de quem comprou mas sem login no sistema),
-- e a departamentos que compram usando um cartão compartilhado por vários setores (o
-- setor não pode mais ser inferido só pelo cartão nesse caso).

alter table purchases
  alter column user_id drop not null,
  add column requester_name text,
  add column department_id uuid references departments (id) on delete set null;

-- Uma compra sempre precisa de "alguém"/"algum setor" identificável: ou a conta de um
-- usuário real, ou pelo menos o nome de quem comprou (dado histórico importado).
alter table purchases
  add constraint purchases_user_or_requester_name check (user_id is not null or requester_name is not null);

create index purchases_department_id_idx on purchases (department_id);

-- RLS: gestor também vê/aprova compras marcadas diretamente com o setor dele (além das
-- que já via pelo setor do cartão) — necessário para dados importados de um cartão
-- compartilhado por múltiplos setores, onde o setor da compra não é o setor do cartão.

drop policy purchases_select on purchases;
create policy purchases_select on purchases for select to authenticated using (
  user_id = auth.uid()
  or auth_role() in ('financeiro', 'admin')
  or (
    auth_role() = 'gestor'
    and (
      department_id = auth_department()
      or exists (select 1 from cards c where c.id = purchases.card_id and c.department_id = auth_department())
    )
  )
);

drop policy purchases_update_approver on purchases;
create policy purchases_update_approver on purchases for update to authenticated
  using (
    auth_role() in ('financeiro', 'admin')
    or (
      auth_role() = 'gestor'
      and (
        department_id = auth_department()
        or exists (select 1 from cards c where c.id = purchases.card_id and c.department_id = auth_department())
      )
    )
  )
  with check (
    auth_role() in ('financeiro', 'admin')
    or (
      auth_role() = 'gestor'
      and (
        department_id = auth_department()
        or exists (select 1 from cards c where c.id = purchases.card_id and c.department_id = auth_department())
      )
    )
  );
