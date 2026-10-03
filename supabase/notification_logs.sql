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

drop policy if exists "profiles_staff_select_owner" on public.profiles;
create policy "profiles_staff_select_owner" on public.profiles
  for select using (id = public.current_user_owner_id());

drop policy if exists "profiles_owner_insert_staff" on public.profiles;
create policy "profiles_owner_insert_staff" on public.profiles
  for insert with check (public.current_user_is_owner());

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