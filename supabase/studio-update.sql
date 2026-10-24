-- ===============================================================
-- GRAPE TREE: CAKE STUDIO UPDATE  (safe to run more than once)
-- 1) a PRIVATE storage bucket for the customers' design files
-- 2) the order function now keeps the design-file details
-- Run it in Supabase: SQL Editor -> New query -> paste -> Run.
-- ===============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-art', 'order-art', false, 15728640,
        array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','application/json'])
on conflict (id) do update set public = false, file_size_limit = 15728640,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','application/json'];

-- anyone placing an order may upload their own design files (nobody can read, change or delete them except admins)
drop policy if exists "order-art: customers upload" on storage.objects;
create policy "order-art: customers upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'order-art' and name ~ '^[A-Za-z0-9]{6,60}/[A-Za-z0-9._-]{3,60}$');
drop policy if exists "order-art: admin reads" on storage.objects;
create policy "order-art: admin reads" on storage.objects for select using (bucket_id = 'order-art' and public.is_admin());
drop policy if exists "order-art: admin deletes" on storage.objects;
create policy "order-art: admin deletes" on storage.objects for delete using (bucket_id = 'order-art' and public.is_admin());

create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it jsonb; p record; line_total numeric; sub numeric := 0; quoted boolean := false;
  clean jsonb := '[]'::jsonb; new_order public.orders;
  nm text := left(trim(coalesce(payload->>'name','')), 120);
  ph text := left(trim(coalesce(payload->>'phone','')), 40);
  em text := left(trim(coalesce(payload->>'email','')), 160);
  ad text := left(trim(coalesce(payload->>'address','')), 600);
  eo text := left(trim(coalesce(payload->>'emirate','')), 40);
  nt text := left(trim(coalesce(payload->>'notes','')), 1000);
  pm text := left(trim(coalesce(payload->>'payment_method','whatsapp')), 30);
  dd date := nullif(payload->>'delivery_date','')::date;
begin
  if nm = '' or ph = '' or ad = '' or eo = '' then raise exception 'Missing delivery details'; end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 or jsonb_array_length(payload->'items') > 60 then
    raise exception 'Cart is empty or too large';
  end if;
  for it in select * from jsonb_array_elements(payload->'items') loop
    if coalesce((it->>'qty')::int,0) < 1 or (it->>'qty')::int > 999 then raise exception 'Bad quantity'; end if;
    select * into p from public.products where id = it->>'id' and active;
    if found then
      line_total := p.price * (it->>'qty')::int;                       -- real price from the database
      clean := clean || jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name,'qty',(it->>'qty')::int,'unit',p.price,'total',line_total));
    else
      -- custom order lines: the website sends an estimate; the team confirms the final price with the customer
      line_total := coalesce((it->>'total')::numeric, 0);
      if coalesce((it->>'quote')::boolean,false) then quoted := true; end if;
      clean := clean || jsonb_build_array(jsonb_build_object(
        'id', left(coalesce(it->>'id','custom'),60), 'name', left(coalesce(it->>'name','Custom order'),160),
        'qty', (it->>'qty')::int, 'total', line_total, 'custom', true, 'quote', coalesce((it->>'quote')::boolean,false),
        'meta', coalesce(it->'meta','[]'::jsonb), 'note', left(coalesce(it->>'note',''),600),
        'art', case when jsonb_typeof(it->'art') = 'object' then jsonb_build_object(
                 'id', left(coalesce(it->'art'->>'id',''),60),
                 'folder', case when (it->'art'->>'folder') ~ '^[A-Za-z0-9]{6,60}$' then it->'art'->>'folder' else null end,
                 'files', case when jsonb_typeof(it->'art'->'files') = 'object' then it->'art'->'files' else null end,
                 'failed', coalesce((it->'art'->>'failed')::boolean,false),
                 'designer', coalesce((it->'art'->>'designer')::boolean,false),
                 'finish', left(coalesce(it->'art'->>'finish',''),20),
                 'look', left(coalesce(it->'art'->>'look',''),20)) else null end));
    end if;
    sub := sub + line_total;
  end loop;
  insert into public.orders (user_id, name, phone, email, emirate, address, delivery_date, notes, items, subtotal, has_quote, payment_method, source)
  values (auth.uid(), nm, ph, em, eo, ad, dd, nt, clean, sub, quoted, pm, left(coalesce(payload->>'source',''),120))
  returning * into new_order;
  return jsonb_build_object('order_no', new_order.order_no, 'subtotal', new_order.subtotal);
end $$;
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
