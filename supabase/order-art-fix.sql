-- ===============================================================
-- GRAPE TREE: FIX FOR CUSTOMER DESIGN FILES  (safe to run more than once)
-- Creates the private storage box "order-art" and lets signed-in customers
-- save their design files there. Only admins can open or delete them.
-- Run it in Supabase: SQL Editor -> New query -> paste -> Run.
-- (It does NOT touch the order function.)
-- ===============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-art', 'order-art', false, 52428800, null)
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = null;

drop policy if exists "order-art: customers upload" on storage.objects;
create policy "order-art: customers upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'order-art' and name ~ '^[A-Za-z0-9]{6,60}/[A-Za-z0-9._-]{3,60}$');
drop policy if exists "order-art: admin reads" on storage.objects;
create policy "order-art: admin reads" on storage.objects for select using (bucket_id = 'order-art' and public.is_admin());
drop policy if exists "order-art: admin deletes" on storage.objects;
create policy "order-art: admin deletes" on storage.objects for delete using (bucket_id = 'order-art' and public.is_admin());
