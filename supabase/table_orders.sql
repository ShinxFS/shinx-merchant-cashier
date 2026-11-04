-- Tabel order dari pelanggan yang order lewat meja
-- Untuk QR meja yang aman, jalankan juga secure_table_order_qr.sql setelah script ini.
create table if not exists public.table_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  table_number integer not null,
  customer_name text not null default 'Pelanggan',
  total numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'done')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'qris')),
  items jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists table_orders_user_id_idx on public.table_orders (user_id);
create index if not exists table_orders_status_idx on public.table_orders (status);
create index if not exists table_orders_created_at_idx on public.table_orders (created_at desc);
create index if not exists table_orders_table_updated_idx on public.table_orders (user_id, table_number, updated_at desc);

alter table public.table_orders enable row level security;

alter table public.profiles
  add column if not exists cashier_sound_url text,
  add column if not exists customer_sound_url text,
  add column if not exists cashier_tone text not null default 'classic',
  add column if not exists customer_tone text not null default 'classic';

drop policy if exists "table_orders_public_insert" on public.table_orders;
drop policy if exists "table_orders_public_read" on public.table_orders;
drop policy if exists "table_orders_public_delete" on public.table_orders;
drop policy if exists "table_orders_public_update" on public.table_orders;

-- Owner bisa full access
 drop policy if exists "table_orders_owner" on public.table_orders;
create policy "table_orders_owner" on public.table_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Staff bisa lihat dan update order owner-nya
 drop policy if exists "table_orders_staff" on public.table_orders;
create policy "table_orders_staff" on public.table_orders
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'staff'
        and p.owner_id = table_orders.user_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'staff'
        and p.owner_id = table_orders.user_id
    )
  );

revoke all on public.table_orders from anon;
grant select, insert, update, delete on public.table_orders to authenticated;

-- Trigger auto-update updated_at
create or replace function public.touch_table_order_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists table_orders_updated_at on public.table_orders;
create trigger table_orders_updated_at
  before update on public.table_orders
  for each row execute function public.touch_table_order_updated_at();

-- Kurangi stok produk saat order meja dibuat oleh pelanggan atau kasir
create or replace function public.apply_table_order_stock_delta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_record jsonb;
begin
  if TG_OP = 'INSERT' then
    for item_record in
      select value
      from jsonb_array_elements(coalesce(NEW.items, '[]'::jsonb))
    loop
      update public.products
      set stock = greatest(
        stock - coalesce((item_record->>'quantity')::int, 0),
        0
      )
      where id::text = item_record->>'id'
        and user_id = NEW.user_id;
    end loop;
    return NEW;
  elsif TG_OP = 'DELETE' then
    if OLD.status = 'done' then
      return OLD;
    end if;

    for item_record in
      select value
      from jsonb_array_elements(coalesce(OLD.items, '[]'::jsonb))
    loop
      update public.products
      set stock = stock + coalesce((item_record->>'quantity')::int, 0)
      where id::text = item_record->>'id'
        and user_id = OLD.user_id;
    end loop;
    return OLD;
  end if;

  return NEW;
end;
$$;

drop trigger if exists table_orders_stock_adjustment on public.table_orders;
create trigger table_orders_stock_adjustment
  after insert or delete on public.table_orders
  for each row execute function public.apply_table_order_stock_delta();
