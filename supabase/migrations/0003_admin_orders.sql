-- Phase 7: admin orders and settings.
-- Run this once in the Supabase SQL editor (after 0001 and 0002). Safe to run again.
-- Adds two server-only functions so these changes happen all-or-nothing.

-- ---------------------------------------------------------------------------
-- cancel_order: cancel a paid order and, if asked, put its items back in stock.
-- Locks the order so two clicks cannot restock twice.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_restock boolean)
returns table (order_number text, restocked int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  o public.orders%rowtype;
  n int := 0;
  it record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if o.payment_status <> 'paid' or o.status not in ('new', 'out_for_delivery') then
    raise exception 'order cannot be cancelled' using errcode = 'P0001';
  end if;

  if p_restock then
    for it in
      select oi.variant_id, sum(oi.quantity)::int as qty
        from public.order_items oi
       where oi.order_id = o.id and oi.variant_id is not null
       group by oi.variant_id
    loop
      update public.product_variants set stock = stock + it.qty where id = it.variant_id;
      if found then
        n := n + it.qty;
      end if;
    end loop;
  end if;

  update public.orders set status = 'cancelled', needs_attention = false where id = o.id;
  return query select o.order_number, n;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_settings: shop settings + the full list of delivery zones in one go.
-- Zones with an id are updated, zones without one are added, missing ones removed.
-- (Old orders keep the zone name as text, so removing a zone never changes them.)
-- ---------------------------------------------------------------------------
create or replace function public.save_settings(p_settings jsonb, p_zones jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  z jsonb;
  i int := 0;
  keep smallint[] := '{}';
  new_id smallint;
begin
  insert into public.settings (id) values (true) on conflict (id) do nothing;
  update public.settings
     set shop_name = p_settings->>'shop_name',
         whatsapp = p_settings->>'whatsapp',
         pickup_address = nullif(p_settings->>'pickup_address', ''),
         pickup_hours = nullif(p_settings->>'pickup_hours', ''),
         cutoff_time = nullif(p_settings->>'cutoff_time', ''),
         free_delivery_threshold_ghs = (p_settings->>'free_delivery_threshold_ghs')::int,
         updated_at = now()
   where id = true;

  for z in select * from jsonb_array_elements(p_zones)
  loop
    i := i + 1;
    new_id := null;
    if z ? 'id' and z->>'id' is not null then
      update public.delivery_zones
         set name = z->>'name', fee_ghs = (z->>'fee_ghs')::int, sort = i
       where id = (z->>'id')::smallint
      returning id into new_id;
    end if;
    if new_id is null then
      insert into public.delivery_zones (name, fee_ghs, sort)
      values (z->>'name', (z->>'fee_ghs')::int, i)
      returning id into new_id;
    end if;
    keep := keep || new_id;
  end loop;

  delete from public.delivery_zones where not (id = any (keep));
end;
$$;

revoke execute on function public.cancel_order(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.save_settings(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.cancel_order(uuid, boolean) to service_role;
grant execute on function public.save_settings(jsonb, jsonb) to service_role;
