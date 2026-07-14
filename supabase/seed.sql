-- Dados iniciais para começar a usar o sistema. Os setores abaixo vieram da planilha real
-- de controle de gastos do cartão corporativo (aba "Lançamentos", coluna "Departamento").
-- Cartões e usuários são cadastrados depois, pela tela de Configurações, pois dependem
-- de usuários já existentes no Supabase Auth.

insert into departments (name) values
  ('Administrativo'),
  ('Comercial'),
  ('Diretoria'),
  ('Diretoria Executiva'),
  ('Engenharia'),
  ('Logística'),
  ('Manutenção'),
  ('Produção'),
  ('Projetos e TI'),
  ('Qualidade'),
  ('Recursos Humanos'),
  ('TI')
on conflict (name) do nothing;

-- Categorias são opcionais (não existiam na planilha original) — apenas sugestões
-- iniciais para classificar compras nos relatórios; edite/exclua livremente em Configurações.
insert into categories (name) values
  ('Alimentação'),
  ('Transporte'),
  ('Hospedagem'),
  ('Material de escritório'),
  ('Software/Assinaturas'),
  ('Manutenção e Peças'),
  ('Outros')
on conflict (name) do nothing;
