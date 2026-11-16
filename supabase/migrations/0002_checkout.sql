-- Sika Beauty: checkout and Paystack payments (phase 6).
-- Safe to run more than once. Run it in the Supabase SQL editor after 0001_init.sql.

-- Each payment try gets its own Paystack reference (Paystack never accepts a reference twice).
-- "Try again" on a failed order adds a new attempt for the SAME order, and a late payment on an
-- older attempt still finds its order.
alter table public.orders add column if not exists payment_started_at timestamptz not null default now();

create table if not exists public.payment_attempts (
  reference   text primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists payment_attempts_order_idx on public.payment_attempts (order_id);

-- Orders were already locked down in 0001. Same here: RLS on, no policies, server only.
alter table public.payment_attempts enable row level security;

-- Every existing order's current reference counts as an attempt.
insert into public.payment_attempts (reference, order_id, created_at)
select paystack_reference, id, created_at from public.orders
on conflict (reference) do nothing;

-- ---------------------------------------------------------------------------
-- create_pending_order: order + items + first attempt, all or nothing.
-- p_order: { customer_name, phone, email, fulfilment, delivery_zone, delivery_fee_ghs, area,
--            gps_address, notes, gift_message, subtotal_ghs, total_ghs }
-- p_items: [{ variant_id, product_name, size_label, unit_price_ghs, quantity }]
-- Prices are computed by the server (never the browser) before this is called.
-- ---------------------------------------------------------------------------
create or replace function public.create_pending_order(p_order jsonb, p_items jsonb, p_reference text)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  o public.orders%rowtype;
begin
  insert into public.orders (
    customer_name, phone, email, fulfilment, delivery_zone, delivery_fee_ghs, area, gps_address,
    notes, gift_message, subtotal_ghs, total_ghs, paystack_reference, payment_status, payment_started_at
  ) values (
    p_order->>'customer_name', p_order->>'phone', p_order->>'email', p_order->>'fulfilment',
    p_order->>'delivery_zone', (p_order->>'delivery_fee_ghs')::int, p_order->>'area',
    p_order->>'gps_address', p_order->>'notes', p_order->>'gift_message',
    (p_order->>'subtotal_ghs')::int, (p_order->>'total_ghs')::int, p_reference, 'pending', now()
  )
  returning * into o;

  insert into public.order_items (order_id, variant_id, product_name, size_label, unit_price_ghs, quantity)
  select o.id, (i->>'variant_id')::uuid, i->>'product_name', i->>'size_label',
         (i->>'unit_price_ghs')::int, (i->>'quantity')::int
  from jsonb_array_elements(p_items) as i;

  insert into public.payment_attempts (reference, order_id) values (p_reference, o.id);

  return query select o.id, o.order_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- new_payment_attempt: "Try again" on a pending or failed order.
-- ---------------------------------------------------------------------------
create or replace function public.new_payment_attempt(p_order_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
     set paystack_reference = p_reference, payment_status = 'pending', payment_started_at = now()
   where id = p_order_id and payment_status <> 'paid';
  if not found then
    raise exception 'order % cannot be retried', p_order_id;
  end if;
  insert into public.payment_attempts (reference, order_id) values (p_reference, p_order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_order_paid: called by both verify and the webhook, so it must be IDEMPOTENT.
-- One transaction: lock the order, decrement stock (never below 0), mark paid.
-- If stock ran out between checkout and payment the order is still paid, but flagged
-- needs_attention so the owner can contact the customer.
-- A failed (expired) order can still become paid: the customer's money was taken.
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_paid(p_reference text)
returns table (order_id uuid, order_number text, already_paid boolean, needs_attention boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  o public.orders%rowtype;
  it record;
  have int;
  short boolean := false;
begin
  select ord.* into o
    from public.payment_attempts a
    join public.orders ord on ord.id = a.order_id
   where a.reference = p_reference
   for update of ord;
  if not found then
    raise exception 'no order for reference %', p_reference;
  end if;

  if o.payment_status = 'paid' then
    return query select o.id, o.order_number, true, o.needs_attention;
    return;
  end if;

  for it in
    select oi.variant_id, sum(oi.quantity)::int as qty
      from public.order_items oi
     where oi.order_id = o.id
     group by oi.variant_id
  loop
    if it.variant_id is null then
      short := true; -- the product was deleted after the order was placed
      continue;
    end if;
    select v.stock into have from public.product_variants v where v.id = it.variant_id for update;
    if not found or have < it.qty then
      short := true;
    end if;
    update public.product_variants set stock = greatest(stock - it.qty, 0) where id = it.variant_id;
  end loop;

  update public.orders
     set payment_status = 'paid',
         paid_at = now(),
         status = 'new',
         paystack_reference = p_reference,
         needs_attention = public.orders.needs_attention or short
   where id = o.id;

  return query select o.id, o.order_number, false, (o.needs_attention or short);
end;
$$;

-- ---------------------------------------------------------------------------
-- expire_pending_orders: pending for more than 30 minutes -> failed. Returns how many.
-- The server runs this every few minutes. A late Paystack success still marks it paid.
-- ---------------------------------------------------------------------------
create or replace function public.expire_pending_orders()
returns int
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.orders
       set payment_status = 'failed'
     where payment_status = 'pending'
       and payment_started_at < now() - interval '30 minutes'
    returning 1
  )
  select count(*)::int from expired;
$$;

-- Only the server (service role) may call these.
revoke execute on function public.create_pending_order(jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.new_payment_attempt(uuid, text) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(text) from public, anon, authenticated;
revoke execute on function public.expire_pending_orders() from public, anon, authenticated;
grant execute on function public.create_pending_order(jsonb, jsonb, text) to service_role;
grant execute on function public.new_payment_attempt(uuid, text) to service_role;
grant execute on function public.mark_order_paid(text) to service_role;
grant execute on function public.expire_pending_orders() to service_role;
