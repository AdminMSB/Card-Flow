-- Sinaliza quando a compra foi feita através de um marketplace/site (ex.: Mercado Livre):
-- nesse caso o "Estabelecimento" que aparece na fatura do cartão (a plataforma) é diferente
-- do "Fornecedor" real (o vendedor específico daquele produto) — os dois precisam ficar
-- registrados separadamente. Quando a compra não é via marketplace, estabelecimento e
-- fornecedor são a mesma informação (comportamento já existente).

alter table purchases
  add column is_marketplace_purchase boolean not null default false;
