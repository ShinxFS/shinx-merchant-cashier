-- ============================================================
-- SHINX MERCHANT CASHIER — Full Database Setup
-- Jalankan di: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- =============================================
-- 1. TABEL: profiles
-- =============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  owner_name text,
  phone text,
  address text,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  owner_id uuid references public.profiles(id) on delete cascade,
  qris_image_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_user_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when p.role = 'staff' then p.owner_id else p.id end
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.current_user_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  );
$$;

-- Owner bisa CRUD semua data sendiri
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Staff bisa lihat profil owner-nya
drop policy if exists "profiles_staff_select_owner" on public.profiles;
create policy "profiles_staff_select_owner" on public.profiles
  for select using (id = public.current_user_owner_id());

-- Owner bisa insert staff profile (via RPC/manual)
drop policy if exists "profiles_owner_insert_staff" on public.profiles;
create policy "profiles_owner_insert_staff" on public.profiles
  for insert with check (public.current_user_is_owner());

-- Trigger: auto-create profile saat signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, business_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', ''),
    'owner'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- 2. TABEL: categories
-- =============================================
create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists payment_accounts_user_id_idx on public.payment_accounts (user_id);

alter table public.payment_accounts enable row level security;

drop policy if exists "payment_accounts_own" on public.payment_accounts;
create policy "payment_accounts_own" on public.payment_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "payment_accounts_staff_read" on public.payment_accounts;
create policy "payment_accounts_staff_read" on public.payment_accounts
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'staff'
        and p.owner_id = payment_accounts.user_id
    )
  );

-- =============================================
-- 2.1 TABEL: categories
-- =============================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1'
);

alter table public.categories enable row level security;

drop policy if exists "categories_own" on public.categories;
create policy "categories_own" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- 3. TABEL: products
-- =============================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  sku text,
  price numeric not null default 0,
  cost_price numeric not null default 0,
  stock integer not null default 0,
  unit text not null default 'pcs',
  image_url text,
  is_active boolean not null default true,
  category_id uuid references public.categories(id) on delete set null,
  category_id_2 uuid references public.categories(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists products_user_id_idx on public.products (user_id);
create index if not exists products_sku_idx on public.products (sku);

alter table public.products enable row level security;

drop policy if exists "products_own" on public.products;
create policy "products_own" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- 3.1 TABEL: notification_logs
-- =============================================
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('product_added', 'low_stock', 'business_name_changed')),
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_logs_user_created_idx
  on public.notification_logs (user_id, created_at desc);

alter table public.notification_logs enable row level security;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notification_logs'
    ) then
    alter publication supabase_realtime add table public.notification_logs;
  end if;
end
$$;

drop policy if exists "notification_logs_shop_read" on public.notification_logs;
create policy "notification_logs_shop_read" on public.notification_logs
  for select using (user_id = public.current_user_owner_id());

create or replace function public.log_product_added_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_logs (user_id, event_type, title, message, metadata)
  values (
    new.user_id,
    'product_added',
    'Produk baru ditambahkan',
    format('%s ditambahkan ke daftar produk.', new.name),
    jsonb_build_object('product_id', new.id, 'product_name', new.name)
  );
  return new;
end;
$$;

drop trigger if exists products_log_added_notification on public.products;
create trigger products_log_added_notification
  after insert on public.products
  for each row execute function public.log_product_added_notification();

create or replace function public.log_low_stock_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock <= 5 and (tg_op = 'INSERT' or old.stock > 5) then
    insert into public.notification_logs (user_id, event_type, title, message, metadata)
    values (
      new.user_id,
      'low_stock',
      'Stok produk menipis',
      format('Stok %s tersisa %s %s.', new.name, new.stock, new.unit),
      jsonb_build_object('product_id', new.id, 'product_name', new.name, 'stock', new.stock, 'unit', new.unit)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists products_log_low_stock_insert on public.products;
create trigger products_log_low_stock_insert
  after insert on public.products
  for each row execute function public.log_low_stock_notification();

drop trigger if exists products_log_low_stock_update on public.products;
create trigger products_log_low_stock_update
  after update of stock on public.products
  for each row execute function public.log_low_stock_notification();

create or replace function public.log_business_name_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner' and old.business_name is distinct from new.business_name then
    insert into public.notification_logs (user_id, event_type, title, message, metadata)
    values (
      new.id,
      'business_name_changed',
      'Nama toko diubah',
      format('Nama toko diubah dari "%s" menjadi "%s".', old.business_name, new.business_name),
      jsonb_build_object('previous_name', old.business_name, 'new_name', new.business_name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_log_business_name_notification on public.profiles;
create trigger profiles_log_business_name_notification
  after update of business_name on public.profiles
  for each row execute function public.log_business_name_notification();

-- =============================================
-- 4. TABEL: transactions
-- =============================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references auth.users(id),
  invoice_number text not null,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'transfer', 'qris')),
  payment_account text,
  amount_paid numeric not null default 0,
  change_amount numeric not null default 0,
  table_number integer,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);

