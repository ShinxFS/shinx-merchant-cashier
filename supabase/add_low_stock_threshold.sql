-- Jalankan di Supabase Dashboard > SQL Editor untuk database yang sudah ada.
alter table public.profiles
  add column if not exists low_stock_threshold integer not null default 5;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_low_stock_threshold_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_low_stock_threshold_check
      check (low_stock_threshold >= 1);
  end if;
end
$$;

create or replace function public.log_low_stock_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold integer;
begin
  select low_stock_threshold into threshold
  from public.profiles
  where id = new.user_id;
  threshold := coalesce(threshold, 5);

  if new.stock <= threshold and (tg_op = 'INSERT' or old.stock > threshold) then
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

create or replace function public.log_low_stock_notifications_for_threshold_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.low_stock_threshold > old.low_stock_threshold then
    insert into public.notification_logs (user_id, event_type, title, message, metadata)
    select
      products.user_id,
      'low_stock',
      'Stok produk menipis',
      format('Stok %s tersisa %s %s.', products.name, products.stock, products.unit),
      jsonb_build_object(
        'product_id', products.id,
        'product_name', products.name,
        'stock', products.stock,
        'unit', products.unit
      )
    from public.products
    where products.user_id = new.id
      and products.stock > old.low_stock_threshold
      and products.stock <= new.low_stock_threshold;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_log_low_stock_threshold_update on public.profiles;
create trigger profiles_log_low_stock_threshold_update
  after update of low_stock_threshold on public.profiles
  for each row
  when (old.low_stock_threshold is distinct from new.low_stock_threshold)
  execute function public.log_low_stock_notifications_for_threshold_change();
