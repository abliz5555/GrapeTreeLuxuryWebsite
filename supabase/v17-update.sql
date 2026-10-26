-- v17: tracking page shows the same totals (items, delivery, VAT, total) as the invoice and email
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
    'delivery_date', o.delivery_date, 'first_name', split_part(o.name, ' ', 1), 'emirate', o.emirate, 'subtotal', o.subtotal, 'has_quote', o.has_quote, 'total', o.total, 'delivery_fee', o.delivery_fee, 'vat_rate', o.vat_rate, 'vat_amount', o.vat_amount, 'prices_include_vat', o.prices_include_vat,
    'quote_open', exists (select 1 from jsonb_array_elements(o.items) q where coalesce((q->>'quote')::boolean,false) and coalesce((q->>'total')::numeric,0) <= 0),
    'art_review', o.art_review, 'art_review_note', case when o.art_review in ('changes','rejected') then o.art_review_note else '' end,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i->>'name', 'qty', i->>'qty')), '[]'::jsonb) from jsonb_array_elements(o.items) i),
    'timeline', pub);
end $$;
revoke all on function public.track_order(bigint, text) from public;
grant execute on function public.track_order(bigint, text) to anon, authenticated;
