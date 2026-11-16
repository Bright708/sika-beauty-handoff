-- =====================================================================
-- Sika Beauty: initial schema, security and seed data
-- Run this whole file once in Supabase > SQL Editor > New query > Run.
-- It is safe to run again: it skips anything that already exists.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.categories (
  id    smallserial primary key,
  name  text not null unique,
  slug  text not null unique,
  sort  int  not null default 0
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 120),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id  smallint not null references public.categories(id),
  brand        text,
  description  text,
  notes_top    text,
  notes_heart  text,
  notes_base   text,
  status       text not null default 'draft' check (status in ('live', 'draft')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists products_status_created_idx on public.products (status, created_at desc);
create index if not exists products_category_idx on public.products (category_id);

create table if not exists public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  size_label      text not null check (char_length(size_label) between 1 and 40),
  price_ghs       int  not null check (price_ghs > 0),
  sale_price_ghs  int  check (sale_price_ghs is null or (sale_price_ghs > 0 and sale_price_ghs < price_ghs)),
  stock           int  not null default 0 check (stock >= 0),
  sku             text unique,
  sort            int  not null default 0
);
create index if not exists product_variants_product_idx on public.product_variants (product_id, sort);

create table if not exists public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  storage_path  text not null, -- base path; files are <storage_path>-480.webp, -960.webp, -1440.webp
  sort          int  not null default 0, -- 0 = cover
  created_at    timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, sort);

-- Human-friendly order numbers: SB-1001, SB-1002, ...
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null unique default ('SB-' || nextval('public.order_number_seq')),
  customer_name       text not null,
  phone               text not null,
  email               text not null,
  fulfilment          text not null check (fulfilment in ('delivery', 'pickup')),
  delivery_zone       text,
  delivery_fee_ghs    int  not null default 0 check (delivery_fee_ghs >= 0),
  area                text,
  gps_address         text,
  notes               text,
  gift_message        text check (gift_message is null or char_length(gift_message) <= 200),
  subtotal_ghs        int  not null check (subtotal_ghs >= 0),
  total_ghs           int  not null check (total_ghs >= 0),
  payment_status      text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  status              text not null default 'new' check (status in ('new', 'out_for_delivery', 'delivered', 'cancelled')),
  needs_attention     boolean not null default false, -- set when stock ran out between checkout and payment
  paystack_reference  text not null unique,
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (payment_status, status);

create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  variant_id      uuid references public.product_variants(id) on delete set null,
  -- Copied at the time of the order so later product edits don't change old orders
  product_name    text not null,
  size_label      text not null,
  unit_price_ghs  int  not null check (unit_price_ghs >= 0),
  quantity        int  not null check (quantity > 0)
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_variant_idx on public.order_items (variant_id);

-- Single-row settings table (id is always true)
create table if not exists public.settings (
  id                           boolean primary key default true check (id),
  shop_name                    text not null default 'Sika Beauty',
  whatsapp                     text not null default '233240000000',
  pickup_address               text,
  pickup_hours                 text,
  cutoff_time                  text,
  free_delivery_threshold_ghs  int check (free_delivery_threshold_ghs is null or free_delivery_threshold_ghs > 0),
  updated_at                   timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id       smallserial primary key,
  name     text not null,
  fee_ghs  int  not null check (fee_ghs >= 0),
  sort     int  not null default 0
);

-- Only users listed here can use the admin
create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- The browser (anon key) may only READ the public catalogue and settings.
-- Every write, and every read of orders/admins, goes through the Express API
-- with the service role key, which bypasses RLS.
-- ---------------------------------------------------------------------

alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.product_images    enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.settings          enable row level security;
alter table public.delivery_zones    enable row level security;
alter table public.admins            enable row level security;

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "Public can read live products" on public.products;
create policy "Public can read live products" on public.products
  for select to anon, authenticated using (status = 'live');

drop policy if exists "Public can read variants of live products" on public.product_variants;
create policy "Public can read variants of live products" on public.product_variants
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'live'));

drop policy if exists "Public can read images of live products" on public.product_images;
create policy "Public can read images of live products" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'live'));

drop policy if exists "Public can read settings" on public.settings;
create policy "Public can read settings" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "Public can read delivery zones" on public.delivery_zones;
create policy "Public can read delivery zones" on public.delivery_zones
  for select to anon, authenticated using (true);

-- orders, order_items, admins: RLS on and NO policies = nobody can read or write
-- them from the browser.

-- ---------------------------------------------------------------------
-- Best sellers (server only): quantity sold per product in paid orders
-- ---------------------------------------------------------------------

create or replace function public.best_seller_ids(max_count int default 50)
returns table (product_id uuid, qty_sold bigint)
language sql stable security definer set search_path = public as $$
  select v.product_id, sum(oi.quantity)::bigint as qty_sold
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.product_variants v on v.id = oi.variant_id
  where o.payment_status = 'paid' and o.status <> 'cancelled'
  group by v.product_id
  order by qty_sold desc
  limit max_count
