-- v18: CLOSE ONLINE ORDERING ON THE SERVER.
-- Even if someone opens an ordering page directly or calls the database by hand,
-- no new order can be saved while the shop is closed. Staff (signed in) can still test.
-- To open the shop again later: Admin > "Shop on/off and bank" > tick "The online shop is OPEN" > Save.

-- 1. close the shop now
insert into public.site_content (key, value, updated_at)
values ('settings', '{"shop_open": false}'::jsonb, now())
on conflict (key) do update
  set value = coalesce(public.site_content.value, '{}'::jsonb) || '{"shop_open": false}'::jsonb,
      updated_at = now();

-- 2. is the shop open? (closed unless the admin switched it ON)
create or replace function public.shop_is_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value->>'shop_open')::boolean from public.site_content where key = 'settings'), false);
$$;

-- 3. no order can be inserted while it is closed, unless a signed-in staff member (testing) does it
create or replace function public.orders_closed_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.shop_is_open() and not public.is_staff() then
    raise exception 'Online ordering is paused right now.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists orders_closed_guard on public.orders;
create trigger orders_closed_guard before insert on public.orders
  for each row execute function public.orders_closed_guard();
