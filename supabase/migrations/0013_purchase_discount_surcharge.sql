-- Desconto e acréscimo (juros/taxa) ajustam o valor da compra pra bater com o que
-- efetivamente aparece na fatura do cartão, quando o valor cobrado difere da soma "crua"
-- dos documentos anexados.

alter table purchases
  add column discount_cents bigint not null default 0,
  add column surcharge_cents bigint not null default 0;