alter table public.transactions enable row level security;

drop policy if exists "transactions_own" on public.transactions;
create policy "transactions_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Staff: bisa baca & insert transaksi yang dimiliki owner-nya
drop policy if exists "transactions_staff_read" on public.transactions;
create policy "transactions_staff_read" on public.transactions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.owner_id = transactions.user_id)
  );

drop policy if exists "transactions_staff_insert" on public.transactions;
create policy "transactions_staff_insert" on public.transactions
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.owner_id = transactions.user_id)
  );

-- =============================================
-- 5. TABEL: transaction_items
-- =============================================
create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  cost_price numeric not null default 0,
  subtotal numeric not null default 0
);

create index if not exists transaction_items_transaction_idx on public.transaction_items (transaction_id);

alter table public.transaction_items enable row level security;

-- transaction_items diakses lewat transaksi owner
drop policy if exists "transaction_items_own" on public.transaction_items;
create policy "transaction_items_own" on public.transaction_items
  for all using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_items.transaction_id and t.user_id = auth.uid()
    )
  );

-- Staff bisa akses items dari transaksi owner-nya
drop policy if exists "transaction_items_staff" on public.transaction_items;
create policy "transaction_items_staff" on public.transaction_items
  for select using (
    exists (
      select 1 from public.transactions t
      join public.profiles p on p.id = auth.uid()
      where t.id = transaction_items.transaction_id
        and p.role = 'staff'
        and p.owner_id = t.user_id
    )
  );

-- =============================================
-- 6. TABEL: expenses
-- =============================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric not null default 0,
  category text not null default 'lainnya' check (category in ('stok', 'gaji', 'operasional', 'lainnya')),
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_date_idx on public.expenses (date desc);

alter table public.expenses enable row level security;

drop policy if exists "expenses_own" on public.expenses;
create policy "expenses_own" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Staff: bisa baca & insert expenses untuk owner-nya
drop policy if exists "expenses_staff_read" on public.expenses;
create policy "expenses_staff_read" on public.expenses
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.owner_id = expenses.user_id)
  );

drop policy if exists "expenses_staff_insert" on public.expenses;
create policy "expenses_staff_insert" on public.expenses
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.owner_id = expenses.user_id)
  );

-- =============================================
-- 7. TABEL: hpp_products (kalkulator HPP)
-- =============================================
create table if not exists public.hpp_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_type text not null check (business_type in ('manufaktur', 'retail', 'jasa')),
  product_name text not null,
  product_code text,
  category text,
  units numeric not null default 1,
  inputs jsonb not null default '{}',
  total_cost numeric not null default 0,
  hpp_per_unit numeric not null default 0,
  break_even_point numeric not null default 0,
  target_margin numeric not null default 20,
  min_price numeric not null default 0,
  recommended_price numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hpp_products_user_id_idx on public.hpp_products (user_id);

alter table public.hpp_products enable row level security;

drop policy if exists "hpp_products_own" on public.hpp_products;
create policy "hpp_products_own" on public.hpp_products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- 8. STORAGE BUCKET: product-images
-- =============================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- RLS untuk storage
drop policy if exists "Product images public read" on storage.objects;
create policy "Product images public read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Product images upload own" on storage.objects;
create policy "Product images upload own" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Product images delete own" on storage.objects;
create policy "Product images delete own" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================
-- 9. TRIGGER: stok otomatis untuk order meja
-- =============================================
create or replace function public.apply_table_order_stock_delta()
returns trigger
language plpgsql
security definer
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

-- =============================================
-- DONE! Semua tabel, RLS, trigger, dan storage siap.
-- =============================================
