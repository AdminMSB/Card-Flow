-- O lançamento (OC/Diário de Fatura) precisa registrar o valor total da nota fiscal
-- (com IPI destacado), diferente do valor do documento anexado (sem IPI, que é o que
-- efetivamente aparece na fatura do cartão e entra na soma da compra).

alter table purchase_order_codes
  add column amount_cents bigint;
