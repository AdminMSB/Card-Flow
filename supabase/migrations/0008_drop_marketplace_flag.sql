-- Fornecedor passou a ser sempre um campo distinto e obrigatório do Site/Estabelecimento
-- (não só em compras via marketplace), então o sinalizador condicional não é mais
-- necessário — a UI sempre pede os dois campos agora.

alter table purchases
  drop column is_marketplace_purchase;
