-- =====================================================================
-- GRAPE TREE - DATABASE SETUP
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- It is safe to run twice (it will not duplicate or delete anything).
--
-- BEFORE YOU RUN: change the admin email in section 2 (one line).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. CUSTOMER PROFILES
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        text not null default 'customer' check (role in ('customer','admin')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 2. WHO IS AN ADMIN
--    Anyone who signs up (and confirms their email) with an address in
--    this list becomes an admin automatically. Add more people any time:
--      insert into public.admin_emails values ('colleague@grapetree.ae');
-- ---------------------------------------------------------------
create table if not exists public.admin_emails (
  email text primary key
);
insert into public.admin_emails (email) values
  ('CHANGE-ME@example.com')            -- <<< put YOUR admin email here (lower case)
on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- creates the profile when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'admin' else 'customer' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- 3. PRODUCTS (what the shop page shows)
-- ---------------------------------------------------------------
create table if not exists public.products (
  id          text primary key,
  brand       text not null check (brand in ('katanukiya','gildart')),
  name        text not null,
  short       text default '',
  description text default '',
  details     jsonb not null default '[]'::jsonb,
  price       numeric(10,2) not null default 0,
  image_url   text default '',
  customize   jsonb,
  active      boolean not null default true,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 4. WEBSITE CONTENT (home page images and text you edit in the admin)
-- ---------------------------------------------------------------
create table if not exists public.site_content (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 5. ORDERS
-- ---------------------------------------------------------------
create sequence if not exists public.order_no_seq start 1001;
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       bigint not null unique default nextval('public.order_no_seq'),
  user_id        uuid references auth.users(id) on delete set null,
  name           text not null,
  phone          text not null,
  email          text default '',
  emirate        text not null,
  address        text not null,
  delivery_date  date,
  notes          text default '',
  items          jsonb not null,
  subtotal       numeric(10,2) not null default 0,
  has_quote      boolean not null default false,
  payment_method text not null default 'whatsapp',
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  status         text not null default 'new' check (status in ('new','confirmed','preparing','delivering','delivered','cancelled')),
  source         text default '',
  admin_note     text default '',
  created_at     timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);

-- ---------------------------------------------------------------
-- 6. SAVED ADDRESSES
-- ---------------------------------------------------------------
create table if not exists public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text default 'Home',
  emirate    text not null,
  address    text not null,
  phone      text default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 7. SECURITY RULES (who can see and change what)
-- ---------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.admin_emails  enable row level security;
alter table public.products      enable row level security;
alter table public.site_content  enable row level security;
alter table public.orders        enable row level security;
alter table public.addresses     enable row level security;

drop policy if exists "profile: read own or admin" on public.profiles;
create policy "profile: read own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profile: update own" on public.profiles;
create policy "profile: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "admin_emails: admin only" on public.admin_emails;
create policy "admin_emails: admin only" on public.admin_emails for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products: everyone reads active" on public.products;
create policy "products: everyone reads active" on public.products for select using (active or public.is_admin());
drop policy if exists "products: admin writes" on public.products;
create policy "products: admin writes" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "content: everyone reads" on public.site_content;
create policy "content: everyone reads" on public.site_content for select using (true);
drop policy if exists "content: admin writes" on public.site_content;
create policy "content: admin writes" on public.site_content for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders: read own or admin" on public.orders;
create policy "orders: read own or admin" on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders: admin updates" on public.orders;
create policy "orders: admin updates" on public.orders for update using (public.is_admin()) with check (public.is_admin());
-- (no direct insert: orders are created only through place_order() below)

drop policy if exists "addresses: own" on public.addresses;
create policy "addresses: own" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 8. PLACING AN ORDER (checks the data, uses real prices from the database)
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- 9. PHOTO STORAGE (images you upload in the admin)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('site-images','site-images', true)
on conflict (id) do nothing;
drop policy if exists "images: public read" on storage.objects;
create policy "images: public read" on storage.objects for select using (bucket_id = 'site-images');
drop policy if exists "images: admin upload" on storage.objects;
create policy "images: admin upload" on storage.objects for insert with check (bucket_id = 'site-images' and public.is_admin());
drop policy if exists "images: admin change" on storage.objects;
create policy "images: admin change" on storage.objects for update using (bucket_id = 'site-images' and public.is_admin());
drop policy if exists "images: admin delete" on storage.objects;
create policy "images: admin delete" on storage.objects for delete using (bucket_id = 'site-images' and public.is_admin());

-- ---------------------------------------------------------------
-- 10. YOUR CURRENT PRODUCTS (copied from the website; edit them later in the admin)
-- ---------------------------------------------------------------
insert into public.products (id, brand, name, short, description, details, price, image_url, customize, active, sort_order) values
  ('k-burj-khalifa', 'katanukiya', 'Burj Khalifa Cut-Out Layered Cake', 'Precision-cut layer cake revealing the Burj Khalifa.', 'A premium layer cake cut into the shape of the Burj Khalifa with water-jet precision, presented in a gift-ready box.', '["Premium layer cake, cut to shape with water-jet precision","Printed with the Burj Khalifa name in English and Arabic","Presented in a gift-ready box"]'::jsonb, 45, 'images/katanukiya-product1.jpg', '{"builder":"katanukiya","design":"burj-khalifa"}'::jsonb, true, 10),
  ('k-burj-al-arab', 'katanukiya', 'Burj Al Arab Cut-Out Layered Cake', 'The Burj Al Arab sail, cut from layered cake.', 'Layered cake precision-cut into the Burj Al Arab sail, a creative gift for visitors and residents alike.', '["Premium layer cake, cut to shape with water-jet precision","Printed with the Burj Al Arab name in English and Arabic","Presented in a gift-ready box"]'::jsonb, 45, 'images/katanukiya-product2.jpg', '{"builder":"katanukiya","design":"burj-al-arab"}'::jsonb, true, 20),
  ('k-camel-dubai', 'katanukiya', 'Dubai Camel Cut-Out Layered Cake', 'A camel cut-out in a classic Dubai-design box.', 'Premium layer cake cut into a camel, presented in a Dubai-design box. A playful gift with real Japanese precision.', '["Premium layer cake, cut to shape with water-jet precision","Dubai-design gift box","Edible printing in fine detail"]'::jsonb, 45, 'images/katanukiya-product3.jpg', '{"builder":"katanukiya","design":"camel-dubai"}'::jsonb, true, 30),
  ('k-camel-playful', 'katanukiya', 'Playful Camel Cut-Out Layered Cake', 'A cheerful camel design, made to surprise.', 'A friendly, colourful camel cut from premium layer cake. Made to bring a smile to anyone who opens the box.', '["Premium layer cake, cut to shape with water-jet precision","Colourful edible character printing","Presented in a gift-ready box"]'::jsonb, 45, 'images/katanukiya-product4.jpg', '{"builder":"katanukiya","design":"camel-playful"}'::jsonb, true, 40),
  ('g-gold-box', 'gildart', 'Gold Chocolate Box', 'Elegant premium chocolate crafted for luxury gifting.', 'Gold-toned chocolate squares inspired by Dubai, presented in a black signature gift box. Elegant premium chocolate crafted for luxury gifting.', '["Crafted with selected ingredients and real gold leaf","Dubai-inspired gold designs","Black signature gift box"]'::jsonb, 95, 'images/gildart-product1.jpg', '{"builder":"gildart","product":"gold-box"}'::jsonb, true, 50),
  ('g-luxury-collection', 'gildart', 'Luxury Gift Collection', 'Refined presentation for unforgettable moments.', 'A larger gifting collection with refined presentation, designed for unforgettable moments and corporate gifting.', '["Crafted with selected ingredients and real gold leaf","Refined luxury presentation","Black signature gift box"]'::jsonb, 165, 'images/gildart-product2.jpg', '{"builder":"gildart","product":"luxury-collection"}'::jsonb, true, 60),
  ('g-seasonal', 'gildart', 'Seasonal Premium Gifting', 'Exclusive gifting inspired by craftsmanship.', 'Exclusive seasonal gifting experiences inspired by craftsmanship, for celebrations and special occasions.', '["Crafted with selected ingredients and real gold leaf","Seasonal and celebration presentation","Black signature gift box"]'::jsonb, 220, 'images/gildart-product3.jpg', '{"builder":"gildart","product":"seasonal"}'::jsonb, true, 70)
on conflict (id) do nothing;

-- GRAPE TREE v7 additions. Safe to run more than once (Supabase > SQL Editor > paste > Run).

-- 1. "Ready to gift" on the home page: the admin stars products
alter table public.products add column if not exists featured boolean not null default false;

-- 2. AI usage limit per visitor per day (used by the studio-ai function)
create table if not exists public.ai_usage (
  day date not null default current_date,
  ip text not null,
  n int not null default 0,
  primary key (day, ip)
);
alter table public.ai_usage enable row level security;   -- no policies: only the function (service role) can touch it

-- 3. Test orders (placed by an admin from the studio) can be deleted by admins
drop policy if exists "orders: admin deletes test orders" on public.orders;
create policy "orders: admin deletes test orders" on public.orders for delete using (public.is_admin() and source = 'admin-test');
