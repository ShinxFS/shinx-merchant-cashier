-- Upgrade script for existing databases only.
-- New Supabase projects should run full_schema.sql, which includes this setup.
-- Public QR requests must use the application API, not direct Supabase table access.

alter table public.profiles
  add column if not exists cashier_sound_url text,
  add column if not exists customer_sound_url text,
  add column if not exists cashier_tone text not null default 'classic',
  add column if not exists customer_tone text not null default 'classic';

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

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'table_orders'
    ) then
    alter publication supabase_realtime add table public.table_orders;
  end if;
end
$$;

drop policy if exists "table_orders_public_insert" on public.table_orders;
drop policy if exists "table_orders_public_read" on public.table_orders;
drop policy if exists "table_orders_public_delete" on public.table_orders;
drop policy if exists "table_orders_public_update" on public.table_orders;
drop policy if exists "table_orders_owner" on public.table_orders;
create policy "table_orders_owner" on public.table_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

create table if not exists public.table_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  table_number integer not null check (table_number between 1 and 4),
  token_version integer not null default 1 check (token_version > 0),
  token_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, table_number),
  unique (table_number, token_hash)
);

alter table public.table_qr_tokens enable row level security;
revoke all on public.table_qr_tokens from anon, authenticated;
grant all on public.table_qr_tokens to service_role;

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

create or replace function public.apply_table_order_stock_delta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_record jsonb;
begin
  if tg_op = 'INSERT' then
    for item_record in
      select value
      from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
    loop
      update public.products
      set stock = greatest(
        stock - coalesce((item_record->>'quantity')::int, 0),
        0
      )
      where id::text = item_record->>'id'
        and user_id = new.user_id;
    end loop;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'done' then
      return old;
    end if;

    for item_record in
      select value
      from jsonb_array_elements(coalesce(old.items, '[]'::jsonb))
    loop
      update public.products
      set stock = stock + coalesce((item_record->>'quantity')::int, 0)
      where id::text = item_record->>'id'
        and user_id = old.user_id;
    end loop;
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists table_orders_stock_adjustment on public.table_orders;
create trigger table_orders_stock_adjustment
  after insert or delete on public.table_orders
  for each row execute function public.apply_table_order_stock_delta();

create or replace function public.create_table_order_from_qr(
  p_token_hash text,
  p_table_number integer,
  p_items jsonb,
  p_customer_note text,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_id uuid;
  requested_item record;
  product_record record;
  order_items jsonb := '[]'::jsonb;
  order_total numeric := 0;
  order_note text;
  order_id uuid;
begin
  if p_table_number not between 1 and 4
    or p_payment_method not in ('cash', 'qris')
    or p_customer_note is null
    or length(p_customer_note) > 500
    or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'INVALID_ORDER';
  end if;

  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_ORDER';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or coalesce(entry.value->>'productId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(entry.value->>'quantity', '') !~ '^[1-9][0-9]{0,2}$'
  ) then
    raise exception 'INVALID_ORDER';
  end if;

  select token.user_id into owner_id
  from public.table_qr_tokens token
  where token.table_number = p_table_number
    and token.token_hash = p_token_hash;

  if owner_id is null then
    raise exception 'INVALID_QR_TOKEN';
  end if;

  for requested_item in
    select entry.value->>'productId' as product_id,
      sum((entry.value->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as entry(value)
    group by entry.value->>'productId'
    order by entry.value->>'productId'
  loop
    select product.id, product.name, product.price, product.stock
      into product_record
    from public.products product
    where product.id = requested_item.product_id::uuid
      and product.user_id = owner_id
      and product.is_active
    for update;

    if not found then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;

    if product_record.stock < requested_item.quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    order_items := order_items || jsonb_build_array(jsonb_build_object(
      'id', product_record.id,
      'name', product_record.name,
      'quantity', requested_item.quantity,
      'price', product_record.price,
      'subtotal', product_record.price * requested_item.quantity
    ));
    order_total := order_total + product_record.price * requested_item.quantity;
  end loop;

  order_note := case
    when p_payment_method = 'qris'
      then 'Order via QR Meja ' || p_table_number || ' - menunggu konfirmasi pembayaran QRIS'
    else 'Order via QR Meja ' || p_table_number
  end;
  if btrim(p_customer_note) <> '' then
    order_note := order_note || ' — ' || btrim(p_customer_note);
  end if;

  insert into public.table_orders (
    user_id, table_number, customer_name, total, status, items, note, payment_method
  ) values (
    owner_id, p_table_number, 'Pelanggan Meja ' || p_table_number,
    order_total, 'pending', order_items, order_note, p_payment_method
  )
  returning id into order_id;

  return order_id;
end;
$$;

create or replace function public.cancel_table_order_from_qr(
  p_token_hash text,
  p_table_number integer,
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_id uuid;
begin
  select token.user_id into owner_id
  from public.table_qr_tokens token
  where token.table_number = p_table_number
    and token.token_hash = p_token_hash;

  if owner_id is null then
    raise exception 'INVALID_QR_TOKEN';
  end if;

  delete from public.table_orders
  where id = p_order_id
    and user_id = owner_id
    and table_number = p_table_number
    and status = 'pending';

  if not found then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  return true;
end;
$$;

revoke all on function public.create_table_order_from_qr(text, integer, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.cancel_table_order_from_qr(text, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_table_order_from_qr(text, integer, jsonb, text, text) to service_role;
grant execute on function public.cancel_table_order_from_qr(text, integer, uuid) to service_role;
