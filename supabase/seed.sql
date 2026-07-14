-- Dados de exemplo para começar a usar o sistema (setores, centros de custo, categorias).
-- Cartões e usuários são cadastrados depois, pela tela de Configurações, pois dependem
-- de usuários já existentes no Supabase Auth.

insert into departments (name) values
  ('Comercial'),
  ('Financeiro'),
  ('Tecnologia')
on conflict (name) do nothing;

insert into cost_centers (name, code) values
  ('Administrativo', 'CC-001'),
  ('Vendas', 'CC-002'),
  ('Tecnologia da Informação', 'CC-003')
on conflict (code) do nothing;

insert into categories (name) values
  ('Alimentação'),
  ('Transporte'),
  ('Hospedagem'),
  ('Material de escritório'),
  ('Software/Assinaturas'),
  ('Outros')
on conflict (name) do nothing;
