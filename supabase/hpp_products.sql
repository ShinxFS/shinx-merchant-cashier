-- Tabel penyimpanan hasil Kalkulator HPP.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New query).

create table if not exists public.hpp_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_type text not null check (business_type in ('manufaktur', 'retail', 'jasa')),
  product_name text not null,
  product_code text,
  category text,
  units numeric not null default 1,
  inputs jsonb not null default '{}',          -- semua komponen biaya mentah per jenis bisnis
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

-- Setiap user hanya bisa mengakses barisnya sendiri.
drop policy if exists "own rows" on public.hpp_products;
create policy "own rows" on public.hpp_products
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
