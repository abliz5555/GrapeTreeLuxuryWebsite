-- GRAPE TREE v11. Safe to run more than once (Supabase > SQL Editor > paste > Run).
-- Only an ADMIN can delete orders (staff cannot).
drop policy if exists "orders: admin deletes" on public.orders;
create policy "orders: admin deletes" on public.orders for delete using (public.is_admin());
