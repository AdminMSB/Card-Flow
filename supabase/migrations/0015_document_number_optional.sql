-- Um documento (NF/fatura/boleto) pode ter o valor conhecido sem ainda ter um número
-- identificável (ex.: NFS-e cujo layout não deixou claro o número) — trava o cadastro
-- inteiro exigir um número só porque o valor foi preenchido.

alter table purchase_invoice_documents
  alter column document_number drop not null;