$$;
revoke execute on function public.best_seller_ids(int) from public, anon, authenticated;
grant execute on function public.best_seller_ids(int) to service_role;

-- ---------------------------------------------------------------------
-- Storage: public bucket for product photos.
-- No upload policies: uploads only happen through signed upload URLs
-- created by the server.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------

insert into public.categories (name, slug, sort) values
  ('Perfume',     'perfume',     1),
  ('Body cream',  'body-cream',  2),
  ('Body butter', 'body-butter', 3),
  ('Body oil',    'body-oil',    4),
  ('Body mist',   'body-mist',   5),
  ('Gift set',    'gift-set',    6)
on conflict (slug) do nothing;

insert into public.settings (id, shop_name, whatsapp, pickup_address, pickup_hours, cutoff_time)
values (true, 'Sika Beauty', '233240000000', '[Pickup address], Accra', 'Mon to Sat, 10am to 6pm', '[CUT-OFF TIME]')
on conflict (id) do nothing;

-- Placeholder fees: change them in admin Settings
insert into public.delivery_zones (name, fee_ghs, sort)
select * from (values
  ('Accra Central',                     30, 1),
  ('East Legon, Airport, Cantonments',  40, 2),
  ('Spintex, Tema',                     50, 3),
  ('Kasoa, Madina, Adenta',             60, 4)
) z(name, fee_ghs, sort)
where not exists (select 1 from public.delivery_zones);

-- Products from the mockups. Seeded as LIVE so the shop isn't empty in development;
-- hide or delete them from the admin before launch.
with seed (slug, name, cat, description, n_top, n_heart, n_base, age_days) as (values
  ('oud-noir',         'Oud Noir',         'perfume',     'Smoky oud and saffron over warm amber. Strong, close and made for evenings out.', 'bergamot, saffron', 'rose, oud', 'amber, vanilla, musk', 1),
  ('shea-and-vanilla', 'Shea and Vanilla', 'body-butter', 'Whipped shea butter with soft vanilla. Melts in and keeps skin soft all day.', null, null, null, 2),
  ('velvet-rose',      'Velvet Rose',      'perfume',     'Fresh red rose with a creamy musk base. Easy to wear from morning to night.', 'pink pepper, lychee', 'rose, peony', 'white musk, cedar', 3),
  ('cocoa-glow',       'Cocoa Glow',       'body-oil',    'Light cocoa body oil with a soft golden sheen. Absorbs fast, no sticky feel.', null, null, null, 4),
  ('amber-musk',       'Amber Musk',       'body-mist',   'Warm amber and clean musk in a light mist. Spray on after your shower.', null, null, null, 5),
  ('night-jasmine',    'Night Jasmine',    'perfume',     'Night-blooming jasmine and tuberose over sandalwood. Rich and long-lasting.', 'mandarin, neroli', 'jasmine, tuberose', 'sandalwood, vanilla', 6),
  ('coconut-milk',     'Coconut Milk',     'body-cream',  'Everyday body lotion with coconut milk and shea. Light enough for Accra heat.', null, null, null, 7),
  ('citrus-bloom',     'Citrus Bloom',     'perfume',     'Bright orange blossom and grapefruit. A fresh daytime scent that lifts the mood.', 'grapefruit, bergamot', 'orange blossom, neroli', 'musk, vetiver', 8)
),
inserted as (
  insert into public.products (slug, name, category_id, description, notes_top, notes_heart, notes_base, status, created_at)
  select s.slug, s.name, c.id, s.description, s.n_top, s.n_heart, s.n_base, 'live', now() - make_interval(days => s.age_days)
  from seed s join public.categories c on c.slug = s.cat
  on conflict (slug) do nothing
  returning id, slug
)
insert into public.product_variants (product_id, size_label, price_ghs, sale_price_ghs, stock, sort)
select i.id, v.size_label, v.price, v.sale, v.stock, v.sort
from inserted i
join (values
  ('oud-noir',         '50ml',  520,  null::int, 8,  0),
  ('oud-noir',         '100ml', 1050, 850,       2,  1),
  ('shea-and-vanilla', '250ml', 180,  null,      14, 0),
  ('velvet-rose',      '50ml',  620,  null,      6,  0),
  ('cocoa-glow',       '100ml', 260,  220,       9,  0),
  ('amber-musk',       '200ml', 150,  null,      20, 0),
  ('night-jasmine',    '100ml', 700,  null,      0,  0),
  ('coconut-milk',     '400ml', 140,  null,      25, 0),
  ('citrus-bloom',     '50ml',  560,  480,       5,  0)
) v(slug, size_label, price, sale, stock, sort) on v.slug = i.slug;

-- ---------------------------------------------------------------------
-- Make yourself (or the owner) an admin:
--   1. Supabase > Authentication > Users > Add user (email + password)
--   2. Run, with that email:
--      insert into public.admins (user_id)
--      select id from auth.users where email = 'owner@example.com';
-- ---------------------------------------------------------------------
