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
