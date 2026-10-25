-- ===============================================================
-- GRAPE TREE v15: ONE DEVICE PER ACCOUNT  (safe to run more than once)
-- When someone signs in on a new device, the older device is signed out.
-- Run it in Supabase: SQL Editor -> New query -> paste -> Run.
-- ===============================================================
alter table public.profiles add column if not exists session_key text;

create or replace function public.claim_session(p_key text)
returns void language sql security definer set search_path = public as $$
  update public.profiles set session_key = p_key where id = auth.uid();
$$;

create or replace function public.session_ok(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select session_key is null or session_key = p_key from public.profiles where id = auth.uid()), true);
$$;

grant execute on function public.claim_session(text) to authenticated;
grant execute on function public.session_ok(text) to authenticated;
