-- GRAPE TREE v10 additions. Safe to run more than once (Supabase > SQL Editor > paste > Run).
-- Adds: STAFF accounts (orders only), order tracking for customers, the "Ready" order status.

-- 1. allow the role "staff" and the status "ready" ------------------------------------------
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%customer%' loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
  for c in select conname from pg_constraint where conrelid = 'public.orders'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%confirmed%' loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','admin','staff'));
alter table public.orders   add constraint orders_status_check check (status in ('new','confirmed','preparing','ready','delivering','delivered','cancelled'));

-- 2. who is staff ------------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','staff'));
$$;

create table if not exists public.staff_emails (email text primary key);
alter table public.staff_emails enable row level security;
drop policy if exists "staff_emails: admin only" on public.staff_emails;
create policy "staff_emails: admin only" on public.staff_emails for all using (public.is_admin()) with check (public.is_admin());

-- a person who signs up with an email the admin added as staff becomes staff automatically
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    case when lower(new.email) in (select lower(email) from public.admin_emails) then 'admin'
         when lower(new.email) in (select lower(email) from public.staff_emails) then 'staff'
         else 'customer' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- the admin page uses these two functions (only an admin can run them)
create or replace function public.team_list()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return coalesce((select jsonb_agg(x order by x->>'role', x->>'email') from (
      select jsonb_build_object('email', p.email, 'name', coalesce(p.full_name,''), 'role', p.role, 'pending', false) x from public.profiles p where p.role in ('admin','staff')
      union all
      select jsonb_build_object('email', s.email, 'name', '', 'role', 'staff', 'pending', true) from public.staff_emails s
        where lower(s.email) not in (select lower(email) from public.profiles where role in ('admin','staff'))
    ) t), '[]'::jsonb);
end $$;

create or replace function public.team_set(p_email text, p_role text)
returns text language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email,''))); n int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if e = '' or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email address'; end if;
  if p_role not in ('staff','customer') then raise exception 'Bad role'; end if;
  if p_role = 'staff' then
    update public.profiles set role = 'staff' where lower(email) = e and role = 'customer';
    get diagnostics n = row_count;
    if exists (select 1 from public.profiles where lower(email) = e and role = 'admin') then return 'admin'; end if;
    insert into public.staff_emails (email) values (e) on conflict do nothing;
    return case when n > 0 or exists (select 1 from public.profiles where lower(email) = e and role = 'staff') then 'active' else 'pending' end;
  else
    update public.profiles set role = 'customer' where lower(email) = e and role = 'staff';
    delete from public.staff_emails where lower(email) = e;
    return 'removed';
  end if;
end $$;
revoke all on function public.team_list() from public; revoke all on function public.team_set(text, text) from public;
grant execute on function public.team_list() to authenticated; grant execute on function public.team_set(text, text) to authenticated;

-- 3. staff can see and update orders (not products, prices, website texts or legal texts) -----
drop policy if exists "orders: read own or admin" on public.orders;
drop policy if exists "orders: read own or staff" on public.orders;
create policy "orders: read own or staff" on public.orders for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "orders: admin updates" on public.orders;
drop policy if exists "orders: staff updates" on public.orders;
create policy "orders: staff updates" on public.orders for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "order-art: admin reads" on storage.objects;
drop policy if exists "order-art: staff reads" on storage.objects;
create policy "order-art: staff reads" on storage.objects for select using (bucket_id = 'order-art' and public.is_staff());

-- 4. order tracking: a customer enters the order number + the phone or email used on the order -
create or replace function public.track_order(p_no bigint, p_contact text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; c text := lower(trim(coalesce(p_contact,''))); d text := regexp_replace(coalesce(p_contact,''), '\D', '', 'g'); allowed boolean := false; pub jsonb;
begin
  select * into o from public.orders where order_no = p_no;
  if not found then return null; end if;
  if auth.uid() is not null and (o.user_id = auth.uid() or public.is_staff()) then allowed := true;
  elsif c <> '' and ((coalesce(o.email,'') <> '' and lower(o.email) = c)
        or (length(d) >= 7 and right(regexp_replace(o.phone, '\D', '', 'g'), 9) = right(d, 9))) then allowed := true;
  end if;
  if not allowed then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('t', h->>'t', 'status', h->>'status', 'msg', coalesce(h->>'msg','')) order by h->>'t'), '[]'::jsonb) into pub
    from jsonb_array_elements(coalesce(o.history, '[]'::jsonb)) h where coalesce((h->>'pub')::boolean, false);
  return jsonb_build_object('order_no', o.order_no, 'status', o.status, 'payment_status', o.payment_status, 'created_at', o.created_at,
    'delivery_date', o.delivery_date, 'first_name', split_part(o.name, ' ', 1), 'emirate', o.emirate, 'subtotal', o.subtotal, 'has_quote', o.has_quote,
    'art_review', o.art_review, 'art_review_note', case when o.art_review in ('changes','rejected') then o.art_review_note else '' end,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i->>'name', 'qty', i->>'qty')), '[]'::jsonb) from jsonb_array_elements(o.items) i),
    'timeline', pub);
end $$;
revoke all on function public.track_order(bigint, text) from public;
grant execute on function public.track_order(bigint, text) to anon, authenticated;
