-- Jalankan di Supabase Dashboard > SQL Editor untuk database yang sudah ada.
alter table public.transaction_items
  add column if not exists note text;
