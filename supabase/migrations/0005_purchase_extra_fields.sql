-- Campos adicionais identificados na planilha real de controle de gastos do cartão
-- corporativo, para que o sistema substitua a planilha sem perder informação:
-- requisição interna, fornecedor/CNPJ, número de NF/fatura/boleto do fornecedor,
-- e código de OC (ordem de compra) usado no faturamento interno.

alter table purchases
  add column requisition_number text,
  add column supplier_name text,
  add column supplier_cnpj text,
  add column invoice_document_number text,
  add column purchase_order_code text;
