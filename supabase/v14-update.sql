-- ===============================================================
-- GRAPE TREE v14: TEAM ACCESS LEVELS  (safe to run more than once)
-- The admin can now choose which pages each team member may use.
-- Run it in Supabase: SQL Editor -> New query -> paste -> Run.
-- ===============================================================
alter table public.profiles add column if not exists perms text[] not null default '{}';
alter table public.profiles add column if not exists job_title text not null default '';

-- existing team members keep what they had before: the Orders page
update public.profiles set perms = array['orders'] where role = 'staff' and coalesce(cardinality(perms),0) = 0;

-- does the signed-in person have this permission? (admins always do)
create or replace function public.has_perm(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'staff' and k = any(perms));
$$;

-- "orders" access = may see and update orders, designs and files
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_perm('orders');
$$;

-- which website texts a person may save
create or replace function public.content_ok(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_perm(case k when 'studio' then 'studio' when 'legal' then 'legal' when 'business' then 'business' when 'settings' then 'settings' else 'website' end);
$$;

-- nobody can give themselves more access
drop policy if exists "profile: update own" on public.profiles;
create policy "profile: update own" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid())
              and perms = (select perms from public.profiles where id = auth.uid()));

drop policy if exists "profile: read own or admin" on public.profiles;
create policy "profile: read own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin() or public.has_perm('customers'));

drop policy if exists "products: everyone reads active" on public.products;
create policy "products: everyone reads active" on public.products for select using (active or public.has_perm('products'));
drop policy if exists "products: admin writes" on public.products;
create policy "products: admin writes" on public.products for all using (public.has_perm('products')) with check (public.has_perm('products'));

drop policy if exists "content: admin writes" on public.site_content;
create policy "content: admin writes" on public.site_content for all using (public.content_ok(key)) with check (public.content_ok(key));

drop policy if exists "images: admin upload" on storage.objects;
create policy "images: admin upload" on storage.objects for insert with check (bucket_id = 'site-images' and (public.has_perm('website') or public.has_perm('products')));
drop policy if exists "images: admin change" on storage.objects;
create policy "images: admin change" on storage.objects for update using (bucket_id = 'site-images' and (public.has_perm('website') or public.has_perm('products')));
drop policy if exists "images: admin delete" on storage.objects;
create policy "images: admin delete" on storage.objects for delete using (bucket_id = 'site-images' and (public.has_perm('website') or public.has_perm('products')));

-- the team list (admin only) now includes job title and access
create or replace function public.team_list()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return coalesce((select jsonb_agg(x order by x->>'role', x->>'email') from (
      select jsonb_build_object('email', p.email, 'name', coalesce(p.full_name,''), 'role', p.role, 'pending', false, 'perms', to_jsonb(p.perms), 'title', coalesce(p.job_title,'')) x from public.profiles p where p.role in ('admin','staff')
      union all
      select jsonb_build_object('email', s.email, 'name', '', 'role', 'staff', 'pending', true, 'perms', '[]'::jsonb, 'title', '') from public.staff_emails s
        where lower(s.email) not in (select lower(email) from public.profiles where role in ('admin','staff'))
    ) t), '[]'::jsonb);
end $$;
