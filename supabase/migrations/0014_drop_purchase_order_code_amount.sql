-- Desfeito: o lançamento (OC/Diário de Fatura) não guarda mais um valor próprio (era o
-- valor total da NF, com IPI). Só os campos de Desconto/Acréscimo da compra permanecem
-- pra ajustar o Valor da linha.

alter table purchase_order_codes
  drop column amount_cents;
