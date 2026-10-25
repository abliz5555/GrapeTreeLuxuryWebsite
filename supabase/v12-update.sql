-- GRAPE TREE v12: tax invoice (TRN + VAT), delivery charge, and "sign in to order".
-- Safe to run more than once (Supabase > SQL Editor > paste > Run).

alter table public.orders add column if not exists delivery_fee numeric not null default 0;
alter table public.orders add column if not exists vat_rate numeric not null default 0;
alter table public.orders add column if not exists vat_amount numeric not null default 0;
alter table public.orders add column if not exists total numeric;                       -- empty on orders placed before this update
alter table public.orders add column if not exists trn text not null default '';
alter table public.orders add column if not exists prices_include_vat boolean not null default false;

create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  biz jsonb; vr numeric := 5; incl boolean := false; fee numeric := 25; fr numeric := 200; ekey text; vat numeric; tot numeric; trnv text;
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
  if auth.uid() is null then raise exception 'Please sign in or create an account to place an order'; end if;
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
  -- tax and delivery come from the admin Business info page (the server decides, not the browser)
  select value into biz from public.site_content where key = 'business';
  biz := coalesce(biz, '{}'::jsonb);
  if (biz->>'vat_percent') ~ '^[0-9]+(\.[0-9]+)?$' then vr := (biz->>'vat_percent')::numeric; end if;
  incl := coalesce(biz->>'prices_include_vat', 'no') = 'yes';
  if (biz->>'delivery_fee') ~ '^[0-9]+(\.[0-9]+)?$' then fee := (biz->>'delivery_fee')::numeric; end if;
  -- each emirate can have its own price (fee_dubai, fee_abu_dhabi ...); empty means the standard charge
  ekey := 'fee_' || trim(both '_' from regexp_replace(lower(coalesce(eo, '')), '[^a-z0-9]+', '_', 'g'));
  if (biz->>ekey) ~ '^[0-9]+(\.[0-9]+)?$' then fee := (biz->>ekey)::numeric; end if;
  if coalesce(biz->>'free_delivery', 'no') = 'yes' then fee := 0; end if;
  if (biz->>'free_over') ~ '^[0-9]+(\.[0-9]+)?$' then fr := (biz->>'free_over')::numeric; end if;
  if fr > 0 and sub >= fr then fee := 0; end if;
  if incl then vat := round((sub + fee) * vr / (100 + vr), 2); tot := sub + fee;
  else vat := round((sub + fee) * vr / 100, 2); tot := sub + fee + vat; end if;
  trnv := left(coalesce(biz->>'trn', ''), 30);
  insert into public.orders (user_id, name, phone, email, emirate, address, delivery_date, notes, items, subtotal, has_quote, payment_method, source, legal, history,
                             delivery_fee, vat_rate, vat_amount, total, trn, prices_include_vat)
  values (auth.uid(), nm, ph, em, eo, ad, dd, nt, clean, sub, quoted, pm, left(coalesce(payload->>'source',''),120), lg,
          jsonb_build_array(jsonb_build_object('t', now(), 'by', 'customer', 'what', 'Order placed')),
          fee, vr, vat, tot, trnv, incl)
  returning * into new_order;
  return jsonb_build_object('order_no', new_order.order_no, 'subtotal', new_order.subtotal, 'delivery_fee', fee, 'vat_rate', vr, 'vat_amount', vat, 'total', tot, 'trn', trnv, 'prices_include_vat', incl);
end $$;
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
