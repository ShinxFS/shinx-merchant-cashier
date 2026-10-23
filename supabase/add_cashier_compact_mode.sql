-- Jalankan di Supabase Dashboard > SQL Editor untuk database yang sudah ada.
alter table public.profiles
  add column if not exists cashier_compact_mode boolean not null default false;
