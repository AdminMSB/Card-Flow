-- Uma linha de compra pode ter mais de um "lançamento" (código de OC e/ou de Diário de
-- Fatura) e mais de um documento (NF/fatura/boleto) anexado à mesma OC. Isso passa a ser
-- uma lista por compra, em tabelas filhas — em vez do valor único em
-- purchases.purchase_order_code / invoice_document_number, que ficam só para o histórico
-- já importado (a UI passa a exibir/gravar através dessas tabelas a partir de agora).

create table purchase_order_codes (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);

create index purchase_order_codes_purchase_id_idx on purchase_order_codes (purchase_id);

create table purchase_invoice_documents (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases (id) on delete cascade,
  document_number text not null,
  created_at timestamptz not null default now()
);

create index purchase_invoice_documents_purchase_id_idx on purchase_invoice_documents (purchase_id);

alter table purchase_order_codes enable row level security;
alter table purchase_invoice_documents enable row level security;

-- Mesma visibilidade/edição da compra "pai" (dono enquanto pendente, ou
-- gestor/financeiro/admin com escopo sobre ela) — mesma lógica de purchases_select /
-- purchases_update_approver, só que aplicada via join até a compra.

create policy purchase_order_codes_select on purchase_order_codes for select to authenticated using (
  exists (
    select 1 from purchases p
    left join cards c on c.id = p.card_id
    where p.id = purchase_order_codes.purchase_id
      and (
        p.user_id = auth.uid()
        or auth_role() in ('financeiro', 'admin')
        or (
          auth_role() = 'gestor'
          and (p.department_id = auth_department() or c.department_id = auth_department())
        )
      )
  )
);

create policy purchase_order_codes_write on purchase_order_codes for all to authenticated
  using (
    exists (
      select 1 from purchases p
      left join cards c on c.id = p.card_id
      where p.id = purchase_order_codes.purchase_id
        and (
          (p.user_id = auth.uid() and p.status = 'pending')
          or auth_role() in ('financeiro', 'admin')
          or (
            auth_role() = 'gestor'
            and (p.department_id = auth_department() or c.department_id = auth_department())
          )
        )
    )
  )
  with check (
    exists (
      select 1 from purchases p
      left join cards c on c.id = p.card_id
      where p.id = purchase_order_codes.purchase_id
        and (
          (p.user_id = auth.uid() and p.status = 'pending')
          or auth_role() in ('financeiro', 'admin')
          or (
            auth_role() = 'gestor'
            and (p.department_id = auth_department() or c.department_id = auth_department())
          )
        )
    )
  );

create policy purchase_invoice_documents_select on purchase_invoice_documents for select to authenticated using (
  exists (
    select 1 from purchases p
    left join cards c on c.id = p.card_id
    where p.id = purchase_invoice_documents.purchase_id
      and (
        p.user_id = auth.uid()
        or auth_role() in ('financeiro', 'admin')
        or (
          auth_role() = 'gestor'
          and (p.department_id = auth_department() or c.department_id = auth_department())
        )
      )
  )
);

create policy purchase_invoice_documents_write on purchase_invoice_documents for all to authenticated
  using (
    exists (
      select 1 from purchases p
      left join cards c on c.id = p.card_id
      where p.id = purchase_invoice_documents.purchase_id
        and (
          (p.user_id = auth.uid() and p.status = 'pending')
          or auth_role() in ('financeiro', 'admin')
          or (
            auth_role() = 'gestor'
            and (p.department_id = auth_department() or c.department_id = auth_department())
          )
        )
    )
  )
  with check (
    exists (
      select 1 from purchases p
      left join cards c on c.id = p.card_id
      where p.id = purchase_invoice_documents.purchase_id
        and (
          (p.user_id = auth.uid() and p.status = 'pending')
          or auth_role() in ('financeiro', 'admin')
          or (
            auth_role() = 'gestor'
            and (p.department_id = auth_department() or c.department_id = auth_department())
          )
        )
    )
  );
