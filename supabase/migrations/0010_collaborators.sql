-- Cadastro de colaboradores (nome, centro de custo/departamento e e-mail), independente
-- de terem login no sistema — usado para preencher automaticamente o Centro de Custo ao
-- digitar o Solicitante no cadastro de uma compra.

create table collaborators (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  department_id uuid references departments (id) on delete set null,
  email text,
  created_at timestamptz not null default now()
);

alter table collaborators enable row level security;

create policy collaborators_select on collaborators for select to authenticated using (true);
create policy collaborators_write on collaborators for all to authenticated
  using (auth_role() in ('financeiro', 'admin'))
  with check (auth_role() in ('financeiro', 'admin'));
