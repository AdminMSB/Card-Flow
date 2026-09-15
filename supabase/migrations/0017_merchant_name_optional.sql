-- Site deixa de herdar o valor do Fornecedor quando fica em branco (esse "fallback" fazia
-- o valor do Fornecedor ficar gravado em merchant_name e reaparecer no campo Site como se
-- tivesse sido preenchido automaticamente). Agora é puramente manual — nulo quando vazio.

alter table purchases
  alter column merchant_name drop not null;
