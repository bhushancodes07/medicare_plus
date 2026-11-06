-- =====================================================================
-- MediCare Plus — database setup
-- Run ONCE in Supabase → SQL Editor → New query → paste all → Run.
-- Then run seed.sql to load the demo products.
-- =====================================================================

-- ---------- PRODUCTS (public read-only) ----------
create table if not exists public.products (
  id            int primary key,
  name          text not null,
  brand         text not null default '',
  cat           text not null,
  price         numeric(10,2) not null check (price >= 0),
  mrp           numeric(10,2) not null check (mrp >= 0),
  rating        numeric(2,1)  not null default 0,
  reviews       int           not null default 0,
  emoji         text          not null default '💊',
  image         text          not null default '',
  description   text          not null default '',
  stock         int           not null default 0 check (stock >= 0),
  prescription  boolean       not null default false,
  tags          text[]        not null default '{}',
  popular       int           not null default 0,
  active        boolean       not null default true,
  created_at    timestamptz   not null default now()
);
alter table public.products enable row level security;
drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products" on public.products
  for select using (active);

-- ---------- SAVED ADDRESSES (private to each user) ----------
create table if not exists public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label      text not null default 'Home',
  full_name  text not null,
  phone      text not null,
  line1      text not null,
  line2      text not null default '',
  city       text not null,
  state      text not null,
  pincode    text not null,
  created_at timestamptz not null default now()
);
alter table public.addresses enable row level security;
drop policy if exists "Users manage own addresses" on public.addresses;
create policy "Users manage own addresses" on public.addresses
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- PRESCRIPTIONS (files live in the private 'prescriptions' bucket) ----------
create table if not exists public.prescriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_path  text not null,
  file_name  text not null default '',
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.prescriptions enable row level security;
drop policy if exists "Users view own prescriptions" on public.prescriptions;
create policy "Users view own prescriptions" on public.prescriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users add own prescriptions" on public.prescriptions;
create policy "Users add own prescriptions" on public.prescriptions
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');

-- ---------- ORDERS + ORDER ITEMS (read-only for users; created only by place_order()) ----------
create sequence if not exists public.order_seq start 1001;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_no        text not null unique,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'placed'
                  check (status in ('placed','confirmed','packed','shipped','delivered','cancelled')),
  payment_method  text not null check (payment_method in ('upi','card','netbanking','cod')),
  payment_status  text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  subtotal        numeric(10,2) not null,
  delivery_fee    numeric(10,2) not null,
  gst             numeric(10,2) not null,
  cod_fee         numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  address         jsonb not null,
  prescription_id uuid references public.prescriptions(id),
  created_at      timestamptz not null default now()
);
alter table public.orders enable row level security;
drop policy if exists "Users view own orders" on public.orders;
create policy "Users view own orders" on public.orders
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.order_items (
  id         bigserial primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id int  not null,
  name       text not null,
  emoji      text not null default '',
  image      text not null default '',
  price      numeric(10,2) not null,
  qty        int  not null check (qty > 0)
);
alter table public.order_items enable row level security;
drop policy if exists "Users view own order items" on public.order_items;
create policy "Users view own order items" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- ---------- place_order(): prices & totals are calculated HERE, never trusted from the browser ----------
create or replace function public.place_order(
  p_items        jsonb,
  p_address      jsonb,
  p_payment      text,
  p_prescription uuid default null
)
returns table (out_order_id uuid, out_order_no text, out_total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_item     jsonb;
  v_prod     public.products%rowtype;
  v_qty      int;
  v_sub      numeric := 0;
  v_delivery numeric := 0;
  v_gst      numeric := 0;
  v_cod      numeric := 0;
  v_total    numeric;
  v_needs_rx boolean := false;
  v_oid      uuid;
  v_no       text;
begin
  if v_uid is null then raise exception 'Please log in to place an order.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if p_payment is null or p_payment not in ('upi','card','netbanking','cod') then
    raise exception 'Please choose a valid payment method.';
  end if;
  if coalesce(trim(p_address->>'full_name'),'') = '' or coalesce(trim(p_address->>'phone'),'') = ''
     or coalesce(trim(p_address->>'line1'),'') = '' or coalesce(trim(p_address->>'city'),'') = ''
     or coalesce(trim(p_address->>'state'),'') = '' or coalesce(trim(p_address->>'pincode'),'') = '' then
    raise exception 'Please complete the delivery address.';
  end if;

  -- 1) validate every item and add up the subtotal using DATABASE prices
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'Invalid quantity.'; end if;
    select * into v_prod from public.products where id = (v_item->>'id')::int and active;
    if not found then raise exception 'A product in your cart is no longer available.'; end if;
    if v_prod.stock < v_qty then raise exception '% does not have enough stock.', v_prod.name; end if;
    v_sub := v_sub + v_prod.price * v_qty;
    if v_prod.prescription then v_needs_rx := true; end if;
  end loop;

  -- 2) prescription medicines need one of THIS user's uploaded prescriptions
  if v_needs_rx then
    if p_prescription is null or not exists (
         select 1 from public.prescriptions
         where id = p_prescription and user_id = v_uid and status <> 'rejected') then
      raise exception 'A valid prescription is required for prescription medicines.';
    end if;
  end if;

  -- 3) totals (same rules as the website: free delivery from 499, 5% GST, COD fee 20)
  if v_sub < 499 then v_delivery := 49; end if;
  v_gst := round(v_sub * 0.05);
  if p_payment = 'cod' then v_cod := 20; end if;
  v_total := v_sub + v_delivery + v_gst + v_cod;

  v_no := 'MPC' || to_char(now(), 'YYMMDD') || lpad(nextval('public.order_seq')::text, 4, '0');

  insert into public.orders (order_no, user_id, payment_method, subtotal, delivery_fee, gst, cod_fee, total, address, prescription_id)
  values (v_no, v_uid, p_payment, v_sub, v_delivery, v_gst, v_cod, v_total, p_address, p_prescription)
  returning id into v_oid;

  -- 4) save the items and reduce stock
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    select * into v_prod from public.products where id = (v_item->>'id')::int;
    insert into public.order_items (order_id, product_id, name, emoji, image, price, qty)
    values (v_oid, v_prod.id, v_prod.name, v_prod.emoji, v_prod.image, v_prod.price, v_qty);
    update public.products set stock = stock - v_qty where id = v_prod.id;
  end loop;

  return query select v_oid, v_no, v_total;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb, text, uuid) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, text, uuid) to authenticated;

-- ---------- PRIVATE STORAGE BUCKET FOR PRESCRIPTIONS ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prescriptions', 'prescriptions', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- each user can only touch files inside their own folder  (<user-id>/filename)
drop policy if exists "Users upload own prescription files" on storage.objects;
create policy "Users upload own prescription files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users read own prescription files" on storage.objects;
create policy "Users read own prescription files" on storage.objects
  for select to authenticated
  using (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = auth.uid()::text);
