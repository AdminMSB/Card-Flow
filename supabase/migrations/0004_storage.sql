-- Buckets privados: comprovantes de compra e arquivos de fatura importados.
-- Convenção de path: receipts/{user_id}/{arquivo}; invoices/{invoice_id}/{arquivo}.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false), ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy receipts_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy receipts_select on storage.objects for select to authenticated using (
  bucket_id = 'receipts' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or auth_role() in ('financeiro', 'admin')
    or (
      auth_role() = 'gestor'
      and exists (
        select 1 from purchases p
        join cards c on c.id = p.card_id
        where p.receipt_path = storage.objects.name and c.department_id = auth_department()
      )
    )
  )
);

create policy receipts_delete on storage.objects for delete to authenticated using (
  bucket_id = 'receipts' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or auth_role() = 'admin'
  )
);

create policy invoices_bucket_all on storage.objects for all to authenticated using (
  bucket_id = 'invoices' and auth_role() in ('financeiro', 'admin')
) with check (
  bucket_id = 'invoices' and auth_role() in ('financeiro', 'admin')
);
