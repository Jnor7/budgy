insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('budgy-attachments','budgy-attachments',false,null,null)
on conflict(id) do update set public=false,file_size_limit=null,allowed_mime_types=null;

create policy attachments_storage_select on storage.objects for select to authenticated using(bucket_id='budgy-attachments' and (storage.foldername(name))[1]=auth.uid()::text);
create policy attachments_storage_insert on storage.objects for insert to authenticated with check(bucket_id='budgy-attachments' and (storage.foldername(name))[1]=auth.uid()::text);
create policy attachments_storage_update on storage.objects for update to authenticated using(bucket_id='budgy-attachments' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='budgy-attachments' and (storage.foldername(name))[1]=auth.uid()::text);
create policy attachments_storage_delete on storage.objects for delete to authenticated using(bucket_id='budgy-attachments' and (storage.foldername(name))[1]=auth.uid()::text);
