-- Funções auxiliares (security definer para poderem ser usadas dentro de policies de RLS
-- sem cair em recursão ao consultar a própria tabela `profiles`) e triggers de manutenção.

create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_department()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from profiles where id = auth.uid();
$$;

-- Cria a linha em `profiles` automaticamente quando um usuário é criado via Supabase Auth.
-- Espera metadata em raw_user_meta_data: { full_name, role, department_id }.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, department_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'colaborador'),
    (new.raw_user_meta_data->>'department_id')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger purchases_set_updated_at
  before update on purchases
  for each row execute function set_updated_at();
