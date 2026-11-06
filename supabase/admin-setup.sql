-- =====================================================================
-- MediCare Plus — ADMIN setup
-- Run ONCE in Supabase -> SQL Editor, after your existing setup.sql.
-- Then change the email in step 2 to your own and run that line.
-- =====================================================================

-- ---------- 1) PROFILES: one row per user, holds the role ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
-- No insert/update policy on purpose: nobody can promote themselves from the browser.

-- rows for users who already exist
insert into public.profiles (id) select id from auth.users on conflict do nothing;

-- automatic row for every new signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- 2) MAKE YOURSELF ADMIN (change the email!) ----------
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');

-- ---------- 3) PRODUCTS: admins can add/edit and also see inactive products ----------
-- products.id has no default, so give it one for the "Add product" form
create sequence if not exists public.products_id_seq;
select setval('public.products_id_seq', coalesce((select max(id) from public.products), 0) + 1, false);
alter table public.products alter column id set default nextval('public.products_id_seq');

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 4) ORDERS: admins can read everything ----------
drop policy if exists "Admins view all orders" on public.orders;
create policy "Admins view all orders" on public.orders
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins view all order items" on public.order_items;
create policy "Admins view all order items" on public.order_items
  for select to authenticated using (public.is_admin());

-- Status changes go through this function (not direct updates) so that
-- cancelling an order puts the stock back, exactly once.
create or replace function public.admin_set_order_status(
  p_order          uuid,
  p_status         text default null,
  p_payment_status text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old text;
  r     record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;

  select status into v_old from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_old = 'cancelled' then raise exception 'Cancelled orders cannot be changed.'; end if;

  if p_status = 'cancelled' then
    for r in select product_id, sum(qty) as q from public.order_items
             where order_id = p_order group by product_id loop
      update public.products set stock = stock + r.q where id = r.product_id;
    end loop;
  end if;

  update public.orders
     set status         = coalesce(p_status, status),
         payment_status = coalesce(p_payment_status, payment_status)
   where id = p_order;
end;
$$;
revoke all on function public.admin_set_order_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text) to authenticated;

-- ---------- 5) PRESCRIPTIONS: admins can review and open the files ----------
drop policy if exists "Admins view all prescriptions" on public.prescriptions;
create policy "Admins view all prescriptions" on public.prescriptions
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins review prescriptions" on public.prescriptions;
create policy "Admins review prescriptions" on public.prescriptions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read prescription files" on storage.objects;
create policy "Admins read prescription files" on storage.objects
  for select to authenticated
  using (bucket_id = 'prescriptions' and public.is_admin());
