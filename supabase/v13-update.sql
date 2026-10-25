-- ===============================================================
-- GRAPE TREE v13: CANCEL ORDER WITH A REASON  (safe to run more than once)
-- Adds two columns to remember why and when an order was cancelled.
-- Run it in Supabase: SQL Editor -> New query -> paste -> Run.
-- ===============================================================
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists cancelled_at timestamptz;
