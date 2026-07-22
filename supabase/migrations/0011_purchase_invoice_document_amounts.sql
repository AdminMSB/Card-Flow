-- O valor da compra passa a poder ser a soma dos valores de cada documento (NF/fatura/
-- boleto) anexado, quando informados — em vez de só um valor único digitado à parte.

alter table purchase_invoice_documents
  add column amount_cents bigint;
