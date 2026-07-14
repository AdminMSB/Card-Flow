-- Schema inicial: setores, centros de custo, categorias, cartões, compras, faturas e conciliação.
create extension if not exists pgcrypto;

-- departments/profiles têm referência circular (setor tem um gestor, que é um profile;
-- profile pertence a um setor) — criamos departments sem manager_id e adicionamos depois.
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'colaborador' check (role in ('colaborador', 'gestor', 'financeiro', 'admin')),
  department_id uuid references departments (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table departments
  add column manager_id uuid references profiles (id) on delete set null;

create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  last_four_digits text not null check (last_four_digits ~ '^[0-9]{4}$'),
  holder_id uuid references profiles (id) on delete set null,
  department_id uuid not null references departments (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards (id) on delete restrict,
  user_id uuid not null references profiles (id) on delete restrict,
  purchase_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  merchant_name text not null,
  category_id uuid references categories (id) on delete set null,
  cost_center_id uuid references cost_centers (id) on delete set null,
  description text,
  receipt_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'reconciled')),
  approved_by uuid references profiles (id) on delete set null,
  approved_at timestamptz,
  approval_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchases_card_id_idx on purchases (card_id);
create index purchases_user_id_idx on purchases (user_id);
create index purchases_status_idx on purchases (status);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards (id) on delete restrict,
  reference_month date not null,
  file_path text not null,
  file_name text not null,
  column_mapping jsonb,
  status text not null default 'mapping' check (status in ('mapping', 'reconciling', 'closed')),
  imported_by uuid not null references profiles (id) on delete restrict,
  imported_at timestamptz not null default now(),
  closed_at timestamptz
);

create index invoices_card_id_idx on invoices (card_id);

create table invoice_raw_rows (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  row_index int not null,
  raw_data jsonb not null
);

create index invoice_raw_rows_invoice_id_idx on invoice_raw_rows (invoice_id);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  item_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  merchant_raw text not null,
  description_raw text,
  matched_purchase_id uuid references purchases (id) on delete set null,
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched', 'auto_matched', 'manually_matched', 'disputed')),
  match_confidence numeric,
  created_at timestamptz not null default now()
);

create index invoice_items_invoice_id_idx on invoice_items (invoice_id);
create index invoice_items_matched_purchase_id_idx on invoice_items (matched_purchase_id);

create table reconciliation_audit_log (
  id uuid primary key default gen_random_uuid(),
  invoice_item_id uuid not null references invoice_items (id) on delete cascade,
  action text not null,
  performed_by uuid references profiles (id) on delete set null,
  performed_at timestamptz not null default now(),
  notes text
);

create index reconciliation_audit_log_invoice_item_id_idx on reconciliation_audit_log (invoice_item_id);
