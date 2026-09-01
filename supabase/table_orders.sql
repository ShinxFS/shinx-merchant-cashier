-- Tabel order dari pelanggan yang order lewat meja
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

alter table public.table_orders enable row level security;

-- Public insert dari QR meja pelanggan
create policy "table_orders_public_insert" on public.table_orders
  for insert with check (user_id is not null);

alter table public.profiles
  add column if not exists cashier_sound_url text,
  add column if not exists customer_sound_url text,
  add column if not exists cashier_tone text not null default 'classic',
  add column if not exists customer_tone text not null default 'classic';

-- Public read untuk QR meja pelanggan agar status tetap tampil setelah refresh
create policy "table_orders_public_read" on public.table_orders
  for select using (true);

-- Customer QR boleh membatalkan pesanan miliknya saat belum selesai
create policy "table_orders_public_delete" on public.table_orders
  for delete using (true);

create policy "table_orders_public_update" on public.table_orders
  for update using (true) with check (user_id is not null);

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

-- Trigger auto-update updated_at
create or replace function public.touch_table_order_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists table_orders_updated_at on public.table_orders;
create trigger table_orders_updated_at
  before update on public.table_orders
  for each row execute function public.touch_table_order_updated_at();
