-- GRAPE TREE v9 additions. Safe to run more than once (Supabase > SQL Editor > paste > Run).
-- Adds: legal acceptance record, design review status, order history log, and the updated place_order function.

alter table public.orders add column if not exists legal jsonb not null default '{}'::jsonb;        -- what the customer accepted (version, time, IP)
alter table public.orders add column if not exists art_review text not null default 'pending';      -- pending | approved | changes | rejected
alter table public.orders add column if not exists art_review_note text not null default '';
alter table public.orders add column if not exists history jsonb not null default '[]'::jsonb;      -- who changed what and when
alter table public.orders add column if not exists tags text not null default '';

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
  lg jsonb := '{}'::jsonb; hdr json;
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
                 'look', left(coalesce(it->'art'->>'look',''),20),
                 'legal', case when jsonb_typeof(it->'art'->'legal') = 'object' then it->'art'->'legal' else null end) else null end));
    end if;
    sub := sub + line_total;
  end loop;
  -- record what the customer agreed to: version, time, and where it came from (proof if a dispute ever happens)
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := '{}'::json; end;
  if jsonb_typeof(payload->'legal') = 'object' then
    lg := jsonb_build_object('version', payload->'legal'->'version', 'accepted', coalesce((payload->'legal'->>'accepted')::boolean, false),
            'statements', case when jsonb_typeof(payload->'legal'->'statements') = 'array' then payload->'legal'->'statements' else '[]'::jsonb end,
            'client_time', left(coalesce(payload->'legal'->>'client_time',''), 40));
  end if;
  if not coalesce((lg->>'accepted')::boolean, false) then raise exception 'Please accept the terms and the content and copyright policy to place an order'; end if;
  lg := lg || jsonb_build_object('server_time', now(), 'ip', left(coalesce(hdr->>'x-forwarded-for', hdr->>'cf-connecting-ip', ''), 80), 'user_agent', left(coalesce(hdr->>'user-agent',''), 240));
  insert into public.orders (user_id, name, phone, email, emirate, address, delivery_date, notes, items, subtotal, has_quote, payment_method, source, legal, history)
  values (auth.uid(), nm, ph, em, eo, ad, dd, nt, clean, sub, quoted, pm, left(coalesce(payload->>'source',''),120), lg,
          jsonb_build_array(jsonb_build_object('t', now(), 'by', 'customer', 'what', 'Order placed')))
  returning * into new_order;
  return jsonb_build_object('order_no', new_order.order_no, 'subtotal', new_order.subtotal);
end $$;
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
