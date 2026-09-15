-- Faltava a política de UPDATE no bucket de comprovantes: o caminho do arquivo é fixo por
-- compra (user_id/purchase_id), então reenviar/substituir um comprovante já existente é um
-- upsert (update), não um insert — sem essa política, a 2ª tentativa em diante falhava
-- silenciosamente com "Não foi possível enviar o comprovante", travando o resto do
-- salvamento junto (Site, Fornecedor etc. voltavam ao valor antigo).

create policy receipts_update on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
